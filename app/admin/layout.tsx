import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VIS Lashes Admin",
  description: "Admin dashboard for VIS Lashes booking management",
  // Overrides the public site's manifest for every /admin route, so installing
  // the admin gives a standalone app that opens on the dashboard while a client
  // installing the public site gets the booking site. A single shared manifest
  // meant the homepage advertised start_url "/admin" to everyone.
  manifest: "/admin.webmanifest",
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
  // The apple-touch-icon <link> that used to be rendered here by hand pointed
  // at the 192px manifest icon and competed with the 180px one Next emits from
  // app/apple-icon.png. Removed — the file convention handles it, at the size
  // iOS actually asks for.
  return <>{children}</>;
}
