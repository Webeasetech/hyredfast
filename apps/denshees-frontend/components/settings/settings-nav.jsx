"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Email Settings", href: "/settings" },
    { name: "Account", href: "/settings/account" },
    { name: "Billing", href: "/settings/billing" },

    // { name: "Preferences", href: "/settings/preferences" },
    // { name: "API Keys", href: "/settings/api-keys" },
    // { name: "Billing", href: "/settings/billing" },
  ];

  return (
    <div className="border border-border bg-white p-4 rounded-lg">
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block p-2 transition-colors",
                isActive ? "bg-accent font-medium" : "hover:bg-muted",
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
