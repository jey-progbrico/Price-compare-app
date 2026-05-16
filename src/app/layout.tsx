import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import ToastContainer from "@/components/Toast";

export const metadata: Metadata = {
  title: "VigiSuite : Plateforme Retail",
  description: "Suite d'outils SaaS pour le commerce et la veille tarifaire.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VigiSuite",
  },
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
      <body className="min-h-full flex flex-col text-neutral-200">
        <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
          {children}
          <ToastContainer />
        </div>
      </body>
    </html>
  );
}
