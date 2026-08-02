import { Host_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Loaded as a variable font (wght 300–800) rather than discrete cuts, so the
// browser fetches one file for every weight the UI uses.
const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  variable: "--font-host-grotesk",
  display: "swap",
});

export const metadata = {
  title: "Denshees | Email automation",
  description: "Email that work while you play",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${hostGrotesk.variable} antialiased font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
