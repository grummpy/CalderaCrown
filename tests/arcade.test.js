import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exists(relativePath) {
  const cleaned = relativePath.replace(/^\.\//, "");
  return fs.existsSync(path.join(root, cleaned));
}

describe("arcade.json", () => {
  it("matches the arcade manifest and points at real files", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "arcade.json"), "utf8"));
    assert.equal(manifest.name, "Caldera Crown");
    assert.equal(manifest.id, "calderacrown");
    assert.equal(manifest.players, 4);
    assert.equal(manifest.minPlayers, 1);
    assert.equal(manifest.port, 8816);
    assert.equal(manifest.version, "1.0.0");
    assert.deepEqual(manifest.input, ["keyboard", "gamepad"]);
    for (const file of [manifest.icon, manifest.cover, manifest.launch.web]) {
      assert.equal(exists(file), true, file);
    }
    for (const file of Object.values(manifest.launch)) {
      assert.equal(exists(file), true, file);
    }
    const server = fs.readFileSync(path.join(root, "server.py"), "utf8");
    assert.match(server, /8816/);
    const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
    assert.match(page, /Caldera Crown/);
    assert.match(page, /<canvas/);
  });
});
