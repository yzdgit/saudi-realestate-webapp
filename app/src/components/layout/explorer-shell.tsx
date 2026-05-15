import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, Building2, Globe2, List, Map as MapIcon } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { AboutDialog } from "@/components/layout/about-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type ExplorerPage = "listings" | "map" | "statistics";

type ExplorerShellProps = {
  locale: Locale;
  messages: LocaleMessages;
  activePage: ExplorerPage;
  title: string;
  description: string;
  filterPanelDesktop: React.ReactNode;
  filterPanelMobile?: React.ReactNode;
  activeFilterChips?: React.ReactNode;
  statsRow?: React.ReactNode;
  children: React.ReactNode;
  hrefQuery?: Record<string, string>;
};

type NavItem = {
  page: ExplorerPage;
  href: "/[locale]/listings" | "/[locale]/map" | "/[locale]/statistics";
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

function NavTabs({
  items,
  activePage,
  hrefQuery
}: {
  items: NavItem[];
  activePage: ExplorerPage;
  hrefQuery: Record<string, string>;
}) {
  return (
    <nav
      aria-label="Primary"
      className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/70 p-1 shadow-sm"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.page === activePage;

        return (
          <Link
            key={item.page}
            href={{ pathname: item.href, query: hrefQuery }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "bg-secondary text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ExplorerShell({
  locale,
  messages,
  activePage,
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

  const navItems: NavItem[] = [
    {
      page: "listings",
      href: "/[locale]/listings",
      label: messages.navigation.listings,
      icon: List
    },
    {
      page: "map",
      href: "/[locale]/map",
      label: messages.navigation.map,
      icon: MapIcon
    },
    {
      page: "statistics",
      href: "/[locale]/statistics",
      label: messages.navigation.statistics,
      icon: BarChart3
    }
  ];

  const trailingActions = (
    <div className="flex items-center gap-1.5">
      <AboutDialog messages={messages} />
      <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2">
        <Link
          href={localeSwitchLink}
          aria-label={messages.navigation.switch_locale}
          title={messages.navigation.switch_locale}
        >
          <Globe2 className="h-4 w-4" aria-hidden />
          <span className="hidden text-xs font-medium md:inline">
            {messages.navigation.switch_locale}
          </span>
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-[1100] border-b border-border/70 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 lg:gap-6 lg:px-6">
          <div className="flex flex-1 items-center gap-2 lg:gap-3">
            <div className="lg:hidden">{filterPanelMobile}</div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/95">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-card text-primary">
                <Building2 className="h-4 w-4" aria-hidden />
              </span>
              <span className="hidden whitespace-nowrap sm:inline">
                {messages.home.title}
              </span>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center justify-center">
            <NavTabs items={navItems} activePage={activePage} hrefQuery={mergedQuery} />
          </div>

          <div className="flex flex-1 items-center justify-end">{trailingActions}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 pt-[80px] lg:grid-cols-[320px_minmax(0,1fr)] lg:p-6 lg:pt-[88px]">
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

          <div className="space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
