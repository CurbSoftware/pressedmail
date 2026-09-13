# Building PressedMail (free) from source

The PressedMail admin interface is a React application compiled with Vite.
The WordPress plugin ships the compiled output in `assets/admin/dist/`;
this tree is the complete, human-readable source that produces those
files, as required by the WordPress.org Plugin Directory.

Canonical location: https://github.com/CurbSoftware/pressedmail
Public tag: `v1.0.31`

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

This tree is the source for the compiled admin interface only. The
plugin's PHP needs no build step: the WordPress plugin zip ships its own
readable `includes/`, `database/` and `libs/` sources alongside the
Composer `vendor/` tree it loads.

## Third-party assets

- The bundled `wired-*.woff2` fonts are the OpenDyslexic typeface (used for
  the optional dyslexia-friendly reading mode), licensed under the SIL Open
  Font License 1.1. See `apps/wp-pressedmail/src/assets/fonts/OFL.txt`.
