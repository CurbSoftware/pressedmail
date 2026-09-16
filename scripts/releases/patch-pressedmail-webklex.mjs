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
export function assertPatchedFile(path) {
  const actual = fileHash(path);
  if (actual !== PATCHED_FILE_SHA256) {
    throw new Error(
      `The packaged Webklex decoder is not the reviewed file: expected ${PATCHED_FILE_SHA256}, found ${actual} in ${TARGET}.`,
    );
  }
}

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
  const target = join(directory, TARGET);
  const current = decoderHash(readFileSync(target, 'utf8'));
  if (current === PATCHED) return false;
  if (current !== ORIGINAL) {
    throw new Error(
      'Webklex decodeLine changed; review the PressedMail IMAP patch.',
    );
  }
  const startsFromReviewedUpstream = fileHash(target) === ORIGINAL_FILE_SHA256;
  // Git is already a release prerequisite. Apply atomically, without fuzzy matching.
  execFileSync('git', ['apply', '--check', PATCH], {
    cwd: directory,
    stdio: 'pipe',
  });
  execFileSync('git', ['apply', PATCH], { cwd: directory, stdio: 'pipe' });
  if (decoderHash(readFileSync(target, 'utf8')) !== PATCHED) {
    throw new Error(
      'The PressedMail IMAP patch did not produce the reviewed decoder.',
    );
  }
  if (startsFromReviewedUpstream) assertPatchedFile(target);
  return true;
}
