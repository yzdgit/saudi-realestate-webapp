import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import type { LocaleMessages } from "@/lib/messages";

type Props = {
  messages: LocaleMessages;
};

export function AboutDialog({ messages }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={messages.about.trigger}
          title={messages.about.trigger}
        >
          <Info className="h-4 w-4" aria-hidden />
          <span className="sr-only">{messages.about.trigger}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{messages.about.title}</DialogTitle>
          <DialogDescription>{messages.about.body}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{messages.about.data_note}</p>
          <div className="rounded-md border border-border/60 bg-card/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {messages.about.tech_label}
            </p>
            <p className="mt-1 text-foreground">{messages.about.tech}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
