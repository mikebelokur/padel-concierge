import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="font-serif text-xl text-foreground">Something went wrong</div>
          <div className="text-sm text-muted-foreground max-w-sm">{this.state.message}</div>
          <Button
            variant="outline"
            className="border-white/10 mt-2"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
