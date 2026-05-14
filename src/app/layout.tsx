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
import DesktopSidebar from "@/components/DesktopSidebar";
import ToastContainer from "@/components/Toast";
import SupportBubble from "@/components/Support/SupportBubble";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "VigiPrix : Veille Terrain",
  description: "Application mobile de veille tarifaire et comparaison de prix.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VigiPrix",
  },
};

export const viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[#0a0a0c]`}
    >
      <body className="min-h-full flex flex-row text-neutral-200">
        {/* Sidebar Desktop - Only shown if user is logged in */}
        {user && <DesktopSidebar />}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
          <main className={`flex-1 w-full ${user ? "max-w-7xl mx-auto lg:mx-0 lg:max-w-none pb-24 lg:pb-8 sm:px-6 lg:px-12" : ""}`}>
            <div className={user ? "max-w-md mx-auto lg:max-w-none" : "w-full h-full"}>
              {children}
            </div>
          </main>
          
          {/* Navigation Mobile - Only shown if user is logged in */}
          {user && (
            <div className="lg:hidden">
              <BottomNav />
            </div>
          )}
          
          <ToastContainer />
          
          {/* Support Bubble - Global */}
          {user && <SupportBubble />}
        </div>
      </body>
    </html>
  );
}
