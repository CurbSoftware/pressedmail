# Building PressedMail (free) from source

The PressedMail admin interface is a React application compiled with Vite.
The WordPress plugin ships the compiled output in `assets/admin/dist/`;
this tree is the complete, human-readable source that produces those
files, as required by the WordPress.org Plugin Directory.

Canonical location: https://github.com/CurbSoftware/pressedmail
Monorepo source tag: `pressedmail-v1.0.27`

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

- Node.js 20+
- pnpm 11 (exact version pinned via `packageManager` in `package.json`)
- Vite (admin SPA); webpack via `@wordpress/scripts` for the block sources
  noted below
- React 19, TypeScript, Tailwind CSS v4

## Build steps

```sh
pnpm install
pnpm build
```

The build writes the compiled, hashed free-variant assets to
`apps/wp-pressedmail/plugin-files/assets/admin/dist/`. Those are the
exact files shipped in the free plugin zip. The same command also
compiles the Gutenberg block sources under `src/blocks/` into
`assets/blocks/`; the plugin does not register or ship those blocks, so
that output is not part of the package. No build step downloads or
executes remote code.

## Third-party assets

- The bundled `wired-*.woff2` fonts are the OpenDyslexic typeface (used for
  the optional dyslexia-friendly reading mode), licensed under the SIL Open
  Font License 1.1. See `apps/wp-pressedmail/src/assets/fonts/OFL.txt`.
