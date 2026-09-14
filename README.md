# PressedMail (free): source

Human-readable source for the compiled admin interface shipped in the
PressedMail WordPress plugin (`assets/admin/dist/`), published to satisfy
the WordPress.org Plugin Directory's reviewable-source requirement.

Canonical location: https://github.com/CurbSoftware/pressedmail
Public tag: `v1.0.32`

See [BUILD.md](./BUILD.md) for the toolchain and build steps.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

This tree builds the FREE variant, and holds nothing else. It is
generated from the module list the free build itself reports, so every
file here is source for something in `assets/admin/dist/` (plus the
small Gutenberg block sources the same build compiles but the plugin
does not ship) and no code from any other edition can reach it.
