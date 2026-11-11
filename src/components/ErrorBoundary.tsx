"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Props {
  children: ReactNode;
  /** Optional title for the error card. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * React Error Boundary — catches render errors in subtrees and shows a recovery UI.
 * Place one around each major dashboard section so a broken widget never kills the page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production wire this to your error-tracking service (Sentry, etc.)
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    const { children, label = "Esta seção" } = this.props;

    if (!error) return children;

    return (
      <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div className="grid size-10 place-items-center rounded-lg border border-danger/30 bg-danger-soft text-danger-text">
          <RefreshCw className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">{label} encontrou um erro</p>
          <p className="mt-1 text-xs text-fg-subtle">
            {error.message || "Ocorreu um problema inesperado."}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => this.reset()}>
          Tentar de novo
        </Button>
      </Card>
    );
  }
}
