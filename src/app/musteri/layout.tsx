import type { Metadata } from "next";
import { PortalShell } from "@/components/portal/shell";
export const metadata: Metadata = {
  manifest: "/musteri/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Aksoy Tuning", statusBarStyle: "default" },
  title: "Aksoy Tuning | Aracınıza Uygun Multimedya",
  description:
    "Aracınızı seçin, multimedya paketlerini inceleyin ve montaj randevunuzu oluşturun. Başiskele Aksoy Tuning.",
};
export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
