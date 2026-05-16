import { Suspense } from "react";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import SupportBubble from "@/components/Support/SupportBubble";

export default function VigiPrixLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex-1 flex flex-row w-full h-full">
      {/* Sidebar Desktop */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
        <main className="flex-1 w-full max-w-7xl mx-auto lg:mx-0 lg:max-w-none pb-24 lg:pb-8 sm:px-6 lg:px-12">
          <div className="max-w-md mx-auto lg:max-w-none">
            {children}
          </div>
        </main>
        
        {/* Navigation Mobile */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
        
        {/* Support Bubble - Module Specific */}
        <Suspense fallback={null}>
          <SupportBubble />
        </Suspense>
      </div>
    </div>
  );
}
