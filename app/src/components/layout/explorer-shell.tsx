import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, Building2, Globe2, List, Map as MapIcon } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { AboutDialog } from "@/components/layout/about-dialog";
import { Button } from "@/components/ui/button";

export type ExplorerPage = "listings" | "map" | "statistics";

export type ExplorerLayout = "default" | "wide";

type ExplorerShellProps = {
  locale: Locale;
  messages: LocaleMessages;
  activePage: ExplorerPage;
  filterPanelDesktop: React.ReactNode;
  filterPanelMobile?: React.ReactNode;
  activeFilterChips?: React.ReactNode;
  statsRow?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  hrefQuery?: Record<string, string>;
  layout?: ExplorerLayout;
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
      className="flex items-center gap-1 rounded-xl border border-border/70 bg-surface-2/80 p-1 shadow-sm"
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
  filterPanelDesktop,
  filterPanelMobile,
  activeFilterChips,
  statsRow,
  toolbar,
  hrefQuery,
  children,
  layout = "default"
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

  const isWide = layout === "wide";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-[1100] border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-[56px] max-w-[1600px] items-center gap-3 px-4 lg:gap-6 lg:px-6">
          <div className="flex flex-1 items-center gap-2 lg:gap-3">
            <div className="lg:hidden">{filterPanelMobile}</div>
            <Link
              href={{ pathname: "/[locale]/listings", query: mergedQuery }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/95"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-surface-3 text-primary">
                <Building2 className="h-4 w-4" aria-hidden />
              </span>
              <span className="hidden whitespace-nowrap sm:inline">{messages.home.title}</span>
            </Link>
          </div>

          <div className="flex flex-shrink-0 items-center justify-center">
            <NavTabs items={navItems} activePage={activePage} hrefQuery={mergedQuery} />
          </div>

          <div className="flex flex-1 items-center justify-end">{trailingActions}</div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto grid grid-cols-1 gap-4 px-4 pt-[68px] lg:px-6 lg:pt-[76px]",
          isWide
            ? "max-w-[1800px] pb-4 lg:grid-cols-[300px_minmax(0,1fr)]"
            : "max-w-[1600px] pb-6 lg:grid-cols-[300px_minmax(0,1fr)]"
        )}
      >
        <aside className="hidden lg:block">{filterPanelDesktop}</aside>

        <div className={cn("flex flex-col gap-3", isWide ? "min-w-0" : "min-w-0")}>
          {toolbar}
          {statsRow}
          {activeFilterChips}
          <div className={cn("flex-1", isWide ? "min-h-[calc(100vh-180px)]" : "")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
