# `@kit/ui` core helpers

First-party components, written for this repository and distributed under the
same GPL-2.0-or-later terms as the PressedMail plugin.

They exist because the PressedMail WordPress plugin ships its compiled bundle,
and its readable source, to the WordPress.org Plugin Directory. Everything it
compiles has to have a licence somebody can point at. `src/makerkit/` does not:
it descends from the MakerKit SaaS starter and no grant for GPL redistribution
is on file. So the plugin's build inputs use these instead.

The rule is simple. If the PressedMail plugin build reaches a file in this
package, that file may not import from `src/makerkit/` or `src/marketing/`.
`scripts/releases/export-free-source.mjs` drops both subtrees from the public
Free source repository, and its test fails on a surviving import.

The websites keep using `src/makerkit/`. They are not redistributed, so the
question does not arise there.

Provenance for everything the plugin ships:
`apps/wp-pressedmail/THIRD-PARTY-PROVENANCE.md`.
