import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlexPad",
    short_name: "AlexPad",
    description: "Attribution-first Solana memecoin launchpad",
    start_url: "/",
    display: "standalone",
    background_color: "#12071F",
    theme_color: "#F4FF58",
    icons: [
      { src: "/icon.png", sizes: "400x400", type: "image/png" },
      { src: "/apple-icon.png", sizes: "400x400", type: "image/png" },
    ],
  };
}
