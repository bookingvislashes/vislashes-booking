import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Self-hosted via next/font: no render-blocking request to Google, and the
// fallback metrics are matched so swapping in the real face doesn't shift layout.
const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-sans-face",
  display: "swap",
});

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});

const squareSdkUrl =
  process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";

export const metadata: Metadata = {
  // Required for the link-preview image to be emitted as an absolute URL.
  // Every scraper — iMessage, Instagram, Facebook, WhatsApp — rejects a
  // relative og:image, and without this Next has no origin to build one from.
  // Falls back to the live domain so a preview build still produces a valid
  // tag rather than none; NEXT_PUBLIC_* is baked at build time, so an unset
  // variable would otherwise leave this undefined.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.vislashes.com"
  ),
  title: "VIS Lashes — Premium Lash Extensions in Orlando",
  description:
    "Book your lash extension appointment with VIS Lashes. Classic, Wispy, and Hybrid sets, plus lash lifts, in Orlando, Saint Cloud, and Kissimmee, FL.",
  openGraph: {
    title: "VIS Lashes — Premium Lash Extensions",
    description:
      "Book your lash extension appointment online. Serving Orlando, Saint Cloud, and Kissimmee.",
    type: "website",
    siteName: "VIS Lashes",
    locale: "en_US",
    url: "/",
    // The image itself is app/opengraph-image.jpg, picked up by file
    // convention: Next fingerprints the URL and fills in width, height and
    // type, so the tag cannot drift from the file the way a hand-written
    // path can.
  },
  twitter: {
    // Was defaulting to "summary", the small square card. The large card is
    // what makes the preview read as a photograph rather than a favicon.
    // No twitter:image is set on purpose — X falls back to og:image, and one
    // copy of the asset cannot fall out of sync with itself.
    card: "summary_large_image",
    title: "VIS Lashes — Premium Lash Extensions",
    description:
      "Book your lash extension appointment online. Serving Orlando, Saint Cloud, and Kissimmee.",
  },
};

// `viewportFit: "cover"` is what makes env(safe-area-inset-*) resolve to real
// values on iPhone. Without it every inset reads as 0 and the admin tab bar
// sits underneath the home indicator.
export const viewport: Viewport = {
  themeColor: "#F7F3EE",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* The scroll-reveal sections render hidden and are unhidden by an
            IntersectionObserver. With scripting off that observer never runs,
            which silently costs the homepage its three feature sections. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Script src={squareSdkUrl} strategy="lazyOnload" />
      </body>
    </html>
  );
}
