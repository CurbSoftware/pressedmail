# PressedMail Webklex 6.2.0 IMAP values

`webklex-6.2.0-imap-values.patch` changes only `ImapProtocol::decodeLine`.
The original parser terminates a quoted string only before a space or the end
of a line. Valid BODYSTRUCTURE and ENVELOPE strings commonly end immediately
before `)`. It then absorbs later MIME and recipient fields into one string.
Adjacent MIME lists can also use `)(` without a separating space.

The patch tokenizes list delimiters and quoted strings independently. It
unescapes the two quoted escape sequences, leaves atoms and NIL representation
unchanged, and preserves literal bytes without trimming or decoding them. The
existing tolerance for missing final list closers remains.

The package builder applies this patch after every Composer install or vendor
fallback, before pruning, integrity hashing and ZIP creation. It requires the
installed 6.2.0 version and the reviewed decoder hash, accepts an already patched
copy, and refuses other source. Nothing edits a live installation or the source
checkout's vendor directory. The shipped PHP remains readable, with Webklex's
original file attribution and vendor LICENSE unchanged. Webklex is MIT licensed:
https://github.com/Webklex/php-imap/blob/6.2.0/LICENSE

The tracked protocol fixture preserves the structure of an owned Beta 4 response,
with addresses and message IDs replaced by example values. Run the actual-vendor
regression after applying the patch to a temporary vendor copy:

```sh
php scripts/releases/fixtures/webklex-imap-values.php /path/to/vendor /path/to/patched/ImapProtocol.php
```

An optional third argument accepts a private saved protocol JSON for exact
response replay; set `PRESSEDMAIL_WEBKLEX_EXPECTED_RECIPIENT` to the independently
verified expected address for that run. No live mailbox address is in the fixture. The regression does no networking. It exercises the
real vendor decoder and the actual PressedMail structure/address consumers, plus
quoted delimiters, escaped quotes/backslashes, lists, flags and binary literals.
The existing vendor PEEK fetch fix is a separate driver change.

`node --test scripts/releases/patch-pressedmail-webklex.test.mjs` verifies source
and version refusal, idempotent fallback, a nested Git worktree, and the real
Free/Pro copy/patch/prune/hash/ZIP pipeline. Only Composer execution is stubbed in
that packaging fixture, for successful install, explicit vendor fallback and
failed-install fallback. All six ZIPs contain the patched source and unchanged
MIT license, and Pro integrity hashes cover the patched bytes. Set
`PRESSEDMAIL_WEBKLEX_TEST_VENDOR` to the installed 6.2.0 vendor tree to include the
actual-vendor ABI regression; it is explicitly reported as skipped when absent.
