import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import type { Metadata } from "next";

import "@workspace/ui/globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AP Automation",
  description: "Accounts payable automation",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce from proxy.ts (forces dynamic rendering).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
    >
      <body>
        <ThemeProvider nonce={nonce}>
          {/* Stacking context required by Base UI portals (Cubby UI). */}
          <div className="root">
            <AuthKitProvider>{children}</AuthKitProvider>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
