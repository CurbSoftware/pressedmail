/**
 * Build-Time Feature Gate Components
 *
 * These gates use compile-time constants, enabling Vite's dead code
 * elimination to remove gated content from the bundle when features
 * are disabled.
 *
 * For runtime feature gates (based on license entitlements), use FeatureGate.tsx
 *
 * @since 3.0.0
 */

import type { ReactNode } from "react";

interface BuildTimeFeatureGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function isFreeBuild() {
  return typeof __IS_FREE__ === "boolean"
    ? __IS_FREE__
    : (
        globalThis as typeof globalThis & {
          __IS_FREE__?: boolean;
        }
      ).__IS_FREE__ === true;
}

// =============================================================================
// AI FEATURE GATES
// =============================================================================

/**
 * Gate for AI Settings feature.
 * Content is removed from bundle when __ENABLE_AI_SETTINGS__ is false.
 */
export function AISettingsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (isFreeBuild() || !__ENABLE_AI_SETTINGS__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for AI Drafting feature.
 */
export function AIDraftingGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (isFreeBuild() || !__ENABLE_AI_DRAFTING__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for AI Auto Tagger feature.
 */
export function AutoTaggerGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (isFreeBuild() || !__ENABLE_AI_AUTO_TAGGER__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for AI Inbox Organizer feature (Pro).
 */
export function AIInboxOrganizerGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (isFreeBuild() || !__ENABLE_AI_INBOX_ORGANIZER__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Smart Inbox feature (Pro).
 */
export function SmartInboxGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (isFreeBuild() || !__ENABLE_SMART_INBOX__) return <>{fallback}</>;
  return <>{children}</>;
}

// =============================================================================
// CALENDAR FEATURE GATES
// =============================================================================

/**
 * Gate for basic Calendar feature (Free).
 */
export function CalendarBasicGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CALENDAR_BASIC__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Calendar Sync feature (Pro).
 */
export function CalendarSyncGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CALENDAR_SYNC__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Calendar Recurring Events feature (Pro).
 */
export function CalendarRecurringGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CALENDAR_RECURRING__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Calendar Free/Busy feature (Pro).
 */
export function CalendarFreebusyGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CALENDAR_FREEBUSY__) return <>{fallback}</>;
  return <>{children}</>;
}

// =============================================================================
// CONTACTS FEATURE GATES
// =============================================================================

/**
 * Gate for basic Contacts feature (Free).
 */
export function ContactsBasicGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CONTACTS_BASIC__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Contact Lists feature (Pro).
 */
export function ContactListsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CONTACT_LISTS__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Contact Activities feature (Pro).
 */
export function ContactActivitiesGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CONTACT_ACTIVITIES__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Contact Custom Fields feature (Pro).
 */
export function ContactCustomFieldsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CONTACT_CUSTOM_FIELDS__) return <>{fallback}</>;
  return <>{children}</>;
}

// =============================================================================
// PRO UI FEATURE GATES
// =============================================================================

/**
 * Gate for Pro Themes feature.
 * Content is removed from bundle when __ENABLE_THEMES__ is false.
 */
export function ThemesGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_THEMES__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Pro Layouts feature.
 * Content is removed from bundle when __ENABLE_LAYOUTS__ is false.
 */
export function LayoutsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_LAYOUTS__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Custom Themes feature (Pro).
 */
export function CustomThemesGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_CUSTOM_THEMES__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Mobile Layouts feature (Free).
 */
export function MobileLayoutsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_MOBILE_LAYOUTS__) return <>{fallback}</>;
  return <>{children}</>;
}

// =============================================================================
// PRODUCTIVITY FEATURE GATES
// =============================================================================

/**
 * Gate for Scheduled Emails feature.
 */
export function ScheduledEmailsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_SCHEDULED_EMAILS__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Snippets feature (Pro).
 */
export function SnippetsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_SNIPPETS__) return <>{fallback}</>;
  return <>{children}</>;
}

// =============================================================================
// NOTIFICATIONS FEATURE GATES
// =============================================================================

/**
 * Gate for WP Admin Bar Notifications feature (Pro).
 */
export function WpAdminBarNotificationsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_WP_ADMIN_BAR_NOTIFICATIONS__) return <>{fallback}</>;
  return <>{children}</>;
}

// =============================================================================
// DEVELOPER FEATURE GATES
// =============================================================================

/**
 * Gate for API & Webhooks feature (Pro).
 */
export function ApiWebhooksGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_API_WEBHOOKS__) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Gate for Audit Logs feature (Pro).
 */
export function AuditLogsGate({
  children,
  fallback = null,
}: BuildTimeFeatureGateProps) {
  if (!__ENABLE_AUDIT_LOGS__) return <>{fallback}</>;
  return <>{children}</>;
}

// =============================================================================
// GENERIC BUILD-TIME FEATURE GATE
// =============================================================================

/**
 * Props for the generic BuildTimeFeatureFlag component.
 */
interface BuildTimeFeatureFlagProps extends BuildTimeFeatureGateProps {
  /** The feature flag to check */
  flag: boolean;
}

/**
 * Generic build-time feature flag gate.
 * Use this for one-off feature checks where a dedicated gate doesn't exist.
 *
 * @example
 * <BuildTimeFeatureFlag flag={__ENABLE_SOME_FEATURE__}>
 *   <SomeFeatureComponent />
 * </BuildTimeFeatureFlag>
 */
export function BuildTimeFeatureFlag({
  flag,
  children,
  fallback = null,
}: BuildTimeFeatureFlagProps) {
  if (!flag) return <>{fallback}</>;
  return <>{children}</>;
}
