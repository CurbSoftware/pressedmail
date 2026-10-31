# Building PressedMail (free) from source

The PressedMail admin interface is a React application compiled with Vite.
The WordPress plugin ships the compiled output in `assets/admin/dist/`;
this tree is the complete, human-readable source that produces those
files, as required by the WordPress.org Plugin Directory.

Canonical location: https://github.com/CurbSoftware/pressedmail
Public tag: `v1.8.5`

## Layout

- `apps/wp-pressedmail/`: the plugin admin SPA (TypeScript/React) and its
  Vite/webpack/Tailwind build configuration.
- `packages/` and `tooling/`: first-party `@kit/*` workspace packages
  (`@kit/ui`, `@kit/plate`, `@kit/theme-system`, `@kit/shared`,
  `@kit/tsconfig`) that the free build compiles from source, included
  in-tree. Third-party dependencies are resolved from the public npm
  registry; versions are pinned by `pnpm-workspace.yaml` (catalog) and
  `pnpm-lock.yaml`.

## Toolchain

- Node.js 22.13 or later. `.nvmrc` pins the version used
  here, and the pinned pnpm refuses to run on anything older.
- pnpm 11 (exact version pinned via `packageManager` in `package.json`;
  `corepack enable` fetches it)
- Vite (admin SPA); webpack via `@wordpress/scripts` for the block sources
  noted below
- React 19, TypeScript, Tailwind CSS v4

## Build steps

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

`pnpm-lock.yaml` is committed, so `--frozen-lockfile` installs the exact
dependency versions the shipped bundle was compiled from. Installing
without it lets every range float, because `.npmrc` sets
`resolution-mode=highest`.

The build writes the compiled, hashed free-variant assets to
`apps/wp-pressedmail/plugin-files/assets/admin/dist/`. Those are the
exact files shipped in the free plugin zip. The same command also
compiles the Gutenberg block sources under `src/blocks/` into
`assets/blocks/`; the plugin does not register or ship those blocks, so
that output is not part of the package. No build step downloads or
executes remote code.

## PHP and Composer

This tree is the source for the compiled admin interface. The plugin PHP
ships read as-is in the plugin zip: there is nothing to compile, and the
`includes/`, `database/` and `libs/` files in the zip are the files the
plugin runs.

Those files load the Composer `vendor/` tree the zip also ships, and one
vendored library in it is patched before the zip is written. The package
builder applies
`scripts/releases/patches/webklex-6.2.0-imap-values.patch` to
`webklex/php-imap` 6.2.0 through
`scripts/releases/patch-pressedmail-webklex.mjs`, after its own
`composer install`. It changes only
`ImapProtocol::decodeLine`, whose upstream form splits a quoted string
on spaces alone and so merges BODYSTRUCTURE and ENVELOPE values that end
just before `)`, or that sit either side of a `)(` list boundary.
It also applies `scripts/releases/patches/webklex-6.2.0-connection-window.patch`,
which lets `Client::isConnected()` trust a session that logged in or
answered a NOOP within the last minute instead of sending a NOOP before
almost every command.

The zip ships that `vendor/` tree. To assemble the same one from this
tree, from the repository root:

```sh
cd apps/wp-pressedmail/plugin-files
COMPOSER=composer-free.json composer install --no-dev --optimize-autoloader
```

`composer-free.json` is the file the Free zip renames to `composer.json`;
`composer-free.lock` pins every version, so the install is the tree the zip
ships. One of those dependencies, `curbsoftware/wp-eloquent`, comes from
`packages/curbsoftware/composer/curb-wp-eloquent` in this repository rather
than from Packagist, which is what the `path` repository in
`composer-free.json` points at.

The two files this tree cannot reproduce are the webklex/php-imap patches:
the install above gives the upstream 6.2.0 files, and the packaging step
rewrites them afterwards. The zip ships the patched files, and
`scripts/releases/patch-pressedmail-webklex.mjs` records their SHA-256 as
`PATCHED_FILE_SHA256` and `CLIENT_PATCHED_FILE_SHA256`, so a distributed
copy can be checked against the reviewed bytes without running Composer.

The diff, its rationale and the licensing note are published in
`scripts/releases/patches/`, alongside Webklex's MIT license. The
regression fixture and test named in that note check the change in the
development tree and are not part of this one.

Webklex's file attribution and the vendor LICENSE are unchanged in the
zip.

## Third-party assets

- The bundled `wired-*.woff2` fonts are the OpenDyslexic typeface (used for
  the optional dyslexia-friendly reading mode), licensed under the SIL Open
  Font License 1.1. See `apps/wp-pressedmail/src/assets/fonts/OFL.txt`.
- The PDF preview ships pdf.js 6.3.289 (Apache-2.0) as upstream built it,
  unmodified, in `assets/pdfjs/` of the plugin package, together with its JBIG2
  and OpenJPEG wasm decoders, six CJK character maps and the Symbol and
  Dingbats fonts. Their source is https://github.com/mozilla/pdf.js. The
  package carries the licence files, and `THIRD-PARTY-NOTICES.txt` lists them.
  The page side that talks to the sandboxed frame is `src/components/inbox/
  attachment-preview/pdf-sandbox/` in this repository.
