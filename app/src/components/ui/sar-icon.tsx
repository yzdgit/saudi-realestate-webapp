import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function SarIcon({ className }: Props) {
  return (
    <span
      role="img"
      aria-label="SAR"
      className={cn(
        "inline-block h-4 w-4 shrink-0 bg-current align-middle",
        "[mask-image:url('/sar.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain]",
        "[-webkit-mask-image:url('/sar.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]",
        className
      )}
    />
  );
}
