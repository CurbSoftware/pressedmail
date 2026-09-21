'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children?: ReactNode;
  /** Rendered instead of the children once a render below has thrown. */
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches a render error below it and shows the fallback instead.
 *
 * React only offers this as a class component, so this is one. It does not
 * reset: a boundary that retried on its own would loop on a deterministic
 * error, so recovery is the caller's job, through a changed `key`.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public override state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render failed below an ErrorBoundary:', error, info);
  }

  public override render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
