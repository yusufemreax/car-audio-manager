import { AppSidebar } from "@/components/layout/app-sidebar";
import type { Metadata } from "next";
import { AdminNotifications } from "@/components/admin/notifications";
export const metadata: Metadata = {
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Aksoy Admin",
    statusBarStyle: "default",
  },
  icons: { apple: "/admin-icon-192.png" },
};

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="min-w-0 overflow-hidden">
        {/* HEADER */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur">
          {/*
            Mobilde sidebar açma butonu göster.
            PC'de sidebar sabit olduğu için gizle.
          */}
          <SidebarTrigger className="md:hidden" />
          <AdminNotifications />
        </header>

        {/* CONTENT */}
        <main className="min-w-0 flex-1 overflow-x-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
