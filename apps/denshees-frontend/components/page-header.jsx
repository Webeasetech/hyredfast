"use client";

import { useEffect } from "react";
import usePageHeaderStore from "@/store/page-header.store";

/**
 * Registers the current page's title/description with the navbar, which is
 * now the only place they render — a page never repeats its own title in its
 * body. Any per-page action (a "New X" button, etc.) is no longer passed
 * through here; it's placed inline wherever it makes sense in the page
 * (e.g. beside a search box), since the navbar has no room for it.
 */
export function PageHeader({ title, description }) {
  const setPageHeader = usePageHeaderStore((state) => state.setPageHeader);
  const clearPageHeader = usePageHeaderStore((state) => state.clearPageHeader);

  useEffect(() => {
    setPageHeader({ title, description });
    return () => clearPageHeader();
  }, [title, description, setPageHeader, clearPageHeader]);

  return null;
}
