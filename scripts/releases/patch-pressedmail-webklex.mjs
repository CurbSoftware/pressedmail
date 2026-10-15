import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET =
  'vendor/webklex/php-imap/src/Connection/Protocols/ImapProtocol.php';
const PATCH = fileURLToPath(
  new URL('./patches/webklex-6.2.0-imap-values.patch', import.meta.url),
);
export const CLIENT_TARGET = 'vendor/webklex/php-imap/src/Client.php';
const CLIENT_PATCH = fileURLToPath(
  new URL('./patches/webklex-6.2.0-connection-window.patch', import.meta.url),
);

/**
 * Hash of the decodeLine slice, before and after the patch. The slice is what
 * the patch rewrites, so these catch a review-needed change to that method.
 */
export const ORIGINAL =
  '05efa6a6fbb351b5e1bc99a03b5788d46a24162ffc08f3791461acf32116e18d';
export const PATCHED =
  '0b46b501a086b32b7c3f4c51a17772d2affaefa95075e2950801ae43a0dad8b5';

/**
 * Whole-file hashes. The slice hashes above cannot see a change anywhere else
 * in the file, so a shipped copy is only the reviewed copy when the whole file
 * matches too. Both values were derived from real artifacts: ORIGINAL from the
 * upstream 6.2.0 dist archive, which every unpatched staging tree also
 * matches, and PATCHED from the Free, Pro, staging and SVN trunk copies, which
 * are byte-identical to each other.
 *
 * A verifier can therefore check a distributed ZIP without running Composer:
 * hash the file and compare it to PATCHED_FILE_SHA256.
 */
export const ORIGINAL_FILE_SHA256 =
  'bf2c496fdd7bbc0aa3bbc93d5b477c63106ed3bde7debd7dbf834fbcd09d78e8';
export const PATCHED_FILE_SHA256 =
  'e21bacb500a6b97bb3e97b535e06dc4a8214080679346187ff1f73a6339af610';

export function decoderHash(source) {
  const start = source.indexOf('    protected function decodeLine(');
  const end = source.indexOf('\n    /**', start);
  if (start < 0 || end < 0)
    throw new Error('Webklex decodeLine source is missing.');
  return createHash('sha256').update(source.slice(start, end)).digest('hex');
}

/**
 * The Client patch: isConnected() through disconnect(), where Webklex sends the
 * NOOP it asks before almost every command. Hashed the same way as decodeLine.
 */
export const CLIENT_ORIGINAL =
  '0fa5ea36f3395321b27414032fbf5389436e4084c09aab51496795612a872dcb';
export const CLIENT_PATCHED =
  'c7bdec96007bbe37398300598d9eb6911b3517753369cc61314c747e080bfffa';
/** Whole-file hashes: ORIGINAL from the upstream 6.2.0 dist archive. */
export const CLIENT_ORIGINAL_FILE_SHA256 =
  'b7cecc84ba5dcae5e50abfa655977a66df349a496b18ddc01d1d8366424179f9';
export const CLIENT_PATCHED_FILE_SHA256 =
  '8570d8cb64812ae7760b8be787f22883f7298dd69829da1ffa4ed99a604d7da4';

export function connectionCheckHash(source) {
  const start = source.indexOf('    public function isConnected(): bool {');
  const end = source.indexOf(
    '\n    /**\n     * Get a folder instance by a folder name',
    start,
  );
  if (start < 0 || end < 0)
    throw new Error('Webklex Client connection check source is missing.');
  return createHash('sha256').update(source.slice(start, end)).digest('hex');
}

export function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * The shipped bytes must be the reviewed bytes. Asserted only for a tree that
 * starts from the reviewed upstream file: the test fixtures build a synthetic
 * target from the patch body, which carries the same decodeLine slice without
 * the rest of the upstream file, and the slice check above is their guard. A
 * real release always starts from Composer's 6.2.0 dist, so every packaged
 * build is held to the whole-file hash.
 */
export function assertPatchedFile(
  path,
  expected = PATCHED_FILE_SHA256,
  target = TARGET,
) {
  const actual = fileHash(path);
  if (actual !== expected) {
    throw new Error(
      `The packaged Webklex file is not the reviewed file: expected ${expected}, found ${actual} in ${target}.`,
    );
  }
}

const PATCHES = [
  {
    target: TARGET,
    patch: PATCH,
    hash: decoderHash,
    original: ORIGINAL,
    patched: PATCHED,
    originalFile: ORIGINAL_FILE_SHA256,
    patchedFile: PATCHED_FILE_SHA256,
    changed: 'Webklex decodeLine changed; review the PressedMail IMAP patch.',
    failed: 'The PressedMail IMAP patch did not produce the reviewed decoder.',
  },
  {
    target: CLIENT_TARGET,
    patch: CLIENT_PATCH,
    hash: connectionCheckHash,
    original: CLIENT_ORIGINAL,
    patched: CLIENT_PATCHED,
    originalFile: CLIENT_ORIGINAL_FILE_SHA256,
    patchedFile: CLIENT_PATCHED_FILE_SHA256,
    changed:
      'Webklex Client connection check changed; review the PressedMail connection patch.',
    failed:
      'The PressedMail connection patch did not produce the reviewed Client.',
  },
];

/** Apply only in the disposable release tree, after Composer and before integrity hashes. */
export function patchPressedMailWebklex(directory) {
  const composerPath = join(directory, 'composer.json');
  if (!existsSync(composerPath)) return false;
  const composer = JSON.parse(readFileSync(composerPath, 'utf8'));
  if (!composer.require?.['webklex/php-imap']) return false;

  const installedPath = join(directory, 'vendor/composer/installed.json');
  const installed = JSON.parse(readFileSync(installedPath, 'utf8'));
  const packages = Array.isArray(installed) ? installed : installed.packages;
  const version = packages?.find(
    (pkg) => pkg.name === 'webklex/php-imap',
  )?.version;
  if (version !== '6.2.0') {
    throw new Error(
      `Review the PressedMail IMAP patch for Webklex ${version ?? 'missing'}.`,
    );
  }
  // Judge every file before writing any, so a refusal leaves vendor untouched.
  const pending = PATCHES.filter((entry) => {
    const current = entry.hash(
      readFileSync(join(directory, entry.target), 'utf8'),
    );
    if (current === entry.patched) return false;
    if (current !== entry.original) throw new Error(entry.changed);
    return true;
  });
  for (const entry of pending) {
    const target = join(directory, entry.target);
    const startsFromReviewedUpstream = fileHash(target) === entry.originalFile;
    // Git is already a release prerequisite. Apply atomically, without fuzzy matching.
    execFileSync('git', ['apply', '--check', entry.patch], {
      cwd: directory,
      stdio: 'pipe',
    });
    execFileSync('git', ['apply', entry.patch], {
      cwd: directory,
      stdio: 'pipe',
    });
    if (entry.hash(readFileSync(target, 'utf8')) !== entry.patched) {
      throw new Error(entry.failed);
    }
    if (startsFromReviewedUpstream)
      assertPatchedFile(target, entry.patchedFile, entry.target);
  }
  return pending.length > 0;
}

/**
 * `node scripts/releases/patch-pressedmail-webklex.mjs <plugin directory>`.
 *
 * The release pipeline patches the tree it is about to package through the
 * function above, and the capped test runner calls this CLI on the vendor it
 * just installed in the guest: the pressed-mail tests characterise the parser
 * the plugin *ships*, which is this patched one, so a guest running a fresh
 * `composer install` tests the wrong bytes (test-folder-driver-descriptors.php
 * is the one that notices). Failures throw with the reason, and the exit code
 * is non-zero, so the runner's `set -e` stops the job.
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];

  if (!directory || !existsSync(join(directory, 'composer.json'))) {
    console.error(
      'usage: node scripts/releases/patch-pressedmail-webklex.mjs <plugin directory>',
    );
    process.exit(2);
  }

  const applied = patchPressedMailWebklex(directory);
  console.log(
    applied
      ? `PressedMail Webklex patches applied in ${directory}.`
      : `PressedMail Webklex in ${directory} needed no patch.`,
  );
}
