import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { planLegacyMigration, applyLegacyMigration } from "../src/lib/session-sync.mjs";

const options = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === "--apply" || key === "--dry-run") options.set(key, true);
  else if (["--backup", "--report"].includes(key) && process.argv[i + 1]) options.set(key, process.argv[++i]);
  else throw new Error(`Unknown migration argument: ${key}`);
}
const applying = options.has("--apply");
if (applying && !options.has("--backup")) throw new Error("--apply requires a verified backup descriptor (--backup backup.json)");
const root = path.resolve(process.env.STORAGE_BASE_DIR || "/srv/sftpgo/sessions");
const prisma = new PrismaClient();
const report = { mode: applying ? "apply" : "dry-run", root, startedUtc: new Date().toISOString(), sessions: [] };

async function persistReport() {
  const target = options.get("--report");
  if (target) await fs.writeFile(target, JSON.stringify(report, null, 2), { mode: 0o600 });
}

try {
  const rows = await prisma.session.findMany({ select: { id: true, name: true, slug: true } });
  const sessions = new Map(rows.map(row => [row.id, row]));
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link at session root: ${entry.name}`);
    if (entry.isDirectory() && !sessions.has(entry.name)) sessions.set(entry.name, { id: entry.name, name: entry.name, slug: null });
  }
  let inventory;
  if (applying) {
    const descriptorPath = path.resolve(options.get("--backup"));
    const backup = JSON.parse(await fs.readFile(descriptorPath, "utf8"));
    if (backup.complete !== true) throw new Error("Backup has not been verified");
    inventory = JSON.parse(await fs.readFile(path.join(path.dirname(descriptorPath), "sessions-manifest.json"), "utf8"));
  }
  const planned = [];
  for (const session of sessions.values()) {
    if (!/^[a-zA-Z0-9_-]+$/.test(session.id)) throw new Error(`Unsafe session ID: ${session.id}`);
    const directory = path.join(root, session.id);
    const entries = await planLegacyMigration(directory);
    if (applying) {
      if (inventory[session.id]?.type !== "directory") throw new Error(`Session absent from backup: ${session.name}`);
      for (const entry of entries.filter(item => item.kind === "file")) {
        const original = inventory[`${session.id}/sync/${entry.relative.split(path.sep).join('/')}`];
        if (original?.sha256 !== entry.sha256) throw new Error(`Unbacked or changed file: ${session.name}/${entry.relative}`);
      }
    }
    const summary = { ...session, files: entries.filter(item => item.kind === "file").length, bytes: entries.reduce((n, item) => n + (item.size ?? 0), 0), verified: false };
    planned.push({ directory, entries, summary });
    report.sessions.push(summary);
    console.log(JSON.stringify({ phase: "preflight", ...summary }));
  }
  // No session is changed until every plan and backup relationship is validated.
  await persistReport();
  for (const plan of planned) {
    if (applying) {
      await applyLegacyMigration(plan.directory, plan.entries);
      plan.summary.verified = true;
      await persistReport();
      console.log(JSON.stringify({ phase: "verified", ...plan.summary }));
    }
  }
  report.complete = true;
  report.finishedUtc = new Date().toISOString();
  await persistReport();
  console.log(JSON.stringify({ complete: true, mode: report.mode, sessions: report.sessions.length, files: report.sessions.reduce((n, s) => n + s.files, 0) }));
} catch (error) {
  report.complete = false;
  report.error = error.message;
  await persistReport();
  console.error(error.message);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
