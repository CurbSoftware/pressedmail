# PressedMail third-party provenance

Where the code and assets in a PressedMail package came from, and under what
terms they ship.

npm and Composer dependencies are not listed individually here. Their versions
are pinned by `pnpm-lock.yaml` and `composer.lock`, their licences travel with
them, and the Composer tree ships in the ZIP with its `LICENSE` files intact.
What this file covers is everything else: code adapted from someone else's
project, code copied from a template, and assets with their own terms. Those are
the ones a reader cannot resolve from a lockfile, and the ones a licence audit
has to take somebody's word on unless it is written down.

The plugin itself is GPL-2.0-or-later. Every row below is GPL compatible.

One thing a lockfile cannot show is the global namespace a dependency occupies,
so the Composer tree's surface, its call sites and its unsafe-function
reachability are recorded in [The Composer tree's global surface](#the-composer-trees-global-surface)
below. That section is the one exception to the paragraph above.

## Provenance table

| Component | Where it lives | Origin | Licence | Evidence |
|---|---|---|---|---|
| WpApi router | `plugin-files/libs/API/{Route,Config,ApiRouteException}.php` | `haruncpi/wp-api` 1.0.1, adapted | CC BY 4.0 | Upstream `composer.json` declares `"license": "cc-by-4.0"`. The notice, author and upstream link are in each file header; `plugin-files/tests/test-third-party-attribution-contract.php` fails if they are dropped. |
| shadcn/ui components | `packages/ui/src/shadcn/*` | shadcn/ui, installed into this repository and then edited | MIT | shadcn/ui is distributed as source you copy into your project under MIT: https://github.com/shadcn-ui/ui/blob/main/LICENSE.md |
| Plate editor UI | `apps/wp-pressedmail/src/components/composer/plate/*` | Ports of the Plate template components, rewritten against PressedMail's own plugin kit | MIT | Plate and its templates: https://github.com/udecode/plate/blob/main/LICENSE. Each port names the template file it came from in its header comment. |
| `@kit/ui` core helpers | `packages/ui/src/core/*` | First-party, written for this repository | GPL-2.0-or-later | `if.tsx`, `trans.tsx` and `error-boundary.tsx` were written to replace the MakerKit-derived helpers the plugin build used to compile. `git log --follow` on each reports this repository as the first author. `scripts/releases/export-free-source.test.mjs` fails if a file here ever repeats an upstream body. See `packages/ui/src/core/README.md`. |
| `Spinner` | `packages/ui/src/shadcn/spinner.tsx` | shadcn/ui, unchanged | MIT | Covered by the shadcn/ui row above. It is listed separately because it was briefly copied into `src/core/` and called first-party. It was not: MakerKit's spinner is shadcn's spinner, and the plugin now re-exports shadcn's directly. |
| `isRouteActive` | `packages/ui/src/lib/utils/is-route-active.ts` | Rewritten over a MakerKit-derived file | GPL-2.0-or-later | The plugin compiles the `#lib/utils` barrel, and this is the other module in it. The ancestry is MakerKit's; the implementation is not. Upstream matched path segments against a `depth` argument, this matches a normalised prefix with optional regular expression and locale handling, and the file header says so. Diff for yourself: `git show caf88f9bf:packages/ui/src/makerkit/is-route-active.ts`. Rollup tree-shakes it out of the shipped bundle, because the plugin never calls it. |
| Provider glyphs | `apps/wp-pressedmail/src/components/Icons/providers/index.tsx` | First-party, drawn for this file | GPL-2.0-or-later | The set that used to be here was not first-party, whatever this table said: six coordinate systems across eight glyphs (`1100x1100`, `16.376`, `24x24`, `32x32` on three of them, `800x800`, and a negative-origin `-1.5 0 32 32`), lowercase `<title>gmail</title>` elements, Illustrator `.st0` classes, a hard-coded `fill="#000000"`. That is what icon-set exports from four different tools look like, and nobody could name the packs or their terms. All eight were redrawn on one 24x24 grid as plain geometry, in the commit that added this row. `providers.test.tsx` fails if a glyph arrives on a different grid or carries exporter markup again. None of them reproduces a service's logo; the services' own marks stay their owners' trademarks, and the glyphs label an account by the service it talks to. No endorsement is claimed or implied. |
| PressedMail brand art | `apps/wp-pressedmail/plugin-files/assets/images/*`, `packages/ui/src/core/pressed-mail-logo.tsx` | First-party | GPL-2.0-or-later for the files; PressedMail is CurbSoftware Inc.'s trademark | Drawn for this product. |
| OpenDyslexic | `plugin-files/assets/fonts/*.woff2` | OpenDyslexic, unmodified | SIL Open Font License 1.1 | `plugin-files/assets/fonts/OFL.txt` ships in the package. Name tables are unmodified, so the Reserved Font Name is intact. |
| DOMPurify | compiled into `assets/admin/dist/` | npm `dompurify` | Apache-2.0 or MPL-2.0 | The licence banner survives minification and is in the shipped bundle. |
| webklex/php-imap | `plugin-files/vendor/webklex/php-imap/`, with one patched file | Upstream 6.2.0, plus a local patch to `ImapProtocol::decodeLine` | MIT | The diff, the step that applies it, the reason and the upstream LICENSE are published at `scripts/releases/patches/`. The packager refuses any source but the reviewed 6.2.0 decoder hash. |
| highlight.js grammars | compiled into `assets/admin/dist/` | npm `highlight.js` | BSD-3-Clause | https://github.com/highlightjs/highlight.js/blob/main/LICENSE |
| WordPress React runtime | not bundled | WordPress core's registered `react`, `react-dom`, `wp-element` handles | GPL-2.0-or-later | The build externalises them; see `wp-dependencies.json` in the package. |

## MakerKit

This monorepo started from the MakerKit SaaS starter, and `packages/ui/src/makerkit/`
still carries components that descend from it. No grant for redistributing them
under the GPL is on file.

The plugin used to compile four of them: `if.tsx`, `spinner.tsx`, `trans.tsx` and
`error-boundary.tsx`. Three were replaced with the first-party equivalents in
`packages/ui/src/core/`. The fourth, `spinner.tsx`, turned out to be shadcn/ui's
spinner with a different default size, so the plugin re-exports shadcn's
directly rather than pretending a copy of it was written here. The plugin's
build inputs no longer reach `src/makerkit/` at all. `scripts/releases/export-free-source.mjs` drops that
subtree and `src/marketing/` from the public Free source repository, and fails
the export if anything that did ship still imports either.

The product websites still use `src/makerkit/`. They are hosted, not
redistributed, so the GPL question does not arise for them.

## The Composer tree's global surface

Thirteen vendor `files` autoload entries run on every request, before any
PressedMail code does: eight Illuminate and Symfony helper files that declare
functions in the root namespace (`illuminate/support` and `illuminate/collections`
each ship a `functions.php` and a `helpers.php`, plus `illuminate/reflection`,
`symfony/clock`, `symfony/translation` and `symfony/deprecation-contracts`), one
`curbsoftware/wp-eloquent` helper file, and four Symfony polyfills. The plugin's
own three entries (`libs/assets.php`, `libs/db.php`, `includes/functions.php`) sit
in the same map and are not counted here.

Counted from `vendor/composer/autoload_files.php` in the packaged Free build: 16
entries, 13 of them vendor.

That is worth writing down because Composer guards every one of those
declarations with `function_exists()`. Whichever plugin loads first defines the
name, and every other copy silently receives that implementation instead of its
own. The vendor *namespaces* fail louder: two active plugins that bundle
`Illuminate\Support\Collection` produce a fatal "Cannot declare class", not a
swap.

### What each package declares

Two of the entries declare into their own namespace, which is not a collision
with anything: `illuminate/support/functions.php` defines
`Illuminate\Support\{now,microseconds,…,defer}` and `symfony/clock` and
`symfony/translation` define `Symfony\Component\Clock\now` and
`Symfony\Component\Translation\t`. Neither is a global function.

| Package | Unprefixed global functions it declares |
|---|---|
| `illuminate/support` | 23: `append_config`, `blank`, `class_basename`, `class_uses_recursive`, `e`, `env`, `filled`, `fluent`, `laravel_cloud`, `literal`, `object_get`, `once`, `optional`, `preg_replace_array`, `retry`, `str`, `tap`, `throw_if`, `throw_unless`, `trait_uses_recursive`, `transform`, `windows_os`, `with` |
| `illuminate/collections` | 10: `collect`, `data_fill`, `data_forget`, `data_get`, `data_has`, `data_set`, `head`, `last`, `value`, `when` |
| `illuminate/reflection` | 2: `lazy`, `proxy` |
| `symfony/deprecation-contracts` | 1: `trigger_deprecation` |
| `curbsoftware/wp-eloquent` | 11, prefixed: `asdb_class_basename`, `asdb_class_uses_recursive`, `asdb_collect`, `asdb_data_get`, `asdb_data_set`, `asdb_head`, `asdb_last`, `asdb_tap`, `asdb_trait_uses_recursive`, `asdb_value`, `asdb_with` |
| `symfony/polyfill-php83` | 7: `json_validate`, `str_increment`, `str_decrement`, `mb_str_pad`, `stream_context_set_options`, `ldap_exop_sync`, `ldap_connect_wallet` |
| `symfony/polyfill-php84` | 15: `array_find`, `array_find_key`, `array_any`, `array_all`, `grapheme_str_split`, `mb_ucfirst`, `mb_lcfirst`, `mb_trim`, `mb_ltrim`, `mb_rtrim`, `bcceil`, `bcdivmod`, `bcfloor`, `bcround`, `fpow` |
| `symfony/polyfill-php85` | 6: `array_first`, `array_last`, `get_error_handler`, `get_exception_handler`, `locale_is_right_to_left`, `grapheme_levenshtein` |
| `symfony/polyfill-mbstring` | the `mb_*` string functions, when the mbstring extension is absent |

Every package in the tree is MIT, and each one's `LICENSE` file ships in the
ZIP's `vendor/` directory beside it. None of the 26 is a library WordPress Core
already provides or registers, so nothing here duplicates Core: Core's
PHPMailer, SimplePie, jQuery, Backbone, Underscore, Moment, hoverIntent,
imagesloaded, Masonry, clipboard and zxcvbn are all absent, and where the plugin
needs PHPMailer it autoloads Core's copy (`pressedmail.php`, the
`spl_autoload_register` block).

The four polyfills only declare a name PHP itself does not provide, and they
implement the documented behaviour, so a second copy of one is a no-op. Every
other package in the tree, `carbonphp/carbon-doctrine-types`,
`curbsoftware/wp-feature-gate`, `doctrine/inflector`, `illuminate/conditionable`,
`illuminate/contracts`, `illuminate/macroable`, `illuminate/pagination`,
`nesbot/carbon`, `psr/clock`, `psr/container`, `psr/simple-cache`,
`symfony/http-foundation`, `symfony/translation-contracts`, `voku/portable-ascii`
and `webklex/php-imap`, has no `files` autoload entry and declares nothing on
load.

### Which of them can actually collide

A name nothing calls cannot be swapped for a different implementation, because
there is no call to swap. Searching every `.php` file in the package, first-party
and vendor, for call sites outside docblocks and comments splits the list in two.

**Called by nothing in the package.** `collect`, `data_fill`, `data_forget`,
`head`, `last`, `when`, `append_config`, `class_uses_recursive`,
`trait_uses_recursive`, `throw_if`, `env`, `fluent`, `literal`, `object_get`,
`laravel_cloud`, `once`, `optional`, `preg_replace_array`, `retry`, `str`,
`transform`, `windows_os`, `with`, `lazy`, `proxy`, and all eleven `asdb_*`.
Three of those are called, but only from inside their own file, so they stay
here: `data_forget` from `data_forget()`, `trait_uses_recursive` from
`class_uses_recursive()`, `throw_if` from `throw_unless()`. Redefining any of
them cannot change what PressedMail does. The reverse still applies: if
PressedMail loads first, another plugin that expected to define `collect()`
itself is handed Illuminate's implementation instead.

**Called, and only from vendor internals.** `data_get` (24 call sites), `value`
(26), `tap` (20), `data_set` (8), `trigger_deprecation` (7), `blank` (3),
`class_basename` (3), `e` (2), `throw_unless` (2), `data_has` (1), `filled` (1).
Every call site is inside Illuminate or Symfony. PressedMail's own code calls
none of them. Here a foreign definition that loaded first is used *by
Illuminate*, so the failure mode is Illuminate behaving differently rather than
PressedMail behaving differently.

### Decision

Not scoped. Prefixing the tree (`php-scoper` or equivalent) rewrites class names
that this plugin passes as strings to `$wpdb`, to Eloquent relations and to
migrations, and proving that rewrite safe needs a runtime matrix across Free,
Pro and the three Beta sites. What is left after the split above is eleven
vendor-internal call sites and the namespace fatal, which needs another active
plugin bundling the same libraries before it can happen at all. The honest
trigger to revisit is a second CurbSoftware plugin that bundles `illuminate/*`,
because that is when the collision stops becoming hypothetical. Until then this
section is the record.

Be precise about how much of it is guarded. `test-third-party-attribution-
contract.php` asserts that every package name in the shipped lockfiles appears
somewhere in this document. That catches a package arriving or leaving with no
row. It does **not** check the inert/real classification, the namespace claims, or
the per-function inventory, so those are prose a reviewer has to verify rather
than a value a test defends. Stating the limit is the point: an earlier revision
of this paragraph said the test "keeps it current", which was true only of the
package list.

### `eval()` and `unserialize()` in the tree

Three vendor call sites the review asks about, each with the reason it is
unreachable:

| Call site | What reaches it | Verdict |
|---|---|---|
| `nesbot/carbon` `Traits/Mixin.php:127` — `eval(self::getAnonymousClassCodeForTrait($trait))` | `Carbon::mixin()`, which appears in this package only in docblocks | Unreachable. No caller anywhere in the tree. |
| `curbsoftware/wp-eloquent` `Events/CallQueuedListener.php:143` — `unserialize($this->data)` | A listener that `implements ShouldQueue`, handled from a queue. PressedMail registers no queued listener and runs no queue worker | Unreachable. |
| `symfony/http-foundation` `Session/Storage/MockFileSessionStorage.php:156` — `unserialize($data, ['allowed_classes' => true])` | Instantiating Symfony's mock session storage. It is a test double; nothing in the package instantiates it | Unreachable. |

`nesbot/carbon` also has `unserialize()` in `CarbonInterval.php:3317` and
`Traits/Serialization.php:93`. Both are `__unserialize()` bodies, so they need an
`unserialize()` call on a Carbon payload, and the package contains none.

PressedMail's own code has no `eval()`. Its ten `unserialize()` calls, in
`includes/Services/` and `database/Migrations/`, all pass
`['allowed_classes' => false]` (with `max_depth` on the two that parse option
rows), so an object in the payload becomes `__PHP_Incomplete_Class` rather than
an instance and no `__wakeup` or `__destruct` can run.

### Known npm advisories

`pnpm audit --prod` over this monorepo reports advisories against a lot of
packages, most of them through workspace members whose code no bundle contains.
Cross-referencing the audit against the package index in
`assets/admin/dist/THIRD-PARTY-NOTICES.txt` leaves three that are actually
compiled into the admin interface.

| Package | Version in the bundle | Advisory | Patched | Verdict |
|---|---|---|---|---|
| `react-router` | 6.30.6 | [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) open redirect via backslash in `<Link>` and `useNavigate` | >= 7.18.0, no 6.x fix | Unreachable |
| `react-router` | 6.30.6 | [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) constructor injection via `deserializeErrors()` in SSR hydration | >= 7.18.0, no 6.x fix | Unreachable |
| `@babel/runtime` | 7.28.6 | GHSA-968p-4wvh-cqc8, RegExp complexity in generated code | >= 7.26.10 | Already fixed in the shipped copy |
| `@platejs/core` | 53.0.7 | [GHSA-qrfj-mgw8-j9c6](https://github.com/advisories/GHSA-qrfj-mgw8-j9c6) HTML deserialization can trigger browser behaviour during parsing | >= 53.3.11 | Open, see below |

Neither react-router advisory is reachable here. The admin app builds a
`createHashRouter` over a constant route table, no route or navigation target is
derived from message or server data, and the app never runs through SSR, so
`window.__staticRouterHydrationData` is never set and `deserializeErrors()`
never runs. The upgrade to 7.x is a major-version change across 140 import
sites; that is a deliberate piece of work, not a remediation for an unreachable
advisory, so it is not being bundled into an unrelated fix.

The `@platejs/core` advisory is the one genuinely open item. It is a
same-major patch (53.0.7 to 53.3.11 or later), and it is left standing here
because the version is pinned in the workspace catalog, so moving it rewrites
the lockfile, pulls the matching `@platejs/*` peers forward and needs the editor
re-verified end to end. That is its own change, not a rider on this one.

`composer audit` on the shipped tree reports no advisories and no abandoned
packages.

## Keeping this honest

- `plugin-files/tests/test-third-party-attribution-contract.php` pins the
  upstream notice in the derived PHP, the credit in both readmes, and the rows
  above that name a specific project.
- `scripts/releases/export-free-source.test.mjs` proves the published Free
  source carries no MakerKit or marketing file, and no import of one. It also
  compares every `src/core/` body against the MakerKit and shadcn originals,
  because a directory that is dropped by path cannot catch a file copied out
  of it under a new name.
- `apps/wp-pressedmail/src/components/Icons/providers/providers.test.tsx` pins
  the provider glyphs to one grid and rejects the markup an icon-set export
  leaves behind.
- `scripts/wporg-audit.sh` runs the full WordPress.org compliance gate against
  the exact ZIP before it can be staged.

When you add a dependency that is not a plain npm or Composer package, or copy
code from anywhere, add a row. A licence nobody wrote down is a licence nobody
can check.
