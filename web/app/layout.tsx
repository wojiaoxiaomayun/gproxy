import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { LayoutProvider } from "@/components/LayoutWrapper";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "API Gateway 管理控制台",
  description: "轻量级 API 网关审计系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable, interHeading.variable)}
    >
      <body className="min-h-full bg-slate-50 dark:bg-slate-950">
        <ToastProvider position="top-center">
          <LayoutProvider>
            <Navigation />
            <main className="ml-64 transition-all duration-300">
              {children}
            </main>
          </LayoutProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
