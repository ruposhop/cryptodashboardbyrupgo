import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/app-config";

// App instalable en el móvil (MASTERPLAN §4: PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Crypto",
    description: "Dashboard privado de mis carteras crypto",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0b0d",
    theme_color: "#0a0b0d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
