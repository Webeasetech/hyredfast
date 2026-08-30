"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import useAuthStore from "@/store/auth.store";
import { TourProvider } from "@/components/tour/tour-provider";

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!isAuthenticated || !user)) {
      clearAuth();
      router.push("/login");
    } else if (mounted && isAuthenticated && user && !user.isSetup) {
      router.push("/onboarding");
    }
  }, [mounted, isAuthenticated, user, clearAuth, router]);

  if (!mounted || !isAuthenticated || !user || !user.isSetup) {
    return null;
  }

  return (
    <TourProvider>
      {/* Two columns: the sidebar is its own full-height rail, and the navbar
          sits inside the content column so it spans only the content width.
          The sidebar sizes itself, so the shell no longer tracks its width. */}
      <div className="flex h-screen bg-muted">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto px-4 py-3 pb-20 md:px-6 md:py-4 md:pb-6">
            {children}
          </main>
        </div>
        {/* Agent chat is off while the AI features are disabled. The
            component, its API routes and the agents service all remain —
            re-mounting this line is the whole of turning it back on. */}
      </div>
    </TourProvider>
  );
}
