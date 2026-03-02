import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VIS Lashes Admin",
    short_name: "VIS Admin",
    description: "Manage your VIS Lashes bookings, clients, and availability",
    start_url: "/admin",
    display: "standalone",
    background_color: "#F7F3EE",
    theme_color: "#3D2B1F",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
