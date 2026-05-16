"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MultiComboboxOption = {
  value: string;
  label: string;
};

type Props = {
  options: MultiComboboxOption[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  clearLabel: string;
  disabled?: boolean;
  triggerClassName?: string;
};

export function MultiCombobox({
  options,
  values,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  disabled,
  triggerClassName
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabels = useMemo(() => {
    if (values.length === 0) return null;
    const labelMap = new Map(options.map((opt) => [opt.value, opt.label]));
    return values.map((value) => labelMap.get(value) ?? value);
  }, [options, values]);

  const summary =
    selectedLabels === null
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels[0]} +${selectedLabels.length - 1}`;

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
    } else {
      onChange([...values, value]);
    }
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || options.length === 0}
            className={cn(
              "w-full justify-between bg-surface-3/40 px-3 font-normal",
              values.length === 0 && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate text-start">{summary}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = values.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.value}`}
                      onSelect={() => toggle(option.value)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-sm border",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        )}
                        aria-hidden
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </div>
                      <span className="flex-1 truncate">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {values.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="absolute end-9 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          aria-label={clearLabel}
          title={clearLabel}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
