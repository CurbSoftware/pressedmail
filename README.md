# PressedMail (free): source

Human-readable source for the compiled admin interface shipped in the
PressedMail WordPress plugin (`assets/admin/dist/`), published to satisfy
the WordPress.org Plugin Directory's reviewable-source requirement.

Canonical location: https://git.curbsoftware.com/PressedMail/pressedmail-free
Monorepo source tag: `pressedmail-v1.0.20`

See [BUILD.md](./BUILD.md) for the toolchain and build steps.

```sh
pnpm install
pnpm build
```

This tree builds the FREE variant, and holds nothing else. It is
generated from the module list the free build itself reports, so every
file here is source for something in `assets/admin/dist/` and no code
from any other edition can reach it.
