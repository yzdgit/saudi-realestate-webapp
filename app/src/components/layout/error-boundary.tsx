import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  actionLabel: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("Render error captured by ErrorBoundary:", error);
    }
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <Card className="border-destructive/40 bg-card/80">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <p className="text-sm font-semibold">{this.props.title}</p>
            </div>
            <p className="text-sm text-muted-foreground">{this.props.description}</p>
            <Button variant="outline" size="sm" onClick={this.handleReload}>
              {this.props.actionLabel}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
