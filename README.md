# PressedMail (free): source

Human-readable source for the compiled admin interface shipped in the
PressedMail WordPress plugin (`assets/admin/dist/`), published to satisfy
the WordPress.org Plugin Directory's reviewable-source requirement.

Canonical location: https://github.com/CurbSoftware/pressedmail
Public tag: `v1.3.2`

See [BUILD.md](./BUILD.md) for the toolchain and build steps.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

This tree builds the FREE variant, and holds nothing else. No code from
any other edition can reach it.

The plugin app under `apps/wp-pressedmail/` is generated from the module
list the free build itself reports, so every file there is source for
something in `assets/admin/dist/` (plus the small Gutenberg block
sources the same build compiles but the plugin does not ship). The
workspace packages under `packages/` are vendored whole, minus the
subtrees the build never reaches, so a few of their files are here for
the package to be coherent rather than because the bundle needs them.
They are shadcn/ui (MIT) or first-party; see
`apps/wp-pressedmail/THIRD-PARTY-PROVENANCE.md` for the rest.

Two things here are records rather than source.
`scripts/releases/patches/` holds the diff for the one vendored Composer
library the plugin zip ships patched, so the shipped bytes can be checked
against it; see the PHP and Composer section of
[BUILD.md](./BUILD.md). And
`apps/wp-pressedmail/THIRD-PARTY-PROVENANCE.md` says where the adapted
code and the licensed assets in the package came from.
