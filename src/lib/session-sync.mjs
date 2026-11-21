import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const SYNC_INDEX_PHP_CONTENT = `<?php
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');

$isV1 = isset($_GET['v1']) && ($_GET['v1'] === 'true' || $_GET['v1'] === '1');

function ScanDirectory($Directory, $baseLen) {
    $items = [];
    $handle = @opendir($Directory);
    if (!$handle) throw new RuntimeException('Unable to read sync directory');
    while (($entry = @readdir($handle)) !== false) {
        if ($entry === '.' || $entry === '..' || $entry === 'index.php' || $entry === '.htaccess') {
            continue;
        }
        $fullPath = $Directory . '/' . $entry;
        if (is_link($fullPath)) continue;
        $relPath = substr($fullPath, $baseLen);
        if (is_dir($fullPath)) {
            $dirName = rtrim($relPath, '/') . '/';
            $items[] = [
                'name' => $dirName,
                'path' => $fullPath,
                'is_dir' => true,
            ];
            $items = array_merge($items, ScanDirectory($fullPath, $baseLen));
        } else {
            $items[] = [
                'name' => $relPath,
                'path' => $fullPath,
                'is_dir' => false,
            ];
        }
    }
    closedir($handle);
    return $items;
}

try {
$scanned = ScanDirectory('.', 2);
$output = [];

foreach ($scanned as $item) {
    $name = $item['name'];
    $isOptional = (strpos($name, 'optional/') === 0);
    $type = $isOptional ? 'optional' : 'mandatory';

    if ($isV1) {
        if ($isOptional) {
            continue;
        }
        if (strpos($name, 'mandatory/') === 0) {
            $name = substr($name, strlen('mandatory/'));
        }
        if ($name === '') {
            continue;
        }
        if ($item['is_dir']) {
            $output[] = [
                'name' => $name,
                'md5' => md5($name),
                'size' => '0',
            ];
        } else {
            $stat = @stat($item['path']);
            $checksum = @md5_file($item['path']);
            if (!$stat || $checksum === false) throw new RuntimeException('Unable to read sync file');
            $output[] = [
                'name' => $name,
                'md5' => $checksum,
                'size' => (string)$stat['size'],
            ];
        }
    } else {
        if ($item['is_dir']) {
            $output[] = [
                'name' => $name,
                'md5' => md5($name),
                'size' => '0',
                'type' => $type,
            ];
        } else {
            $stat = @stat($item['path']);
            $checksum = @md5_file($item['path']);
            if (!$stat || $checksum === false) throw new RuntimeException('Unable to read sync file');
            $output[] = [
                'name' => $name,
                'md5' => $checksum,
                'size' => (string)$stat['size'],
                'type' => $type,
            ];
        }
    }
}

echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    http_response_code(500);
    error_log('Sync manifest generation failed');
    echo json_encode(['error' => 'Internal error']);
}
?>
`;

const RESERVED = new Set(['mandatory', 'optional', 'index.php', '.htaccess']);

async function metadata(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function checkedDirectory(directory) {
  const info = await metadata(directory);
  if (info && (info.isSymbolicLink() || !info.isDirectory()))
    throw new Error(`Unsafe session directory: ${directory}`);
  await fs.mkdir(directory, { recursive: true });
  await fs.chmod(directory, 0o777).catch(() => {});
  await fs.chown(directory, 1000, 1000).catch(() => {});
}

/** Every session creation and migration uses this exact canonical template. */
export async function ensureSyncDirectories(sessionDirectory) {
  await checkedDirectory(sessionDirectory);
  const sync = path.join(sessionDirectory, 'sync');
  for (const directory of [
    sync,
    path.join(sessionDirectory, 'assets'),
    path.join(sync, 'mandatory'),
    path.join(sync, 'optional'),
  ]) {
    await checkedDirectory(directory);
  }
  const index = path.join(sync, 'index.php');
  const existing = await metadata(index);
  if (existing && (existing.isSymbolicLink() || !existing.isFile()))
    throw new Error(`Unsafe sync index: ${index}`);
  const current = existing ? await fs.readFile(index, 'utf8') : null;
  if (current !== SYNC_INDEX_PHP_CONTENT) {
    // Keep temporary PHP outside sync/, so concurrent manifests cannot list it.
    const temporary = path.join(sessionDirectory, `.index-${randomUUID()}.tmp`);
    await fs.writeFile(temporary, SYNC_INDEX_PHP_CONTENT, {
      encoding: 'utf8',
      mode: 0o444,
      flag: 'wx',
    });
    try {
      await fs.chown(temporary, 1000, 1000).catch(() => {});
      try {
        await fs.rename(temporary, index);
      } catch (error) {
        if (!existing || !['EPERM', 'EACCES'].includes(error.code)) throw error;
        await fs.chmod(index, 0o644);
        await fs.rename(temporary, index);
      }
    } finally {
      await fs.unlink(temporary).catch(() => {});
    }
  }
  await fs.chmod(index, 0o444);
  await fs.chown(index, 1000, 1000).catch(() => {});
}

export async function fileSha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function checkedDestination(root, relative) {
  const resolved = path.resolve(root, relative);
  const inside = path.relative(root, resolved);
  if (!inside || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside))
    throw new Error(`Unsafe destination: ${relative}`);
  let current = root;
  for (const part of inside.split(path.sep)) {
    current = path.join(current, part);
    const info = await metadata(current);
    if (info?.isSymbolicLink()) throw new Error(`Symbolic link in destination: ${current}`);
    if (info && current !== resolved && !info.isDirectory())
      throw new Error(`File blocks destination: ${current}`);
  }
  return resolved;
}

/** Read-only preflight: detect every collision before moving any session data. */
export async function planLegacyMigration(sessionDirectory) {
  const sync = path.join(sessionDirectory, 'sync');
  const rootInfo = await metadata(sync);
  if (!rootInfo) return [];
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
    throw new Error(`Unsafe sync directory: ${sync}`);
  const mandatory = path.join(sync, 'mandatory');
  const mandatoryInfo = await metadata(mandatory);
  if (mandatoryInfo && (mandatoryInfo.isSymbolicLink() || !mandatoryInfo.isDirectory()))
    throw new Error(`Unsafe mandatory directory: ${mandatory}`);
  const entries = [];
  async function walk(source, relative) {
    const info = await fs.lstat(source);
    if (info.isSymbolicLink()) throw new Error(`Symbolic link in legacy payload: ${source}`);
    const target = await checkedDestination(mandatory, relative);
    const existing = await metadata(target);
    if (info.isDirectory()) {
      if (existing && !existing.isDirectory())
        throw new Error(`Destination collision: ${relative}`);
      entries.push({
        relative,
        source,
        target,
        kind: 'directory',
        mode: info.mode & 0o777,
        uid: info.uid,
        gid: info.gid,
      });
      for (const name of (await fs.readdir(source)).sort())
        await walk(path.join(source, name), path.join(relative, name));
    } else if (info.isFile()) {
      const sha256 = await fileSha256(source);
      if (
        existing &&
        (!existing.isFile() || existing.size !== info.size || (await fileSha256(target)) !== sha256)
      ) {
        throw new Error(`Different files share a destination: ${relative}`);
      }
      entries.push({
        relative,
        source,
        target,
        kind: 'file',
        size: info.size,
        sha256,
        duplicate: !!existing,
      });
    } else throw new Error(`Unsupported payload entry: ${source}`);
  }
  for (const name of (await fs.readdir(sync)).sort()) {
    if (!RESERVED.has(name)) await walk(path.join(sync, name), name);
  }
  return entries;
}

/** Move payload only; assets, existing optional files and server scripts stay put. */
export async function applyLegacyMigration(sessionDirectory, entries) {
  await ensureSyncDirectories(sessionDirectory);
  for (const entry of entries) {
    if (entry.kind === 'directory') {
      await fs.mkdir(entry.target, { recursive: true });
      await fs.chmod(entry.target, entry.mode).catch(() => {});
      await fs.chown(entry.target, entry.uid, entry.gid).catch(() => {});
      continue;
    }
    if ((await fileSha256(entry.source)) !== entry.sha256)
      throw new Error(`Source changed since preflight: ${entry.relative}`);
    if (entry.duplicate) {
      if ((await fileSha256(entry.target)) !== entry.sha256)
        throw new Error(`Destination changed: ${entry.relative}`);
      await fs.unlink(entry.source);
    } else {
      if (await metadata(entry.target)) throw new Error(`Destination appeared: ${entry.relative}`);
      await fs.rename(entry.source, entry.target);
    }
    if ((await fileSha256(entry.target)) !== entry.sha256)
      throw new Error(`Verification failed: ${entry.relative}`);
  }
  for (const entry of [...entries].reverse())
    if (entry.kind === 'directory') await fs.rmdir(entry.source);
  if ((await planLegacyMigration(sessionDirectory)).length)
    throw new Error(`Legacy entries remain: ${sessionDirectory}`);
  return {
    files: entries.filter((e) => e.kind === 'file').length,
    bytes: entries.reduce((n, e) => n + (e.size ?? 0), 0),
  };
}
