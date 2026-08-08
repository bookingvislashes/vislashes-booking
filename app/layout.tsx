import type { Metadata } from "next";
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
  title: "VIS Lashes — Premium Lash Extensions in Orlando",
  description:
    "Book your lash extension appointment with VIS Lashes. Natural Glam, Premium Wispy Glam, and custom lash sets in Orlando, Saint Cloud, and Kissimmee, FL.",
  openGraph: {
    title: "VIS Lashes — Premium Lash Extensions",
    description:
      "Book your lash extension appointment online. Serving Orlando, Saint Cloud, and Kissimmee.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Script src={squareSdkUrl} strategy="lazyOnload" />
      </body>
    </html>
  );
}
