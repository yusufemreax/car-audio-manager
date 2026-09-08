/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Box,
  Boxes,
  Package,
  LayoutTemplate,
  Settings2,
  PackageCheck,
  Users,
  Truck,
  ChartNoAxesCombined,
  ShoppingCart,
  LogOut,
  LoaderCircle,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

import {
  productCategories,
} from "@/lib/product-config";

export function AppSidebar() {
  const pathname = usePathname();

  const [loggingOut, setLoggingOut] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authInvalid, setAuthInvalid] = useState(false);

  const redirectToLogin = useCallback(() => {
    const nextPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : pathname;

    window.location.replace(
      `/login?next=${encodeURIComponent(nextPath)}`
    );
  }, [pathname]);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const result = (await response
        .json()
        .catch(() => null)) as
        | {
            success?: boolean;
            authenticated?: boolean;
          }
        | null;

      if (
        !response.ok ||
        !result?.success ||
        !result.authenticated
      ) {
        setAuthInvalid(true);
        redirectToLogin();
        return false;
      }

      setAuthInvalid(false);
      return true;
    } catch {
      setAuthInvalid(true);
      redirectToLogin();
      return false;
    } finally {
      setAuthChecking(false);
    }
  }, [redirectToLogin]);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      setAuthChecking(true);

      const valid = await checkSession();

      if (cancelled || !valid) {
        return;
      }

      setAuthChecking(false);
    };

    void verify();

    const handleFocus = () => {
      void checkSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    const intervalId = window.setInterval(() => {
      void checkSession();
    }, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.clearInterval(intervalId);
    };
  }, [pathname, checkSession]);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      // Hard navigation Next.js client router cache'ini de temizler.
      window.location.replace("/login");
    }
  };

  /*
   * ÖNEMLİ:
   *
   * SSR ve client ilk render birebir
   * aynı olsun diye başlangıçta
   * route'a göre state vermiyoruz.
   */
  const [
    accordionValue,
    setAccordionValue,
  ] = useState<string[]>([]);

  /*
   * Hydration tamamlandıktan sonra
   * bulunduğumuz route'a göre
   * ilgili menüyü açıyoruz.
   */
  useEffect(() => {
    if (
      pathname.startsWith(
        "/products"
      )
    ) {
      setAccordionValue(
        (current) =>
          current.includes(
            "products"
          )
            ? current
            : [
                ...current,
                "products",
              ]
      );

      return;
    }

    if (
      pathname.startsWith(
        "/stock"
      )
    ) {
      setAccordionValue(
        (current) =>
          current.includes(
            "stock"
          )
            ? current
            : [
                ...current,
                "stock",
              ]
      );
    }
  }, [pathname]);

  const isProductsRoute =
    pathname.startsWith(
      "/products"
    );

  const isStockRoute =
    pathname.startsWith(
      "/stock"
    );

  return (
    <>
      {(authChecking || authInvalid) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" />
            Oturum kontrol ediliyor...
          </div>
        </div>
      )}

      <Sidebar collapsible="offcanvas">
      {/* HEADER */}
      <SidebarHeader className="border-b">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Box className="size-5" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight">
              Car Audio
            </div>

            <div className="truncate text-xs text-muted-foreground">
              Yönetim Sistemi
            </div>
          </div>
        </Link>
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Accordion
              multiple
              value={
                accordionValue
              }
              onValueChange={
                setAccordionValue
              }
              className="w-full"
            >
              {/* ======================
                  ÜRÜNLER
              ====================== */}
              <AccordionItem
                value="products"
                className="border-none"
              >
                <AccordionTrigger
                  className={`
                    rounded-lg
                    px-3
                    py-2
                    hover:bg-accent
                    hover:no-underline
                    ${
                      isProductsRoute
                        ? "bg-accent text-foreground"
                        : ""
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Package className="size-4 shrink-0" />

                    <span className="font-medium">
                      Ürünler
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-1">
                  <div className="ml-5 mt-1 border-l pl-3">
                    {productCategories.map(
                      (
                        category
                      ) => {
                        const href =
                          category.href;

                        const active =
                          pathname ===
                          href;

                        return (
                          <Link
                            key={
                              category.value
                            }
                            href={
                              href
                            }
                            className={`
                              mb-1
                              block
                              rounded-md
                              px-3
                              py-2
                              text-sm
                              transition-colors
                              ${
                                active
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                              }
                            `}
                          >
                            {
                              category.label
                            }
                          </Link>
                        );
                      }
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ======================
                  STOK
              ====================== */}
              <AccordionItem
                value="stock"
                className="border-none"
              >
                <AccordionTrigger
                  className={`
                    rounded-lg
                    px-3
                    py-2
                    hover:bg-accent
                    hover:no-underline
                    ${
                      isStockRoute
                        ? "bg-accent text-foreground"
                        : ""
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="size-4 shrink-0" />

                    <span className="font-medium">
                      Stok
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-1">
                  <div className="ml-5 mt-1 border-l pl-3">
                    {productCategories.map(
                      (
                        category
                      ) => {
                        const href =
                          `/stock/${category.value}`;

                        const active =
                          pathname ===
                          href;

                        return (
                          <Link
                            key={
                              category.value
                            }
                            href={
                              href
                            }
                            className={`
                              mb-1
                              block
                              rounded-md
                              px-3
                              py-2
                              text-sm
                              transition-colors
                              ${
                                active
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                              }
                            `}
                          >
                            {
                              category.label
                            }
                          </Link>
                        );
                      }
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>


            <Link
              href="/bulk-stock-order"
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors
                ${
                  pathname ===
                  "/bulk-stock-order"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <ShoppingCart className="size-4 shrink-0" />

              <span>
                Toplu Sipariş
              </span>
            </Link>

            <Link
              href="/suppliers"
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors
                ${
                  pathname.startsWith(
                    "/suppliers"
                  )
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <Truck className="size-4 shrink-0" />

              <span>
                Tedarikçiler
              </span>
            </Link>

            <Link
              href="/templates"
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors
                ${
                  pathname === "/templates"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <LayoutTemplate className="size-4 shrink-0" />

              <span>
                Şablonlar
              </span>
            </Link>

            <Link
              href="/system-preparation"
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors
                ${
                  pathname ===
                  "/system-preparation"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <Settings2 className="size-4 shrink-0" />

              <span>
                Sistem Hazırlama
              </span>
            </Link>

            <Link
              href="/ready-systems"
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors
                ${
                  pathname ===
                  "/ready-systems"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <PackageCheck className="size-4 shrink-0" />

              <span>
                Hazır Sistemler
              </span>
            </Link>



            <Link
              href="/total-revenue"
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors
                ${
                  pathname ===
                  "/total-revenue"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <ChartNoAxesCombined className="size-4 shrink-0" />

              <span>
                Toplam Ciro
              </span>
            </Link>

            <Link
              href="/customers"
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors
                ${
                  pathname ===
                  "/customers"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <Users className="size-4 shrink-0" />

              <span>
                Müşteriler
              </span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t p-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
        >
          {loggingOut ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="size-4 shrink-0" />
          )}

          <span>
            {loggingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
          </span>
        </button>

        <p className="px-3 pt-1 text-xs text-muted-foreground">
          Car Audio Manager
        </p>
      </SidebarFooter>
      </Sidebar>
    </>
  );
}