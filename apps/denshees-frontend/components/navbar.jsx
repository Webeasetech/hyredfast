"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SettingsIcon, UserIcon } from "mage-icons-react/bulk";
import { LogoutIcon } from "mage-icons-react/stroke";
import useAuthStore from "@/store/auth.store";
import usePageHeaderStore from "@/store/page-header.store";
import { CreditsDisplay } from "@/components/credits-display";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { title, description } = usePageHeaderStore();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <header className="bg-transparent">
      {/* Padding matches the content area below so the title/breadcrumb lines
          up with the page content. The two are mutually exclusive in
          practice — a page either registers a title or sits deep enough to
          show a breadcrumb, never both — so they share one slot. */}
      <div className="flex min-h-12 items-center gap-4 px-4 py-2 md:min-h-14 md:px-6">
        <div className="min-w-0 flex-1">
          <Breadcrumbs />
          {title && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="truncate text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <CreditsDisplay user={user} />

          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-2 focus:outline-hidden">
                <div className="w-8 h-8 border border-border flex items-center justify-center bg-accent rounded-lg">
                  {user?.avatar ? (
                    <Image
                      src={user.avatar || "/placeholder.svg"}
                      alt="User avatar"
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {user?.name?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 border-b border-border">
                  <p className="font-medium">{user?.name || "User"}</p>
                  <p className="text-sm text-foreground truncate">
                    {user?.email || ""}
                  </p>
                </div>

                <DropdownMenuItem asChild>
                  <Link
                    href="/settings"
                    className="flex items-center cursor-pointer"
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogoutIcon className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
