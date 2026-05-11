import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import BottomNav from "@/components/BottomNav";
import ToastContainer from "@/components/Toast";

export const metadata: Metadata = {
  title: "Vigiprix : Scan & Comparaison",
  description: "Application mobile de veille tarifaire et comparaison de prix.",
};

export const viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[#0a0a0c]`}
    >
      <body className="min-h-full flex flex-col pb-24 text-neutral-200">
        <main className="flex-1 w-full max-w-md mx-auto relative">
          {children}
        </main>
        <BottomNav />
        <ToastContainer />
      </body>
    </html>
  );
}
