import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, Building2, Compass, Globe2, List, Map as MapIcon } from "lucide-react";
import type { ExplorerMode } from "@/lib/explorer-mode";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ExplorerPage = "listings" | "map";

type ExplorerShellProps = {
  locale: Locale;
  messages: LocaleMessages;
  activePage: ExplorerPage;
  mode: ExplorerMode;
  onModeChange: (mode: ExplorerMode) => void;
  showModeToggle?: boolean;
  title: string;
  description: string;
  filterPanelDesktop: React.ReactNode;
  filterPanelMobile?: React.ReactNode;
  activeFilterChips?: React.ReactNode;
  statsRow?: React.ReactNode;
  children: React.ReactNode;
  hrefQuery?: Record<string, string>;
};

type IconOption = {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function localeLinkFromAsPath(asPath: string, targetLocale: Locale): string {
  const [path, queryHash] = asPath.split("?");
  const pathParts = path.split("/").filter(Boolean);

  if (pathParts.length === 0) {
    return `/${targetLocale}/`;
  }

  pathParts[0] = targetLocale;

  return `/${pathParts.join("/")}${queryHash ? `?${queryHash}` : ""}`;
}

function IconRadioGroup({
  value,
  options,
  onChange
}: {
  value: string;
  options: IconOption[];
  onChange: (value: string) => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;

        return (
          <label key={option.value} className="cursor-pointer">
            <RadioGroupItem value={option.value} className="peer sr-only" />
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
                "hover:bg-secondary/70 hover:text-foreground",
                isActive && "border-border/80 bg-secondary text-foreground"
              )}
              aria-label={option.label}
              title={option.label}
            >
              <Icon className="h-4 w-4" />
              <span className="sr-only">{option.label}</span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

export function ExplorerShell({
  locale,
  messages,
  activePage,
  mode,
  onModeChange,
  showModeToggle = true,
  title,
  description,
  filterPanelDesktop,
  filterPanelMobile,
  activeFilterChips,
  statsRow,
  hrefQuery,
  children
}: ExplorerShellProps) {
  const router = useRouter();

  const oppositeLocale: Locale = locale === "ar" ? "en" : "ar";
  const localeSwitchLink = localeLinkFromAsPath(router.asPath, oppositeLocale);

  const mergedQuery = useMemo(
    () => ({
      locale,
      ...hrefQuery
    }),
    [hrefQuery, locale]
  );

  const navigateTo = useCallback(
    (pathname: "/[locale]/listings" | "/[locale]/map") => {
      void router.push(
        {
          pathname,
          query: mergedQuery
        },
        undefined,
        { scroll: false }
      );
    },
    [mergedQuery, router]
  );

  const viewStyleValue = activePage === "map" ? "map" : "listings";
  const viewLevelValue = mode;

  const viewStyleOptions: IconOption[] = [
    {
      value: "listings",
      label: messages.navigation.listings,
      icon: List
    },
    {
      value: "map",
      label: messages.navigation.map,
      icon: MapIcon
    }
  ];

  const viewLevelOptions: IconOption[] = [
    {
      value: "browse",
      label: messages.navigation.browse,
      icon: Compass
    },
    {
      value: "analyze",
      label: messages.navigation.analyze,
      icon: BarChart3
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-[1100] border-b border-border/70 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 lg:px-6">
          <div className="flex items-center justify-start">
            {filterPanelMobile ? <div className="w-[154px] lg:hidden">{filterPanelMobile}</div> : null}
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/95">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-card text-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <span>{messages.home.title}</span>
            </div>

            <div className="flex items-center gap-2">
              <IconRadioGroup
                value={viewStyleValue}
                options={viewStyleOptions}
                onChange={(value) => {
                  if (value === "listings") {
                    navigateTo("/[locale]/listings");
                    return;
                  }

                  navigateTo("/[locale]/map");
                }}
              />

              {showModeToggle ? (
                <IconRadioGroup
                  value={viewLevelValue}
                  options={viewLevelOptions}
                  onChange={(value) => {
                    onModeChange(value as ExplorerMode);
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button asChild variant="outline" size="sm" className="h-8 w-8 p-0">
              <Link href={localeSwitchLink} aria-label={messages.navigation.switch_locale} title={messages.navigation.switch_locale}>
                <Globe2 className="h-4 w-4" />
                <span className="sr-only">{messages.navigation.switch_locale}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 pt-[112px] lg:grid-cols-[320px_minmax(0,1fr)] lg:p-6 lg:pt-[118px]">
        <aside className="hidden lg:block">{filterPanelDesktop}</aside>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="space-y-1 p-4">
              <h1 className="text-lg font-semibold text-foreground md:text-xl">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>

          {activeFilterChips}

          {statsRow}

          <div className={cn("space-y-4")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
