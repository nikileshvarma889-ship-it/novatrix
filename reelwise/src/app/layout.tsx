import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = { title: "Reelwise — AI video studio for social media", description: "Create, approve and publish original videos to Instagram, Facebook and YouTube." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f9ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
