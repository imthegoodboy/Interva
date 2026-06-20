import { describe, expect, it } from "vitest";
import manifest from "../manifest.json" with { type: "json" };

describe("Anna app manifest", () => {
  it("uses schema 2 and no bundled executa dependency", () => {
    expect(manifest.schema).toBe(2);
    expect(manifest.required_executas).toEqual([]);
    expect(manifest.optional_executas).toEqual([]);
  });

  it("declares only the host APIs used by the bundle", () => {
    expect(manifest.permissions).toEqual(["storage.read", "storage.write", "chat.append_artifact"]);
    expect(manifest.ui.host_api.storage).toEqual(["get", "set", "list", "delete"]);
    expect(manifest.ui.host_api.chat).toEqual(["append_artifact"]);
    expect(manifest.ui.host_api.agent.session.auto).toBe(true);
  });
});
