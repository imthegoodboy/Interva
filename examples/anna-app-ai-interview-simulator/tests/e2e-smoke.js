import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.ANNA_APP_PORT || 5190);
const appUrl = process.env.ANNA_APP_URL || `http://localhost:${port}/`;
const realHarness = process.env.ANNA_APP_REAL === "1";
const annaHost = process.env.ANNA_HOST || "https://anna.partners";
const outputDir = path.join(projectRoot, "test-results", "e2e-smoke");
const startTimeoutMs = 45_000;
const actionTimeoutMs = Number(process.env.E2E_ACTION_TIMEOUT_MS || 10_000);

let serverProcess = null;

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const alreadyRunning = await isReachable(appUrl);
  if (!alreadyRunning) {
    serverProcess = startHarness();
    await waitForHarness(appUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const warnings = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
      if (message.type() === "warning" && !message.text().includes("allow-scripts")) {
        warnings.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl, { waitUntil: "networkidle" });

    const app = await resolveAppSurface(page);
    await app.locator("#connection-label").waitFor({ state: "visible", timeout: actionTimeoutMs });
    await page.waitForTimeout(1_000);
    await app.getByRole("button", { name: /Setup/ }).click();
    await waitForInputValue(app.locator("#role-input"));
    await app.screenshot("setup-desktop.png");

    const initialRole = await app.locator("#role-input").inputValue();
    assert(initialRole.length > 0, "setup role is populated");
    const setupText = await app.locator("#view-setup").innerText();
    assert(!setupText.includes("HR Manager"), "setup page does not show homepage panel roster");
    assert(!setupText.includes("implementation detail, correctness"), "setup page does not show interviewer intent copy");

    await app.getByRole("button", { name: "Backend" }).click();
    assertEqual(await app.locator("#role-input").inputValue(), "Senior Backend Engineer", "backend preset role");

    await app.getByRole("button", { name: "Start mock" }).first().click();
    await app.locator("#answer-input").waitFor({ state: "visible", timeout: actionTimeoutMs });

    const answer = [
      "When we had an API latency issue for 20000 users, I first clarified impact and reproduced the request path.",
      "I traced the queue, cache, database index, and API timeout behavior, then compared the tradeoff between rolling back quickly and shipping a targeted schema fix.",
      "We rolled back first, added tests and observability, and reduced p95 latency by 35% while keeping the team updated.",
    ].join(" ");

    await app.locator("#answer-input").fill(answer);
    const coachText = await app.locator("#answer-coach").innerText();
    for (const signal of ["STAR", "Specifics", "Tradeoffs", "Metrics"]) {
      assert(coachText.includes(signal), `answer coach includes ${signal}`);
    }
    await app.screenshot("interview-coach-desktop.png");

    await app.getByRole("button", { name: "Submit Answer" }).click();
    await app.locator(".turn").first().waitFor({ state: "visible", timeout: actionTimeoutMs });
    assertEqual(await app.locator(".turn").count(), 1, "submitted turn count");

    await app.getByRole("button", { name: "Finish" }).click();
    await app.getByText("Interview Report").waitFor({ state: "visible", timeout: actionTimeoutMs });
    await app.screenshot("report-desktop.png");
    const reportText = (await app.locator("#report-layout").innerText()).toLowerCase();
    assert(reportText.includes("personalized study plan"), "report includes study plan");
    assert(reportText.includes("next practice"), "report includes next-practice loop");

    await app.getByRole("button", { name: "Progress" }).click();
    await app.getByText("Interview History").waitFor({ state: "visible", timeout: actionTimeoutMs });
    await app.screenshot("progress-desktop.png");
    const progressText = await app.locator("#progress-layout").innerText();
    assert(progressText.includes("Senior Backend Engineer"), "progress page includes completed interview");

    await app.getByRole("button", { name: "Report" }).click();
    await app.getByText("Interview Report").waitFor({ state: "visible", timeout: actionTimeoutMs });

    await app.getByRole("button", { name: "Copy study plan" }).click();
    await app.getByText("Study plan copied.").waitFor({ state: "visible", timeout: actionTimeoutMs });
    await app.getByRole("button", { name: "Next mock" }).click();
    await app.getByText("Next mock focus areas loaded.").waitFor({ state: "visible", timeout: actionTimeoutMs });
    const nextFocus = await app.locator("#setup-stats").innerText();
    assert(nextFocus.includes("Communication") || nextFocus.includes("System Design"), "next mock loads weak-area focus");

    const directUrl = await getDirectAppUrl(page);
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    mobile.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    mobile.on("pageerror", (error) => errors.push(error.message));
    await mobile.addInitScript(() => localStorage.clear());
    await mobile.goto(directUrl, { waitUntil: "networkidle" });
    await waitForInputValue(mobile.locator("#role-input"));
    await mobile.screenshot({ path: path.join(outputDir, "setup-mobile.png"), fullPage: false });
    const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    assert(!mobileOverflow, "mobile viewport has no horizontal overflow");

    assertEqual(errors.length, 0, `console/page errors: ${errors.join(" | ")}`);
    assertEqual(warnings.length, 0, `unexpected warnings: ${warnings.join(" | ")}`);
    console.log(`e2e smoke passed: ${outputDir}`);
  } finally {
    await browser.close();
    stopHarness();
  }
}

function startHarness() {
  const cliPath = path.join(projectRoot, "node_modules", "@anna-ai", "cli", "dist", "cli.js");
  const args = [cliPath, "dev", "--port", String(port)];
  if (realHarness) {
    args.push("--llm-account", annaHost, "--storage", "aps");
  } else {
    args.push("--no-llm");
  }
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env: cleanEnv(process.env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

function cleanEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value]),
  );
}

async function waitForHarness(url) {
  const started = Date.now();
  while (Date.now() - started < startTimeoutMs) {
    if (await isReachable(url)) return;
    await delay(500);
  }
  throw new Error(`Anna app harness did not start at ${url}`);
}

async function isReachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveAppSurface(page) {
  const iframe = page.locator("iframe").first();
  if (await iframe.count()) {
    const frame = page.frameLocator("iframe").first();
    return {
      locator: (selector) => frame.locator(selector),
      getByRole: (...args) => frame.getByRole(...args),
      getByText: (...args) => frame.getByText(...args),
      screenshot: (name) => iframe.screenshot({ path: path.join(outputDir, name) }),
    };
  }
  return {
    locator: (selector) => page.locator(selector),
    getByRole: (...args) => page.getByRole(...args),
    getByText: (...args) => page.getByText(...args),
    screenshot: (name) => page.screenshot({ path: path.join(outputDir, name), fullPage: false }),
  };
}

async function getDirectAppUrl(page) {
  const src = await page.locator("iframe").first().getAttribute("src");
  return src ? new URL(src, appUrl).toString() : appUrl;
}

async function waitForInputValue(locator) {
  await locator.waitFor({ state: "visible", timeout: actionTimeoutMs });
  await locator.evaluate((element) => new Promise((resolve) => {
    if (element.value) {
      resolve();
      return;
    }
    const started = performance.now();
    const tick = () => {
      if (element.value || performance.now() - started > 4_000) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    tick();
  }));
}

function assert(condition, label) {
  if (!condition) throw new Error(`Assertion failed: ${label}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${label}. Expected ${expected}, received ${actual}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopHarness() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill();
}

main().catch((error) => {
  stopHarness();
  console.error(error);
  process.exit(1);
});
