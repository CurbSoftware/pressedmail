import { useId } from "react";

import { __ } from "@wordpress/i18n";
import { AlertCircle, BookOpen, KeyRound, LogIn } from "lucide-react";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
} from "@kit/ui/plugin";

import { BrandedProductMark } from "@/components/branding/BrandedProductMark";

import { PROVIDERS } from "@/components/setup/providers";
import type { ProviderKey, SetupFormData, SetupFormErrors } from "../types";

export interface ProviderAuthOptions {
  appPassword: boolean;
  oauth: "active" | "none";
}

type ProviderEntry = [ProviderKey, (typeof PROVIDERS)[ProviderKey]];

export interface StepProviderSelectProps {
  isEditing: boolean;
  formData: SetupFormData;
  errors: SetupFormErrors;
  visibleProviders: ProviderEntry[];
  /**
   * Pro only: second grid row (Yahoo / iCloud / Proton + optional WP Global
   * SMTP card). When omitted the single-grid layout is used (Free).
   */
  rowTwoProviders?: ProviderEntry[];
  /** Pro admins only: render the WP Global SMTP card in the second row. */
  disabledProviders?: ProviderKey[];
  comingSoonProviders?: ProviderKey[];
  /** Per-provider auth-method availability for the card action buttons. */
  getProviderAuthOptions?: (key: ProviderKey) => ProviderAuthOptions;
  /** Select a provider AND its auth method, then advance to credentials. */
  onSelectProviderWithMethod?: (
    key: ProviderKey,
    method: "oauth" | "password",
  ) => void;
}

export function StepProviderSelect({
  isEditing,
  errors,
  visibleProviders,
  rowTwoProviders,
  disabledProviders = [],
  comingSoonProviders = [],
  getProviderAuthOptions,
  onSelectProviderWithMethod,
}: StepProviderSelectProps) {
  const providerLabelPrefix = useId();
  const disabledProviderSet = new Set(disabledProviders);
  const comingSoonProviderSet = new Set(comingSoonProviders);

  const renderProviderCard = ([key, provider]: ProviderEntry) => {
    const providerLabelId = `${providerLabelPrefix}-${key}`;
    const Icon = provider.icon;
    const isDisabled = disabledProviderSet.has(key);
    const isComingSoon = comingSoonProviderSet.has(key);
    const authOptions = getProviderAuthOptions?.(key);
    const hasAuthButtons =
      !isDisabled &&
      Boolean(onSelectProviderWithMethod) &&
      Boolean(authOptions) &&
      (authOptions!.appPassword || authOptions!.oauth !== "none");

    return (
      <Card
        key={key}
        data-test={`provider-${key}`}
        role="group"
        aria-labelledby={providerLabelId}
        className="relative cursor-default border border-border transition-colors">
        <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
          {__IS_PRO__ && (isComingSoon || provider.experimental) ? (
            <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
              {isComingSoon ? (
                <div
                  data-test="provider-coming-soon-badge"
                  data-testid="provider-coming-soon-badge"
                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {__("Coming soon", "pressedmail")}
                </div>
              ) : null}
              {provider.experimental ? (
                <div className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {__("Experimental", "pressedmail")}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="w-10 h-10 flex items-center justify-center text-foreground">
            {key === "custom" ? (
              <BrandedProductMark
                variant="square"
                showName={false}
                imageClassName="h-10 w-10"
              />
            ) : (
              <Icon className="w-10 h-10" aria-hidden="true" />
            )}
          </div>
          <span
            id={providerLabelId}
            className="font-semibold text-sm text-center text-foreground">
            {provider.name}
          </span>

          {hasAuthButtons && authOptions ? (
            <div className="mt-1 flex w-full flex-col gap-1.5">
              {authOptions.appPassword ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full cursor-pointer text-xs"
                  data-test={`provider-${key}-app-password`}
                  onClick={() => {
                    onSelectProviderWithMethod?.(key, "password");
                  }}>
                  <KeyRound className="mr-1.5 size-3.5" aria-hidden="true" />
                  {key === "custom"
                    ? __("Set up", "pressedmail")
                    : __("App password", "pressedmail")}
                </Button>
              ) : null}

              {authOptions.oauth === "active" ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8 w-full cursor-pointer text-xs"
                  data-test={`provider-${key}-oauth`}
                  onClick={() => {
                    onSelectProviderWithMethod?.(key, "oauth");
                  }}>
                  <LogIn className="mr-1.5 size-3.5" aria-hidden="true" />
                  {key === "outlook"
                    ? __("Sign in with Microsoft", "pressedmail")
                    : key === "gmail"
                      ? __("Sign in with Google", "pressedmail")
                      : __("Sign in with OAuth", "pressedmail")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {provider.docUrl ? (
            <a
              href={provider.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-test={`provider-${key}-docs`}
              className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <BookOpen className="size-3.5" aria-hidden="true" />
              {__("Setup docs", "pressedmail")}
              <span className="sr-only">
                {__("(opens in a new tab)", "pressedmail")}
              </span>
            </a>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">
          {isEditing
            ? __("Edit email account", "pressedmail")
            : __("Add an email account", "pressedmail")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {__(
            "Select your email provider or enter a custom one.",
            "pressedmail",
          )}
        </p>
      </div>

      {rowTwoProviders ? (
        <>
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-test="provider-grid-row-one"
            data-testid="provider-grid-row-one">
            {visibleProviders.map(renderProviderCard)}
          </div>
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-test="provider-grid-row-two"
            data-testid="provider-grid-row-two">
            {rowTwoProviders.map(renderProviderCard)}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProviders.map(renderProviderCard)}
        </div>
      )}

      {errors.provider && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.provider}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
