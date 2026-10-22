=== PressedMail - Email Client, Inbox & Webmail ===
Contributors: curbsoftwareinc
Tags: email, email client, imap, smtp, webmail
Requires at least: 6.6
Tested up to: 7.1
Stable tag: 1.7.10
Requires PHP: 8.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A complete email client for WordPress. Read, compose, search and organize your existing mailbox from the dashboard.

== Description ==

**Read and manage your email without leaving WordPress.**

PressedMail turns your dashboard into an email workspace. Connect the mailbox you already have over IMAP and SMTP, then read, write, search and organize mail in WordPress. Your address and provider stay the same.

= A real email client inside WordPress =

* Read and reply from the dashboard.
* Compose in rich text, Markdown or plain text.
* Browse Inbox, Sent, Drafts, Trash and other folders.
* Follow threads and search your mail.
* Move, star and mark messages read, unread or important.
* Create email rules and custom tags to organize mail.
* Preview images and PDFs, download attachments, and send your own.
* Use it on desktop, tablet or phone.

= PressedMail Free =

PressedMail Free connects one mailbox per site and gives it the whole client: inbox, reading, composing, search, folders, tags, rules and mailbox management, with no subscription or time limit.

= PressedMail Pro, a separate edition =

Pro is for when one mailbox is not enough, or you want more done for you. It adds:

* Connect multiple mailboxes and read them in one combined inbox.
* AI tools and phishing checks, with your own provider or PressedMail AI: summaries, drafts, replies, spam and phishing warnings.
* Contacts and a calendar beside your mail, with an Add to calendar button on invitations.
* Auto-replies, scheduled send, snooze and undo send.
* More themes and layouts.
* Ultimate plan: shared inboxes, calendars and contact lists, white labelling with a brand theme.

Pro shares this interface; replacing Free with Pro keeps your accounts, settings and data. Pro is a separate GPL-compatible paid plugin, not part of this download. [See plans and pricing](https://pressedmail.com/pricing) or [read the documentation](https://pressedmail.com/docs).

= Security controls for reading email =

Mail opens in an isolated viewer with sanitized HTML. Remote images are blocked by default, so opening a message contacts no image server. WordPress permissions keep the mailbox with its owner.

= Use your existing email provider =

Any IMAP/SMTP account works where your host permits the connection. Setup offers Gmail (app password), Outlook, Hotmail and Custom Email for cPanel, Zoho Mail, Fastmail and similar. Microsoft accounts use Microsoft sign-in, the only method Microsoft 365 accepts for IMAP.

= Send WordPress site email through SMTP =

Password resets, notifications, receipts and other wp_mail() messages can go through SMTP, set up and tested under Settings, WordPress Email.

= WordPress integration =

On WordPress 6.9 and later, mail actions register as WordPress abilities for MCP Adapter agents and WP-CLI, with the same permission checks.

= No PressedMail account needed =

No license key required and no trial expiration. There is no telemetry, no analytics, no license checks and no custom update checks. Updates come from WordPress.org. Provider terms, limits and charges apply.

== Installation ==

1. In Plugins > Add New, search for PressedMail, install and activate it.
2. Open PressedMail in the sidebar and connect your mailbox.

PressedMail needs WordPress 6.6+, PHP 8.2+, and MySQL 5.7+ or MariaDB 10.2+ with named locks and the user metadata table on InnoDB. SQLite cannot finish mailbox setup. Site Health flags this under "PressedMail database requirements".

== Screenshots ==

1. Connect an account: provider, IMAP and SMTP details, test it.
2. The inbox: folders, labels, tags, search, reading pane.
3. Composing: rich text formatting and recipient controls.
4. On a phone: inbox, settings and compose toolbar.
5. Settings: accounts, signatures, email rules, security, WordPress email, diagnostics.
6. Calendar, contacts and layouts come from PressedMail Pro, the separate paid plugin.

== Privacy and External Services ==

Installing or activating sends no mail content or mailbox metadata to CurbSoftware or an AI service. Connections serve your configured accounts and your actions.

= Your IMAP and SMTP servers =

PressedMail connects to the IMAP host and port you configure to list folders, sync, search, read, move, flag or delete mail, sending your username or address, credential or OAuth token, and each command. The server returns folders, message IDs, senders, recipients, dates, subjects, headers, bodies, attachments, flags, labels and sync state.

Sending mail or a site notification gives your SMTP host your authentication, sender, recipients, subject, headers, body and attachments. Your provider's terms and privacy policy apply to both.

= Optional Microsoft sign-in =

Microsoft sign-in uses Microsoft's identity services and the PressedMail OAuth relay; password and app-password connections do not.

* https://pressedmail.com/oauth/microsoft/start receives the site URL, callback URL and nonce at sign-in.
* https://pressedmail.com/oauth/microsoft/redeem receives the one-time transfer code, site URL and same nonce after the redirect.
* https://pressedmail.com/oauth/microsoft/refresh receives the refresh token, site URL and a fresh nonce before the access token expires.

The relay returns mailbox identity, access and refresh tokens, scope and expiry, and never receives bodies, attachments or mailbox contents. Microsoft receives the sign-in data it requires.

[PressedMail terms](https://pressedmail.com/terms-of-service), [PressedMail privacy](https://pressedmail.com/privacy), [Microsoft terms](https://www.microsoft.com/servicesagreement), [Microsoft privacy](https://privacy.microsoft.com/privacystatement).

= Remote images =

Images are blocked by default. Showing one contacts its host, which may receive the URL, IP address, user agent, browser headers and cookies, and can tell the sender you viewed it. The host's terms and privacy policy apply.

= Video embeds in the composer =

Pasting a YouTube, Vimeo, Dailymotion, Youku or Coub link, or choosing Video, previews it in the provider's iframe. Nothing loads before that, sent mail carries only the link, and other links render as plain cards that load nothing. The iframe receives the video address, your IP address, user agent and any provider cookies already set; its terms and privacy policy apply.

* YouTube: https://www.youtube.com/; privacy: https://policies.google.com/privacy; terms: https://www.youtube.com/t/terms
* Vimeo: https://vimeo.com/; privacy: https://vimeo.com/privacy; terms: https://vimeo.com/terms
* Dailymotion: https://www.dailymotion.com/
* Youku: https://www.youku.com/
* Coub: https://coub.com/

= Local storage and sending logs =

Account settings, encrypted credentials or OAuth tokens, and synced mail live in your WordPress database or filesystem: every selectable folder (Junk, Trash, Drafts included) is synced with headers, metadata and bodies, with no count limit and no expiry. Turning off Store email on this site asks to confirm and removes cached mail. The site owner controls hosting, backups and retention.

Deleting the plugin keeps that data unless "Delete plugin data on uninstall" is on under Settings, then Data and uninstall.

Your browser keeps message content and mailbox lists in session storage until the tab closes. Drafts, account names, account choice and recent searches stay in local storage for the signed-in user until sign-out, readable by anyone using that browser profile, so avoid shared computers. Panel widths use a session cookie with no mail data.

Rich text and Markdown draft structure can live in the site database, bound to its owner and draft, and never enters sent mail. It stays until the draft is sent or deleted, the account is removed, a privacy erasure or uninstall purges it, or Store email on this site is turned off. Delete stored email retries failed cleanup.

The site email delivery log is off by default. Choose 30, 60 or 90 days to record date, first recipient, recipient count, subject, sender, mail server and result, never bodies, headers or attachments. Entries expire on schedule; you can clear or disable the log. A logged success means the server accepted the message, not that it arrived.

== Development ==

* [Source repository](https://github.com/CurbSoftware/pressedmail)
* [Source for version 1.7.10](https://github.com/CurbSoftware/pressedmail/tree/v1.7.10)
* [Build instructions for version 1.7.10](https://github.com/CurbSoftware/pressedmail/blob/v1.7.10/BUILD.md)

Use Node.js 22.13 or later and `corepack enable` for the pinned pnpm, then run `pnpm install --frozen-lockfile && pnpm build`. Output goes to `assets/admin/dist/`; Pro source is excluded.

PHP ships readable with its Composer vendor tree. One library's patch and licensing note are in the source repository.

React, ReactDOM and the JSX runtime come from WordPress. Libraries: Plate.js, Slate, Vite, Tailwind CSS, Radix UI, date-fns, Lodash, juice, unified, remark and micromark (MIT); highlight.js (BSD-3-Clause); DOMPurify (Apache-2.0 or MPL-2.0); shadcn/ui (MIT); pdf.js 6.3.289 (Apache-2.0, unmodified, in `assets/pdfjs/`; source: https://github.com/mozilla/pdf.js); WpApi routing (haruncpi/wp-api) by Harun (CC BY 4.0).

The build writes `assets/admin/dist/THIRD-PARTY-NOTICES.txt`, listing every bundled package with version, licence and notice. OpenDyslexic ships under the SIL Open Font License 1.1, in `assets/fonts/OFL.txt`.

Provenance of adapted files: https://github.com/CurbSoftware/pressedmail/blob/v1.7.10/apps/wp-pressedmail/THIRD-PARTY-PROVENANCE.md

== Changelog ==

Older releases: https://pressedmail.com/changelog

= 1.7.10 =
* Settings, campaign, template and form screens have a clearer card layout, roomier rows and tidier empty states.

= 1.7.9 =
* The composer toolbar settings include Show lines, which draws paragraph guides while you write.

= 1.7.8 =
* No change for the Free edition.

