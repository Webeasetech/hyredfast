"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      // Pinned, not read from the OS. The app ships no ThemeProvider and its
      // tokens are light-only, but sonner reads `prefers-color-scheme` for
      // "system" and colours descriptions #e8e8e8 when it resolves to dark —
      // near-white text on a toast whose background stayed light, which is how
      // a toast could report an error nobody could read.
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      // The theme tokens in globals.css hold bare HSL channels ("0 0% 100%"),
      // not colours, so handing them straight to sonner produced an invalid
      // background-color and a see-through toast. They have to go through hsl().
      style={{
        "--normal-bg": "hsl(var(--popover))",
        "--normal-text": "hsl(var(--popover-foreground))",
        "--normal-border": "hsl(var(--border))",
        "--border-radius": "var(--radius)",
      }}
      // Clears the AI chat button, which is pinned to the same corner.
      offset={{ bottom: "5.5rem" }}
      mobileOffset={{ bottom: "8.5rem" }}
      {...props}
    />
  );
};

export { Toaster };
