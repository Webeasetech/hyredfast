"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  EmailIcon,
  ChecklistNoteIcon,
  SettingsIcon,
  QuestionMarkCircleIcon,
  MessageSquareIcon,
} from "mage-icons-react/bulk";
import { ChevronLeftIcon, ChevronRightIcon } from "mage-icons-react/stroke";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import useAuthStore from "@/store/auth.store";

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
  {
    label: "Settings",
    icon: SettingsIcon,
    href: "/settings",
  },
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
 * inset from the sidebar edges rather than bleeding into the border, and it
 * carries the same radius/weight as a button.
 */
function NavItem({ link, active, collapsed }) {
  return (
    <Link
      href={link.href}
      title={collapsed ? link.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md py-2 text-sm font-medium whitespace-nowrap transition-colors",
        collapsed ? "justify-center px-2" : "px-3",
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

export function Sidebar({ onWidthChange }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Update parent component when width changes
  useEffect(() => {
    if (isMobile) {
      onWidthChange?.(0);
    } else {
      const width = collapsed ? 70 : 240;
      onWidthChange?.(width);
    }
  }, [collapsed, isMobile, onWidthChange]);

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
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background">
        <nav className="flex items-center justify-between gap-1 px-2 py-2">
          {[...sidebarLinks, ...supportLinks.slice(0, 1)].map((link) => (
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
          ))}
        </nav>
      </div>
    );
  }

  // Desktop sidebar
  return (
    <div
      className={cn(
        "absolute left-0 top-0 hidden h-full flex-col overflow-hidden border-r border-border bg-background transition-all duration-300 md:flex",
        collapsed ? "w-[70px]" : "w-[240px]",
      )}
    >
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-4">
        <div className="mb-4 flex items-center justify-between px-3">
          {!collapsed && (
            <h2 className="truncate text-sm font-semibold">
              Welcome, {user?.name?.split(" ")[0] || "User"}
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
          >
            {collapsed ? (
              <ChevronRightIcon className="w-5 h-5" />
            ) : (
              <ChevronLeftIcon className="w-5 h-5" />
            )}
          </Button>
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
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border px-2 pt-4">
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
