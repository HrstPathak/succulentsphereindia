"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback. A function receives (error, reset) so the UI can offer a "try again". */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Client-side error boundary so a crash inside a single admin panel section
 * (e.g. a raw object reaching JSX) can never unmount the whole dashboard.
 * Each wrapped section gets its own boundary so the rest of the page keeps
 * working while the offending section shows a recoverable fallback.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Keep the underlying error visible in the browser console for debugging.
    console.error("[admin] section crashed:", error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset);
      }
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="rounded-2xl border border-[#f0e2e2] bg-[#fdf7f5] p-6">
          <p className="font-bold text-[#b3574e]">This section failed to load.</p>
          <p className="mt-1 text-xs text-[#718076]">
            {String(this.state.error.message || this.state.error)}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded-lg border border-[#f0e2e2] px-3 py-1.5 text-xs font-bold text-[#b3574e] hover:bg-[#fbeceb]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
