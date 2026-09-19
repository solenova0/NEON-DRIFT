import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { THEME, THEME_CSS } from "@/game/theme";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

const title = "NEON DRIFT | Gravity Division";
const description = "Flip gravity. Dodge the conduit. Chase your next record in a neon 3D endless runner with an original synth soundtrack.";
const hostname = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || (hostname ? `https://${hostname}` : "http://localhost:3000"));
if (!["http:", "https:"].includes(siteUrl.protocol)) throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute HTTP(S) URL.");
const indexable = process.env.VERCEL_ENV !== "preview";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl.origin),
  title,
  description,
  applicationName: "NEON DRIFT",
  category: "games",
  alternates: { canonical: "/" },
  robots: { index: indexable, follow: indexable },
  openGraph: {
    type: "website", locale: "en_US", siteName: "NEON DRIFT", url: "/", title, description,
    images: [{ url: "/og-image.png", width: 1200, height: 630,
      alt: "NEON DRIFT title beside its glowing craft inside a cyan neon tunnel." }],
  },
  twitter: {
    card: "summary_large_image", title, description,
    images: [{ url: "/og-image.png", alt: "NEON DRIFT title beside its glowing craft inside a cyan neon tunnel." }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME.palette.background,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={THEME_CSS as CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
