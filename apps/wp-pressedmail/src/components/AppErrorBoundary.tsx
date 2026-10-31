import * as React from "react";
import { __ } from "@wordpress/i18n";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@kit/ui/plugin";

interface AppErrorBoundaryProps {
  /**
   * A contained fallback in place of the full-page one, for a part of the page
   * that can fail on its own. `retry` renders the children again.
   */
  fallback?: (retry: () => void) => React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary for the provider tree.
 * Catches unhandled exceptions in any provider or child component
 * and shows a full-page recovery UI instead of a white screen.
 */
export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren<AppErrorBoundaryProps>,
  AppErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<AppErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      "[PressedMail] Unhandled render error:",
      error,
      errorInfo,
    );
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback(this.retry);
    }
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center bg-background p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-semibold">
              {__("Something went wrong", "pressedmail")}
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                {this.state.error?.message ||
                  __("An unexpected error occurred.", "pressedmail")}
              </p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline">
                {__("Try Again", "pressedmail")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
