import type {
  ReactNode,
} from "react";

import {
  AppSidebar,
} from "@/components/layout/app-sidebar";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface TotalRevenueLayoutProps {
  children: ReactNode;
}

export default function TotalRevenueLayout({
  children,
}: TotalRevenueLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="md:hidden" />
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
