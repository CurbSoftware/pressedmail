/**
 * The single Umami event vocabulary for every PMCPPN website.
 *
 * Adding a name here is a deliberate act: `events.test.ts` asserts the full
 * list against an inline copy, so a new event cannot arrive by accident. That
 * is the cardinality gate. Umami's dashboards degrade once the number of
 * distinct event names grows without bound.
 *
 * ## Naming
 *
 * snake_case, `<object>_<past tense verb>`, 50 characters or fewer. Umami
 * rejects longer names outright.
 *
 * ## Two ways to emit, and they behave differently
 *
 * - **Declarative**: `data-umami-event` / `data-umami-event-<key>` attributes,
 *   built with {@link umamiClick}. Umami's own click handler reads these
 *   straight off the DOM. Works in server components and ships no JavaScript.
 * - **Imperative**: `trackUmamiEvent()` from `./track.ts`, for anything that
 *   is not a click: async outcomes, Radix state callbacks, observers.
 *
 * The difference that catches people out: **declarative events never receive
 * the injected global properties** (`product`, `path`), because Umami reads the
 * attributes without consulting our code. Declarative payloads must therefore
 * be self-describing, and cross-product segmentation comes from the
 * session-scoped `identify()` call the marketing runtime makes on mount.
 *
 * @see https://umami.is/docs/track-events
 */
export const UMAMI_EVENTS = {
  // ---------------------------------------------------------------- navigation
  navLinkClicked: 'nav_link_clicked',
  navMenuOpened: 'nav_menu_opened',
  footerLinkClicked: 'footer_link_clicked',
  bannerClicked: 'banner_clicked',
  bannerDismissed: 'banner_dismissed',

  // ---------------------------------------------------------------- engagement
  ctaClicked: 'cta_clicked',
  sectionViewed: 'section_viewed',
  scrollDepthReached: 'scroll_depth_reached',
  faqOpened: 'faq_opened',
  tabSelected: 'tab_selected',
  outboundLinkClicked: 'outbound_link_clicked',
  fileDownloaded: 'file_downloaded',
  contactLinkClicked: 'contact_link_clicked',
  chatbotOpened: 'chatbot_opened',
  chatbotMessageSent: 'chatbot_message_sent',
  chatbotClosed: 'chatbot_closed',
  pageNotFound: 'page_not_found',
  cookieConsentDecided: 'cookie_consent_decided',

  // --------------------------------------------------------------------- video
  videoPlayed: 'video_played',
  videoPaused: 'video_paused',
  videoProgress: 'video_progress',
  videoCompleted: 'video_completed',
  videoPreviewOpened: 'video_preview_opened',
  /** Emitted by the shared hero section when its video modal opens. */
  videoOpened: 'video_opened',

  // ---------------------------------------------------------- pricing/checkout
  pricingIntervalToggled: 'pricing_interval_toggled',
  pricingSelected: 'pricing_selected',
  checkoutEmailSubmitted: 'checkout_email_submitted',
  checkoutEmailRejected: 'checkout_email_rejected',
  checkoutCompleted: 'checkout_completed',
  checkoutFailed: 'checkout_failed',
  cryptoCheckoutOpened: 'crypto_checkout_opened',
  cryptoInvoiceCreated: 'crypto_invoice_created',
  cryptoInvoicePaid: 'crypto_invoice_paid',
  cryptoInvoiceExpired: 'crypto_invoice_expired',
  cryptoAddressCopied: 'crypto_address_copied',
  appsumoActivationSubmitted: 'appsumo_activation_submitted',
  appsumoActivationFailed: 'appsumo_activation_failed',

  // --------------------------------------------------------------------- forms
  formSubmitted: 'form_submitted',
  formSucceeded: 'form_succeeded',
  formFailed: 'form_failed',
  newsletterFormSubmitted: 'newsletter_form_submitted',
  newsletterSubscribed: 'newsletter_subscribed',
  newsletterFailed: 'newsletter_failed',
  // Two form events predate the `form_submitted` + `form-id` convention and
  // already have history in the live dashboards. Kept as-is; do not add more
  // per-form names.
  siteGateContactFormSubmitted: 'site_gate_contact_form_submitted',
  testimonialOfferFormSubmitted: 'testimonial_offer_form_submitted',

  // ---------------------------------------------------------------------- auth
  signInAttempted: 'sign_in_attempted',
  signInSucceeded: 'sign_in_succeeded',
  signInFailed: 'sign_in_failed',
  signUpAttempted: 'sign_up_attempted',
  signUpSucceeded: 'sign_up_succeeded',
  signUpFailed: 'sign_up_failed',
  magicLinkRequested: 'magic_link_requested',
  magicLinkFailed: 'magic_link_failed',
  otpRequested: 'otp_requested',
  otpVerified: 'otp_verified',
  otpFailed: 'otp_failed',
  passwordResetRequested: 'password_reset_requested',
  passwordResetFailed: 'password_reset_failed',
  passwordUpdated: 'password_updated',
  passwordUpdateFailed: 'password_update_failed',
  mfaChallengeStarted: 'mfa_challenge_started',
  mfaVerified: 'mfa_verified',
  mfaFailed: 'mfa_failed',
  oauthRedirectStarted: 'oauth_redirect_started',
} as const;

export type UmamiEventName = (typeof UMAMI_EVENTS)[keyof typeof UMAMI_EVENTS];

/**
 * Bounded failure codes. A `reason` property must always be one of these.
 * never a raw Supabase or network error string, which would leak user input
 * into analytics and blow up property cardinality.
 */
export const UMAMI_FAILURE_REASONS = {
  invalidCredentials: 'invalid_credentials',
  invalidInput: 'invalid_input',
  rateLimited: 'rate_limited',
  captcha: 'captcha',
  network: 'network',
  expired: 'expired',
  notFound: 'not_found',
  alreadyExists: 'already_exists',
  cancelled: 'cancelled',
  unknown: 'unknown',
} as const;

export type UmamiFailureReason =
  (typeof UMAMI_FAILURE_REASONS)[keyof typeof UMAMI_FAILURE_REASONS];

/**
 * How a visitor authenticated. Kept to a closed set so the dashboard can
 * segment sign-in success by method without free-text values.
 */
export const UMAMI_AUTH_METHODS = {
  password: 'password',
  magicLink: 'magic_link',
  otp: 'otp',
  oauth: 'oauth',
} as const;

export type UmamiAuthMethod =
  (typeof UMAMI_AUTH_METHODS)[keyof typeof UMAMI_AUTH_METHODS];
