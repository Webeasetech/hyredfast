"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import fetcher from "@/lib/fetcher";
import useCampaignStore from "@/store/campaign.store";

const LABELS = {
  dashboard: "Dashboard",
  campaigns: "Campaigns",
  lists: "Lists",
  settings: "Settings",
  account: "Account",
  billing: "Billing",
  analytics: "Analytics",
  builder: "Builder",
  crm: "CRM",
  onboarding: "Onboarding",
};

// Record ids are cuids — long, lowercase and alphanumeric. Anything we don't
// have a label for that looks like one gets resolved to a record name instead
// of being printed raw.
const looksLikeId = (segment) =>
  !LABELS[segment] && /^[a-z0-9]{12,}$/i.test(segment);

const titleCase = (segment) =>
  segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function Breadcrumbs() {
  const pathname = usePathname() || "";
  const segments = pathname.split("/").filter(Boolean);
  const { currentCampaign } = useCampaignStore();

  // Only fetch for a list detail route, and reuse the exact key the page uses
  // so SWR serves it from cache rather than issuing a second request.
  const listId =
    segments[0] === "lists" && looksLikeId(segments[1]) ? segments[1] : null;
  const { data: list } = useSWR(
    listId ? `/api/lead-lists/${listId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // A single crumb is just the page's own name repeated next to its title, so
  // the trail only earns its place once there's somewhere to navigate back to.
  if (segments.length < 2) return null;

  // Settings' sub-pages are flat siblings under the sidebar's own expanded
  // "Settings" section, not a drill-down hierarchy — the trail would just
  // repeat what the sidebar already shows.
  if (segments[0] === "settings") return null;

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    let label = LABELS[segment] ?? titleCase(segment);

    if (looksLikeId(segment)) {
      const parent = segments[i - 1];
      if (parent === "campaigns") label = currentCampaign?.name ?? "Campaign";
      else if (parent === "lists") label = list?.name ?? "List";
      else label = "Details";
    }

    return { href, label };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="max-w-[24ch] truncate">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={crumb.href}
                    className="max-w-[20ch] truncate"
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator className="text-muted-foreground/60">
                  /
                </BreadcrumbSeparator>
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
