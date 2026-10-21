function parse(value: string) {
  try {
    return new URL(value, "https://portal.invalid");
  } catch {
    return null;
  }
}
export function safePortalNext(value: string | null) {
  if (!value || !value.startsWith("/musteri/") || value.includes("\\"))
    return null;
  const url = parse(value);
  return url &&
    url.origin === "https://portal.invalid" &&
    url.pathname.startsWith("/musteri/") &&
    url.pathname !== "/musteri/hesabim"
    ? `${url.pathname}${url.search}${url.hash}`
    : null;
}
export function catalogReturn(value: string | null) {
  if (!value || value.includes("\\")) return "/musteri#arac-sec";
  const url = parse(value);
  if (
    !url ||
    url.origin !== "https://portal.invalid" ||
    url.pathname !== "/musteri"
  )
    return "/musteri#arac-sec";
  const params = new URLSearchParams();
  for (const key of ["marka", "model", "kasa"]) {
    const id = url.searchParams.get(key);
    if (id && /^[a-f0-9]{24}$/i.test(id)) params.set(key, id);
  }
  if (url.searchParams.get("paketler") === "1") params.set("paketler", "1");
  return `/musteri${params.size ? `?${params}` : ""}#arac-sec`;
}
