import type { Metadata, Viewport } from "next";
import { Inter, Pixelify_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RefCapture } from "@/components/layout/RefCapture";

const pixel = Pixelify_Sans({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-pixel", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://beckpad-production.up.railway.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "BeckPad", template: "%s · BeckPad" },
  applicationName: "BeckPad",
  description: "Attribution-first Solana memecoin launchpad. Every buy is traced back to the link that drove it.",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.png", apple: "/apple-icon.png", shortcut: "/icon.png" },
  openGraph: {
    type: "website",
    siteName: "BeckPad",
    url: SITE_URL,
    title: "BeckPad",
    description: "Attribution-first Solana memecoin launchpad",
    images: [{ url: "/logo.png", width: 400, height: 400, alt: "BeckPad" }],
  },
  twitter: { card: "summary", site: "@ZssBecker", title: "BeckPad", description: "Attribution-first Solana memecoin launchpad", images: ["/logo.png"] },
};

export const viewport: Viewport = {
  themeColor: "#F4FF58",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pixel.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <Suspense fallback={null}>
            <RefCapture />
          </Suspense>
          <Header />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
