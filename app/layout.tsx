import type { Metadata, Viewport } from "next";
import { Anton, Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RefCapture } from "@/components/layout/RefCapture";

const cond = Anton({ weight: "400", subsets: ["latin"], variable: "--font-cond", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jet", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://beckpad-production.up.railway.app";
const DESC = "Something is launching. ZerePad: a Solana launchpad where every buy is traced back to whoever drove it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ZerePad", template: "%s · ZerePad" },
  applicationName: "ZerePad",
  description: DESC,
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.png", apple: "/apple-icon.png", shortcut: "/icon.png" },
  openGraph: {
    type: "website",
    siteName: "ZerePad",
    url: SITE_URL,
    title: "ZerePad",
    description: DESC,
    images: [{ url: "/logo.png", width: 400, height: 400, alt: "ZerePad" }],
  },
  twitter: { card: "summary", site: "@0xzerebro", title: "ZerePad", description: DESC, images: ["/logo.png"] },
};

export const viewport: Viewport = {
  themeColor: "#08070a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cond.variable} ${inter.variable} ${jet.variable} h-full`}>
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
