import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VIS Lashes Admin",
  description: "Admin dashboard for VIS Lashes booking management",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "VIS Admin",
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      {children}
    </>
  );
}
