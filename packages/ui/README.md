# UI - @kit/ui

This package is responsible for managing the UI components and styles across the app.

This package defines several sets of components:

- `src/shadcn`: shadcn/ui components, installed into this repository and then edited (MIT)
- `src/core`: first-party helpers, the only ones the PressedMail plugin build may reach
- `src/plugin`: the PressedMail plugin's own kit
- `src/makerkit` and `src/marketing`: components that descend from the MakerKit
  SaaS starter, used by the product websites only. The PressedMail plugin build
  and its public source export must not reach either; see
  `src/core/README.md` and `apps/wp-pressedmail/THIRD-PARTY-PROVENANCE.md`.

## Installing a shadcn/ui component

Please refer to the [shadcn/ui documentation](https://ui.shadcn.com/docs/components).