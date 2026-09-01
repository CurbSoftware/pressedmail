/**
 * Phishing Detection Types
 *
 * TypeScript types for phishing detection feature.
 *
 * @since 1.6.0
 */

/**
 * Admin policy for phishing detection.
 * - 'allow': Users can configure their own settings
 * - 'force': All users must scan (scope is 'all')
 * - 'disable': Scanning is disabled for all users
 */
export type PhishingPolicy = "allow" | "force" | "disable";

/**
 * User scan scope options.
 * - 'all': Scan all emails
 * - 'new': Scan only unread emails
 * - 'none': Disable scanning
 */
export type ScanScope = "all" | "new" | "none";

/**
 * Risk factor types.
 */
export type RiskFactorType =
  | "typosquatting"
  | "name_mismatch"
  | "suspicious_subject"
  | "known_pattern"
  | "auth_failure"
  | "link_suspicious"
  | "image_mismatch"
  | "header_mismatch"
  | "reply_to_mismatch"
  | "hidden_text"
  | "prompt_injection"
  | "body_social_engineering"
  | "attachment_suspicious";

/**
 * Risk factor severity levels.
 */
export type RiskSeverity = "low" | "medium" | "high";

/**
 * Final phishing verdict.
 */
export type PhishingVerdict = "safe" | "caution" | "danger";

/**
 * Explicit phishing suspect level.
 */
export type PhishingSuspectLevel = "low" | "medium" | "high";

/**
 * Status of an individual analysis step.
 */
export type PhishingAnalysisStepStatus =
  | "safe"
  | "warning"
  | "danger"
  | "skipped";

/**
 * Admin settings for phishing detection.
 */
export interface PhishingAdminSettings {
  enabled: boolean;
  has_api_key: boolean;
  is_admin_configured: boolean;
  connection_valid?: boolean;
  connection_validated_at?: string;
  base_url: string;
  model: string;
  system_prompt: string;
  policy: PhishingPolicy;
  auto_scan_enabled: boolean;
}

/**
 * Available model from the API.
 */
export interface PhishingModel {
  id: string;
  created?: number;
  owned_by?: string;
}

/**
 * Prompt data response.
 */
export interface PhishingPromptData {
  default_prompt: string;
  custom_prompt: string;
  active_prompt: string;
  is_custom: boolean;
}

/**
 * User settings for phishing detection.
 */
export interface PhishingUserSettings {
  enabled: boolean;
  policy: PhishingPolicy;
  scan_scope: ScanScope;
  effective_scope: ScanScope;
  auto_scan_enabled: boolean;
  can_configure: boolean;
}

/**
 * A single risk factor identified in an email.
 */
export interface RiskFactor {
  type: RiskFactorType;
  description: string;
  severity: RiskSeverity;
}

/**
 * Granular hidden-content / prompt-injection preflight checks.
 *
 * Emitted on the body-preflight step so the report can render a pass/fail
 * checklist of what the preflight scanned for before the body reached the LLM.
 */
export interface PhishingPreflightChecks {
  hidden_html_text: boolean;
  white_on_white_text: boolean;
  display_none_text: boolean;
  visibility_hidden_text: boolean;
  opacity_zero_text: boolean;
  zero_size_text: boolean;
  offscreen_text: boolean;
  color_matches_background: boolean;
  text_behind_element: boolean;
  html_comments_with_instructions: boolean;
  rtf_hidden_text: boolean;
  prompt_injection_phrases: boolean;
}

/**
 * A single attachment finding surfaced on the attachments analysis step.
 *
 * Metadata only. Attachment bytes are never sent to the analyzer or stored.
 */
export interface PhishingAttachmentFinding {
  filename: string;
  mime: string;
  size?: number;
  extension?: string;
  mime_mismatch?: boolean;
  high_risk_extension?: boolean;
}

/**
 * A single step in the phishing analysis pipeline.
 */
export interface PhishingAnalysisStep {
  key: string;
  label: string;
  status: PhishingAnalysisStepStatus;
  summary: string;
  findings: string[];
  /** Present on the body-preflight step: granular hidden-content checks. */
  checks?: Partial<PhishingPreflightChecks>;
  /** Present on the attachments step: per-attachment download-safety findings. */
  attachments?: PhishingAttachmentFinding[];
}

/**
 * Analysis result for a single email.
 */
export interface PhishingAnalysisResult {
  id?: number;
  account_id: number;
  message_id: string;
  sender_email: string;
  sender_domain: string;
  is_suspicious: boolean;
  suspect_level: PhishingSuspectLevel;
  risk_score: number;
  safety_rating?: number;
  verdict?: PhishingVerdict;
  risk_factors: RiskFactor[];
  summary?: string;
  recommended_action?: string;
  analysis_steps?: PhishingAnalysisStep[];
  analyzed_at: string | null;
  expires_at: string | null;
}

/**
 * API response for phishing settings.
 */
export interface PhishingSettingsResponse {
  status: "success" | "error";
  message?: string;
  settings?: PhishingUserSettings;
}

/**
 * API response for admin settings.
 */
export interface PhishingAdminSettingsResponse {
  status: "success" | "error";
  message?: string;
  settings?: PhishingAdminSettings;
}

/**
 * API response for single email analysis.
 */
export interface PhishingAnalyzeResponse {
  status: "success" | "error";
  message?: string;
  code?: string;
  data?: {
    result: PhishingAnalysisResult;
    cached: boolean;
    tokens_used?: number;
  };
}

/**
 * API response for batch analysis.
 */
export interface PhishingBatchAnalyzeResponse {
  status: "success" | "error";
  message?: string;
  data?: {
    results: Record<string, PhishingAnalysisResult>;
    total_analyzed: number;
    suspicious_count: number;
  };
}

/**
 * API response for models list.
 */
export interface PhishingModelsResponse {
  status: "success" | "error";
  message?: string;
  models?: PhishingModel[];
}

/**
 * API response for prompt data.
 */
export interface PhishingPromptResponse {
  status: "success" | "error";
  message?: string;
  data?: PhishingPromptData;
}

/**
 * API response for phishing status.
 */
export interface PhishingStatusResponse {
  status: "success" | "error";
  message?: string;
  data?: {
    results: Record<string, PhishingAnalysisResult>;
    suspicious_count: number;
  };
}

/**
 * Email data for phishing analysis.
 */
export interface PhishingEmailData {
  message_id: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  read?: boolean;
  message_uid?: string;
  html_body?: string;
  /** Attachment metadata (filename + MIME only) for download-safety analysis. */
  attachments?: Array<{ filename: string; mime: string; size?: number }>;
}
