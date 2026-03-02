import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&family=Inter:wght@300;400;500&family=Montserrat:wght@600&family=Open+Sans:ital,wght@0,300;0,400;1,300&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Script src={squareSdkUrl} strategy="lazyOnload" />
      </body>
    </html>
  );
}
