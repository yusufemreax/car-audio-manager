import { PortalProduct } from "@/components/portal/product";
export default async function MultimediaDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PortalProduct id={id} />;
}
