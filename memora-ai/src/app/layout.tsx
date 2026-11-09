import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Telugu } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { THEME_SCRIPT } from "@/hooks/useTheme";
import { ToastProvider } from "@/components/ui/toast";
import { SwRegister } from "@/components/SwRegister";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-telugu", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "MEMORA AI", template: "%s · MEMORA AI" },
  description: "Your Memory. Your Studies. Your AI. — a personal AI memory assistant and study companion for Intermediate and EAPCET students.",
  applicationName: "MEMORA AI",
  appleWebApp: { capable: true, title: "MEMORA AI", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192" }, { url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#080a16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable} ${telugu.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
        <SwRegister />
      </body>
    </html>
  );
}
