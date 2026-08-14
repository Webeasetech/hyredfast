"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  EmailIcon,
  ChecklistNoteIcon,
  SettingsIcon,
  QuestionMarkCircleIcon,
  MessageSquareIcon,
} from "mage-icons-react/bulk";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "mage-icons-react/stroke";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import hyredfastPNG from "@/assets/logos/hyredfast.png";
import hyredfastIconPNG from "@/assets/logos/hyredfast-icon.png";

const sidebarLinks = [
  {
    label: "Dashboard",
    icon: DashboardIcon,
    href: "/dashboard",
  },
  {
    label: "Campaigns",
    icon: EmailIcon,
    href: "/campaigns",
  },
  {
    label: "Lists",
    icon: ChecklistNoteIcon,
    href: "/lists",
  },
];

const settingsLink = {
  label: "Settings",
  icon: SettingsIcon,
  href: "/settings",
};

const settingsSubLinks = [
  { label: "Email settings", href: "/settings" },
  { label: "Account", href: "/settings/account" },
  { label: "Billing", href: "/settings/billing" },
];

const supportLinks = [
  {
    label: "Support",
    icon: QuestionMarkCircleIcon,
    href: "mailto:anaz.aijaz@gmail.com",
  },
  {
    label: "Contact",
    icon: MessageSquareIcon,
    href: "mailto:anaz.aijaz@gmail.com",
  },
];

/**
 * A single sidebar row. Rows sit inside a padded track so the active pill is
 * inset from the sidebar edges rather than running the full width, and it
 * carries the same radius/weight as a button.
 */
function NavItem({ link, active, collapsed }) {
  return (
    <Link
      href={link.href}
      title={collapsed ? link.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
        // Collapsed, the row has no label to stretch it, so a full-width pill
        // reads as a wide rectangle. Pin it to a square the size of the row
        // height instead and centre it in the rail.
        collapsed ? "size-10 justify-center self-center p-0" : "px-3 py-2",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <link.icon className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{link.label}</span>}
    </Link>
  );
}

/**
 * Settings used to render its sub-pages' nav as a separate card inside the
 * page content. That meant two left-hand navs stacked side by side once the
 * app already had an outer sidebar. This nests those same three links here
 * instead, as an expand/collapse section rather than a second sidebar.
 */
function SettingsSection({ active, collapsed, open, onOpenChange, pathname }) {
  if (collapsed) {
    return <NavItem link={settingsLink} active={active} collapsed />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <settingsLink.icon className="size-5 shrink-0" />
        <span className="flex-1 truncate text-left">{settingsLink.label}</span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-1 border-l border-border pl-4">
          {settingsSubLinks.map((link) => {
            const subActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  subActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isSettingsRoute = pathname.startsWith("/settings");
  const [settingsOpen, setSettingsOpen] = useState(isSettingsRoute);

  // Auto-expand on arrival at any settings page; manual toggles afterward
  // are left alone rather than fought on every render.
  useEffect(() => {
    if (isSettingsRoute) setSettingsOpen(true);
  }, [isSettingsRoute]);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check if a link is active based on the current pathname
  const isActive = (href) => {
    // Exact match for dashboard
    if (href === "/dashboard" && pathname === "/dashboard") {
      return true;
    }
    // For other routes, check if pathname starts with the href (for nested routes)
    return href !== "/dashboard" && pathname.startsWith(href);
  };

  // Mobile bottom bar
  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-muted/90 backdrop-blur">
        <nav className="flex items-center justify-between gap-1 px-2 py-2">
          {[...sidebarLinks, settingsLink, ...supportLinks.slice(0, 1)].map(
            (link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                className={cn(
                  "flex min-w-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <link.icon className="size-5" />
                <span>{link.label}</span>
              </Link>
            ),
          )}
        </nav>
      </div>
    );
  }

  // Desktop sidebar — a full-height left column with its own right edge.
  return (
    <div
      className={cn(
        "hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-transparent transition-all duration-300 md:flex",
        collapsed ? "w-[70px]" : "w-[240px]",
      )}
    >
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-4">
        {/* The logo lives in the rail now that the navbar only spans content. */}
        <div className="mb-4 flex flex-col gap-2 px-3">
          {/* Collapsed, the rail is too narrow for the wordmark, so the mark
              alone sits on its own row above the toggle. */}
          {collapsed && (
            <Link href="/" className="flex justify-center" aria-label="HyredFast">
              <Image src={hyredfastIconPNG} alt="" className="size-7" priority />
            </Link>
          )}
          <div className="flex items-center justify-between gap-2">
            {!collapsed && (
              <Link href="/" className="flex min-w-0 items-center">
                <Image
                  src={hyredfastPNG}
                  alt="HyredFast"
                  className="h-auto w-33"
                  priority
                />
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(!collapsed)}
              className="ml-auto shrink-0 text-muted-foreground"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRightIcon className="size-4" />
              ) : (
                <ChevronLeftIcon className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-2">
          {sidebarLinks.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              active={isActive(link.href)}
              collapsed={collapsed}
            />
          ))}
          <SettingsSection
            active={isSettingsRoute}
            collapsed={collapsed}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            pathname={pathname}
          />
        </nav>

        <div className="mt-auto flex flex-col gap-1 px-2 pt-4">
          {supportLinks.map((link) => (
            <NavItem
              key={link.label}
              link={link}
              active={isActive(link.href)}
              collapsed={collapsed}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
