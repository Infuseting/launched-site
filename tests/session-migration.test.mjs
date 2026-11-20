import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SYNC_INDEX_PHP_CONTENT, ensureSyncDirectories, planLegacyMigration, applyLegacyMigration } from "../src/lib/session-sync.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "launched-migration-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (relative, content) => {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  };
  return { root, write };
}

test("new sessions and existing indexes always receive the canonical layout and template", async t => {
  const { root } = await fixture(t);
  await ensureSyncDirectories(root);
  for (const name of ["sync/mandatory", "sync/optional", "assets"]) assert.ok((await fs.stat(path.join(root, name))).isDirectory());
  const index = path.join(root, "sync/index.php");
  assert.equal(await fs.readFile(index, "utf8"), SYNC_INDEX_PHP_CONTENT);
  await fs.chmod(index, 0o644);
  await fs.writeFile(index, "an old or different index");
  await ensureSyncDirectories(root);
  assert.equal(await fs.readFile(index, "utf8"), SYNC_INDEX_PHP_CONTENT);
  await ensureSyncDirectories(root);
  assert.equal(await fs.readFile(index, "utf8"), SYNC_INDEX_PHP_CONTENT);
});

test("migration moves every legacy payload, preserves optional files/assets and can run again", async t => {
  const { root, write } = await fixture(t);
  for (const [name, content] of [
    ["sync/mods/mod.jar", "mod"], ["sync/Flan/pack.zip", "flan"], ["sync/settings.toml", "settings"],
    ["sync/mandatory/mods/kept.jar", "kept"], ["sync/optional/mods/choice.jar", "choice"],
    ["assets/background.png", "image"], ["sync/.htaccess", "rules"], ["sync/index.php", "old"],
  ]) await write(name, content);
  await fs.mkdir(path.join(root, "sync/empty/nested"), { recursive: true });
  const plan = await planLegacyMigration(root);
  assert.equal(plan.filter(e => e.kind === "file").length, 3);
  assert.equal(await fs.readFile(path.join(root, "sync/mods/mod.jar"), "utf8"), "mod", "preflight must be read-only");
  const result = await applyLegacyMigration(root, plan);
  assert.equal(result.files, 3);
  for (const [name, content] of [["mandatory/mods/mod.jar", "mod"], ["mandatory/Flan/pack.zip", "flan"], ["mandatory/settings.toml", "settings"], ["mandatory/mods/kept.jar", "kept"], ["optional/mods/choice.jar", "choice"], [".htaccess", "rules"]]) {
    assert.equal(await fs.readFile(path.join(root, "sync", name), "utf8"), content);
  }
  assert.ok((await fs.stat(path.join(root, "sync/mandatory/empty/nested"))).isDirectory());
  assert.equal(await fs.readFile(path.join(root, "assets/background.png"), "utf8"), "image");
  assert.deepEqual(await planLegacyMigration(root), []);
  await applyLegacyMigration(root, []);
});

test("different destination files abort preflight without moving any data", async t => {
  const { root, write } = await fixture(t);
  await write("sync/mods/a.jar", "original");
  await write("sync/mandatory/mods/a.jar", "different");
  await assert.rejects(planLegacyMigration(root), /Different files/);
  assert.equal(await fs.readFile(path.join(root, "sync/mods/a.jar"), "utf8"), "original");
});

test("identical duplicates merge without overwriting their destination", async t => {
  const { root, write } = await fixture(t);
  await write("sync/mods/a.jar", "same");
  await write("sync/mandatory/mods/a.jar", "same");
  await applyLegacyMigration(root, await planLegacyMigration(root));
  await assert.rejects(fs.stat(path.join(root, "sync/mods/a.jar")), { code: "ENOENT" });
  assert.equal(await fs.readFile(path.join(root, "sync/mandatory/mods/a.jar"), "utf8"), "same");
});

test("destination links cannot redirect a migration outside its mandatory directory", async t => {
  const { root, write } = await fixture(t);
  const outside = await fs.mkdtemp(path.join(tmpdir(), "launched-migration-outside-"));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await write("sync/mods/a.jar", "original");
  await fs.mkdir(path.join(root, "sync/mandatory"));
  const link = path.join(root, "sync/mandatory/mods");
  await fs.symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
  t.after(() => fs.rmdir(link).catch(() => {}));
  await assert.rejects(planLegacyMigration(root), /Symbolic link/);
  assert.deepEqual(await fs.readdir(outside), []);
});
