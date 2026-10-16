import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZerePad",
    short_name: "ZerePad",
    description: "Attribution-first Solana memecoin launchpad",
    start_url: "/",
    display: "standalone",
    background_color: "#08070A",
    theme_color: "#08070A",
    icons: [
      { src: "/icon.png", sizes: "400x400", type: "image/png" },
      { src: "/apple-icon.png", sizes: "400x400", type: "image/png" },
    ],
  };
}
