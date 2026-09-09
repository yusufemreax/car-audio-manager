/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Car,
  Check,
  CircleCheckBig,
  Eye,
  FileDown,
  FileImage,
  Loader2,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";

import {
  Customer,
  CustomerVehicle,
} from "@/types/customer";

import {
  CustomerSystemOffer,
} from "@/types/customer-system-offer";

import type {
  CustomerOfferCompletionPayment,
  CustomerOfferOrderSupplierPayment,
  CustomerOfferOrderSupplierSelection,
  CustomerOfferStockRequirement,
  CustomerOfferWorkflowAction,
} from "@/types/customer-offer-workflow";

import {
  CustomerFormDialog,
} from "./customer-form-dialog";

import {
  VehicleFormDialog,
} from "./vehicle-form-dialog";

import {
  CustomerSystemOfferDialog,
} from "./customer-system-offer-dialog";

import {
  CustomerOfferWorkflowDetailDialog,
} from "./customer-offer-workflow-detail-dialog";

import {
  CustomerOfferPaymentDialog,
} from "./customer-offer-payment-dialog";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Button,
} from "@/components/ui/button";

import {
  createCustomerOfferJpg,
  createCustomerOfferPdf,
} from "@/lib/customer-offer-pdf";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  stockRequirements?: CustomerOfferStockRequirement[];
}

type WorkflowView =
  | "all"
  | "order_pending"
  | "installation_pending"
  | "sold";

interface WorkflowViewDefinition {
  value: WorkflowView;
  label: string;
}

const WORKFLOW_VIEWS:
  WorkflowViewDefinition[] = [
    {
      value:
        "all",
      label:
        "Teklifler",
    },
    {
      value:
        "order_pending",
      label:
        "Sipariş",
    },
    {
      value:
        "installation_pending",
      label:
        "Montaj Bekliyor",
    },
    {
      value:
        "sold",
      label:
        "Satıldı",
    },
  ];

function formatTry(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style:
        "currency",
      currency:
        "TRY",
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function getOfferStatus(
  offer:
    CustomerSystemOffer
): string {
  return String(
    offer.status
  );
}

function isWorkflowFinalized(
  offer:
    CustomerSystemOffer
) {
  return (
    Reflect.get(
      offer,
      "workflowFinalized"
    ) === true ||
    getOfferStatus(
      offer
    ) === "completed"
  );
}

function getStatusLabel(
  offer:
    CustomerSystemOffer
) {
  if (
    isWorkflowFinalized(
      offer
    )
  ) {
    return "Satıldı";
  }

  switch (
    getOfferStatus(
      offer
    )
  ) {
    case "order_pending":
      return "Sipariş";
    case "installation_pending":
      return "Montaj Bekliyor";
    case "sold":
      return "Eski Satış";
    default:
      return "Teklif";
  }
}

function getStatusBadgeClass(
  offer:
    CustomerSystemOffer
) {
  if (
    isWorkflowFinalized(
      offer
    )
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  switch (
    getOfferStatus(
      offer
    )
  ) {
    case "order_pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "installation_pending":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "sold":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    default:
      return "";
  }
}

function getViewTitle(
  view: WorkflowView
) {
  switch (view) {
    case "order_pending":
      return "Sipariş Bekleyen Teklifler";
    case "installation_pending":
      return "Montaj Bekleyen Teklifler";
    case "sold":
      return "Satılan Teklifler";
    default:
      return "Tüm Teklifler";
  }
}

export function CustomersPageClient() {
  const [
    customers,
    setCustomers,
  ] = useState<Customer[]>([]);

  const [
    offers,
    setOffers,
  ] = useState<CustomerSystemOffer[]>([]);

  const [
    workflowView,
    setWorkflowView,
  ] = useState<WorkflowView>(
    "all"
  );

  const [
    customerDialog,
    setCustomerDialog,
  ] = useState(false);

  const [
    vehicleCustomer,
    setVehicleCustomer,
  ] = useState<Customer | null>(null);

  const [
    offerCustomer,
    setOfferCustomer,
  ] = useState<Customer | null>(null);

  const [
    offerVehicle,
    setOfferVehicle,
  ] = useState<CustomerVehicle | null>(null);

  const [
    creatingPdfId,
    setCreatingPdfId,
  ] = useState<string | null>(null);

  const [
    creatingJpgId,
    setCreatingJpgId,
  ] = useState<string | null>(null);

  const [
    deletingOfferId,
    setDeletingOfferId,
  ] = useState<string | null>(null);

  const [
    processingOfferId,
    setProcessingOfferId,
  ] = useState<string | null>(null);

  const [
    actionError,
    setActionError,
  ] = useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(null);

  const [
    detailOffer,
    setDetailOffer,
  ] = useState<CustomerSystemOffer | null>(null);

  const [
    detailRequirements,
    setDetailRequirements,
  ] = useState<CustomerOfferStockRequirement[]>([]);

  const [
    detailOpen,
    setDetailOpen,
  ] = useState(false);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    paymentOffer,
    setPaymentOffer,
  ] = useState<CustomerSystemOffer | null>(null);

  /*
   * Base UI Accordion root değeri string[] olarak tutulur.
   */
  const [
    openCustomerIds,
    setOpenCustomerIds,
  ] = useState<string[]>([]);

  const [
    openVehicleIdsByCustomer,
    setOpenVehicleIdsByCustomer,
  ] = useState<Record<string, string[]>>({});

  /*
   * =======================================================
   * LOAD
   * =======================================================
   */

  const load =
    useCallback(
      async () => {
        try {
          setActionError(null);

          const [
            customersResponse,
            offersResponse,
          ] = await Promise.all([
            fetch(
              "/api/customers",
              {
                cache:
                  "no-store",
              }
            ),
            fetch(
              "/api/customer-system-offers/workflow-list",
              {
                cache:
                  "no-store",
              }
            ),
          ]);

          const customerResult:
            ApiResponse<Customer[]> =
              await customersResponse.json();

          const offerResult:
            ApiResponse<CustomerSystemOffer[]> =
              await offersResponse.json();

          if (
            !customersResponse.ok ||
            !customerResult.success
          ) {
            throw new Error(
              customerResult.message ??
                "Müşteriler alınamadı."
            );
          }

          if (
            !offersResponse.ok ||
            !offerResult.success
          ) {
            throw new Error(
              offerResult.message ??
                "Teklifler alınamadı."
            );
          }

          setCustomers(
            customerResult.data ??
              []
          );

          setOffers(
            offerResult.data ??
              []
          );
        } catch (error) {
          setActionError(
            error instanceof Error
              ? error.message
              : "Müşteri bilgileri alınamadı."
          );
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  const replaceOffer =
    useCallback(
      (
        updatedOffer:
          CustomerSystemOffer
      ) => {
        setOffers(
          (previous) =>
            previous.map(
              (offer) =>
                offer.id ===
                updatedOffer.id
                  ? updatedOffer
                  : offer
            )
        );
      },
      []
    );

  /*
   * =======================================================
   * WORKFLOW
   * =======================================================
   */

  const runWorkflowAction =
    async (
      offer:
        CustomerSystemOffer,
      action:
        CustomerOfferWorkflowAction,
      options?: {
        supplierSelections?:
          CustomerOfferOrderSupplierSelection[];
        supplierPayments?:
          CustomerOfferOrderSupplierPayment[];
        payment?:
          CustomerOfferCompletionPayment;
      }
    ): Promise<boolean> => {
      if (
        processingOfferId
      ) {
        return false;
      }

      try {
        setProcessingOfferId(
          offer.id
        );
        setActionError(null);
        setSuccessMessage(null);

        const response =
          await fetch(
            `/api/customer-system-offers/${offer.id}/workflow`,
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  action,
                  ...(options?.supplierSelections
                    ? {
                        supplierSelections:
                          options.supplierSelections,
                      }
                    : {}),
                  ...(options?.supplierPayments
                    ? {
                        supplierPayments:
                          options.supplierPayments,
                      }
                    : {}),
                  ...(options?.payment
                    ? {
                        payment:
                          options.payment,
                      }
                    : {}),
                }),
            }
          );

        const result:
          ApiResponse<CustomerSystemOffer> =
            await response.json();

        if (
          result.data
        ) {
          replaceOffer(
            result.data
          );
        }

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              "Teklif işlemi tamamlanamadı."
          );
        }

        const updatedStatus =
          getOfferStatus(
            result.data
          );

        setSuccessMessage(
          result.message ??
            "Teklif durumu güncellendi."
        );

        if (
          action ===
            "start-sale" &&
          updatedStatus ===
            "order_pending"
        ) {
          setDetailOffer(
            result.data
          );
          setDetailRequirements(
            result.stockRequirements ??
              []
          );
          setDetailOpen(true);
        }

        return true;
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Teklif işlemi tamamlanamadı."
        );
        return false;
      } finally {
        setProcessingOfferId(
          null
        );
      }
    };

  const completeOrderFromDetail =
    async (
      selections:
        CustomerOfferOrderSupplierSelection[],
      supplierPayments:
        CustomerOfferOrderSupplierPayment[]
    ) => {
      if (!detailOffer) {
        return false;
      }

      const completed =
        await runWorkflowAction(
          detailOffer,
          "order-completed",
          {
            supplierSelections:
              selections,
            supplierPayments,
          }
        );

      if (completed) {
        setWorkflowView(
          "installation_pending"
        );
      }

      return completed;
    };

  const completeSaleFromPayment =
    async (
      payment:
        CustomerOfferCompletionPayment
    ) => {
      if (!paymentOffer) {
        return false;
      }

      const completed =
        await runWorkflowAction(
          paymentOffer,
          "complete-sale",
          {
            payment,
          }
        );

      if (completed) {
        setWorkflowView(
          "sold"
        );
        setPaymentOffer(
          null
        );
      }

      return completed;
    };

  /*
   * =======================================================
   * DETAIL
   * =======================================================
   */

  const openDetail =
    async (
      offer:
        CustomerSystemOffer
    ) => {
      setDetailOffer(
        offer
      );
      setDetailRequirements(
        []
      );
      setDetailOpen(true);
      setDetailLoading(true);
      setActionError(null);

      try {
        const response =
          await fetch(
            `/api/customer-system-offers/${offer.id}/workflow`,
            {
              cache:
                "no-store",
            }
          );

        const result:
          ApiResponse<CustomerSystemOffer> =
            await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              "Teklif detayı alınamadı."
          );
        }

        setDetailOffer(
          result.data
        );
        setDetailRequirements(
          result.stockRequirements ??
            []
        );
        replaceOffer(
          result.data
        );
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Teklif detayı alınamadı."
        );
      } finally {
        setDetailLoading(false);
      }
    };

  /*
   * =======================================================
   * PDF
   * =======================================================
   */

  const createPdf =
    async (
      offer:
        CustomerSystemOffer
    ) => {
      try {
        setActionError(null);

        setCreatingPdfId(
          offer.id
        );

        await createCustomerOfferPdf(
          offer
        );
      } catch (error) {
        console.error(
          "PDF oluşturma hatası:",
          error
        );

        setActionError(
          error instanceof Error
            ? error.message
            : "PDF oluşturulamadı."
        );
      } finally {
        setCreatingPdfId(
          null
        );
      }
    };

  const createJpg =
    async (
      offer:
        CustomerSystemOffer
    ) => {
      try {
        setActionError(null);

        setCreatingJpgId(
          offer.id
        );

        await createCustomerOfferJpg(
          offer
        );
      } catch (error) {
        console.error(
          "JPG oluşturma hatası:",
          error
        );

        setActionError(
          error instanceof Error
            ? error.message
            : "JPG oluşturulamadı."
        );
      } finally {
        setCreatingJpgId(
          null
        );
      }
    };

  /*
   * =======================================================
   * DELETE OFFER
   *
   * Stok düşüldükten sonra teklifi silmiyoruz.
   * Böylece stok hareketinin kaynağı kaybolmaz.
   * =======================================================
   */

  const removeOffer =
    async (
      offer:
        CustomerSystemOffer
    ) => {
      const offerName =
        offer.systemSnapshot
          .name;

      const confirmed =
        window.confirm(
          `${offerName} teklifini kaldırmak istediğinize emin misiniz?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setActionError(null);
        setSuccessMessage(null);

        setDeletingOfferId(
          offer.id
        );

        const response =
          await fetch(
            `/api/customer-system-offers/${offer.id}/delete`,
            {
              method:
                "DELETE",
            }
          );

        const result:
          ApiResponse<null> =
            await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Teklif kaldırılamadı."
          );
        }

        setOffers(
          (previous) =>
            previous.filter(
              (currentOffer) =>
                currentOffer.id !==
                offer.id
            )
        );
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Teklif kaldırılamadı."
        );
      } finally {
        setDeletingOfferId(
          null
        );
      }
    };

  /*
   * =======================================================
   * COUNTS / FILTERED VIEW
   * =======================================================
   */

  const viewCounts =
    useMemo(() => {
      return {
        all:
          offers.length,
        order_pending:
          offers.filter(
            (offer) =>
              getOfferStatus(
                offer
              ) ===
              "order_pending"
          ).length,
        installation_pending:
          offers.filter(
            (offer) =>
              getOfferStatus(
                offer
              ) ===
              "installation_pending"
          ).length,
        sold:
          offers.filter(
            isWorkflowFinalized
          ).length,
      };
    }, [offers]);

  const visibleOffers =
    useMemo(
      () => {
        if (
          workflowView ===
          "all"
        ) {
          return offers;
        }

        if (
          workflowView ===
          "sold"
        ) {
          return offers.filter(
            isWorkflowFinalized
          );
        }

        return offers.filter(
          (offer) =>
            getOfferStatus(
              offer
            ) ===
            workflowView
        );
      },
      [
        offers,
        workflowView,
      ]
    );

  const visibleCustomers =
    useMemo(() => {
      if (
        workflowView ===
        "all"
      ) {
        return customers;
      }

      return customers.filter(
        (customer) =>
          visibleOffers.some(
            (offer) =>
              offer.customerId ===
              customer.id
          )
      );
    }, [
      customers,
      visibleOffers,
      workflowView,
    ]);

  /*
   * =======================================================
   * OFFER ROW
   * =======================================================
   */

  const renderOffer = (
    offer:
      CustomerSystemOffer
  ) => {
    const status =
      getOfferStatus(
        offer
      );

    const finalized =
      isWorkflowFinalized(
        offer
      );

    const isDeleting =
      deletingOfferId ===
      offer.id;

    const isCreatingPdf =
      creatingPdfId ===
      offer.id;

    const isCreatingJpg =
      creatingJpgId ===
      offer.id;

    const isProcessing =
      processingOfferId ===
      offer.id;

    const canDelete =
      !finalized &&
      (
        status ===
          "offered" ||
        status ===
          "sold" ||
        status ===
          "order_pending"
      );

    const isLegacySold =
      status ===
        "sold" &&
      !finalized;

    return (
      <div
        key={offer.id}
        className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {
                offer
                  .systemSnapshot
                  .name
              }
            </span>

            <Badge
              variant="outline"
              className={
                getStatusBadgeClass(
                  offer
                )
              }
            >
              {getStatusLabel(
                offer
              )}
            </Badge>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            Ek indirim:{" "}
            {formatTry(
              offer.extraDiscountTry
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="sm:text-right">
            <div className="font-bold">
              {formatTry(
                offer.finalCustomerTotalTry
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Kazanç:{" "}
              {formatTry(
                offer.finalProfitTry
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                isProcessing ||
                isDeleting
              }
              onClick={() => {
                void openDetail(
                  offer
                );
              }}
            >
              <Eye className="size-4" />
              Detay
            </Button>

            {(status ===
                "offered" ||
              isLegacySold) && (
              <Button
                type="button"
                size="sm"
                disabled={
                  isProcessing ||
                  isDeleting
                }
                onClick={() => {
                  void runWorkflowAction(
                    offer,
                    "start-sale"
                  );
                }}
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {isProcessing
                  ? "İşleniyor..."
                  : isLegacySold
                    ? "Satışı İşle"
                    : "Satıldı"}
              </Button>
            )}

            {status ===
              "order_pending" && (
              <Button
                type="button"
                size="sm"
                disabled={
                  isProcessing ||
                  isDeleting
                }
                onClick={() => {
                  void openDetail(
                    offer
                  );
                }}
              >
                <PackageCheck className="size-4" />
                Siparişi Tamamla
              </Button>
            )}

            {status ===
              "installation_pending" && (
              <Button
                type="button"
                size="sm"
                disabled={
                  isProcessing ||
                  isDeleting
                }
                onClick={() => {
                  setPaymentOffer(
                    offer
                  );
                  setActionError(
                    null
                  );
                }}
              >
                <Wrench className="size-4" />
                Montaj Yapıldı
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                isCreatingPdf ||
                isCreatingJpg ||
                isDeleting ||
                isProcessing
              }
              onClick={() => {
                void createPdf(
                  offer
                );
              }}
            >
              {isCreatingPdf ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}

              {isCreatingPdf
                ? "PDF Oluşturuluyor..."
                : "PDF Oluştur"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                isCreatingPdf ||
                isCreatingJpg ||
                isDeleting ||
                isProcessing
              }
              onClick={() => {
                void createJpg(
                  offer
                );
              }}
            >
              {isCreatingJpg ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileImage className="size-4" />
              )}

              {isCreatingJpg
                ? "JPG Oluşturuluyor..."
                : "JPG Oluştur"}
            </Button>

            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={
                  isDeleting ||
                  isCreatingPdf ||
                  isCreatingJpg ||
                  isProcessing
                }
                onClick={() => {
                  void removeOffer(
                    offer
                  );
                }}
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}

                Kaldır
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* ===================================================
            PAGE HEADER
        =================================================== */}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">
              Müşteriler
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Müşterileri, araçlarını ve sistem tekliflerini yönetin.
            </p>
          </div>

          <Button
            type="button"
            onClick={() =>
              setCustomerDialog(
                true
              )
            }
          >
            <Plus className="size-4" />
            Yeni Müşteri
          </Button>
        </div>

        {/* ===================================================
            WORKFLOW STAGES
        =================================================== */}

        <div className="grid gap-2 rounded-2xl border bg-muted/10 p-2 sm:grid-cols-4">
          {WORKFLOW_VIEWS.map(
            (view) => {
              const active =
                workflowView ===
                view.value;

              const count =
                viewCounts[
                  view.value
                ];

              const ViewIcon =
                view.value ===
                "order_pending"
                  ? ShoppingCart
                  : view.value ===
                      "installation_pending"
                    ? Wrench
                    : view.value ===
                        "sold"
                      ? CircleCheckBig
                      : FileDown;

              return (
                <Button
                  key={view.value}
                  type="button"
                  variant={
                    active
                      ? "default"
                      : "ghost"
                  }
                  className="justify-between"
                  onClick={() =>
                    setWorkflowView(
                      view.value
                    )
                  }
                >
                  <span className="flex items-center gap-2">
                    <ViewIcon className="size-4" />
                    {view.label}
                  </span>

                  <span
                    className={
                      active
                        ? "rounded bg-primary-foreground/15 px-1.5 py-0.5 text-xs"
                        : "rounded bg-muted px-1.5 py-0.5 text-xs"
                    }
                  >
                    {count}
                  </span>
                </Button>
              );
            }
          )}
        </div>

        {actionError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {getViewTitle(
              workflowView
            )}
          </h2>

          <Badge variant="secondary">
            {visibleOffers.length}
          </Badge>
        </div>

        {/* ===================================================
            CUSTOMER ACCORDION
        =================================================== */}

        {visibleCustomers.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Bu adımda gösterilecek teklif bulunmuyor.
          </div>
        ) : (
          <Accordion
            value={
              openCustomerIds
            }
            onValueChange={
              setOpenCustomerIds
            }
            className="space-y-3"
          >
            {visibleCustomers.map(
              (customer) => {
                const customerVisibleOffers =
                  visibleOffers.filter(
                    (offer) =>
                      offer.customerId ===
                      customer.id
                  );

                const customerAllOffers =
                  offers.filter(
                    (offer) =>
                      offer.customerId ===
                      customer.id
                  );

                const vehicles =
                  workflowView ===
                  "all"
                    ? customer.vehicles
                    : customer.vehicles.filter(
                        (vehicle) =>
                          customerVisibleOffers.some(
                            (offer) =>
                              offer.vehicleId ===
                              vehicle.id
                          )
                      );

                return (
                  <AccordionItem
                    key={customer.id}
                    value={`customer-${customer.id}`}
                    className="overflow-hidden rounded-2xl border bg-background px-0 shadow-sm"
                  >
                    <div className="flex items-stretch gap-2 px-4">
                      <AccordionTrigger className="min-w-0 flex-1 py-5 text-left hover:no-underline">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <UserRound className="size-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold">
                              {customer.name}
                            </div>

                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {customer.phone ||
                                "-"}

                              {customer.email && (
                                <>
                                  {" "}•{" "}
                                  {customer.email}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="hidden shrink-0 gap-2 sm:flex">
                            <Badge variant="secondary">
                              {customer.vehicles.length}{" "}
                              Araç
                            </Badge>

                            <Badge variant="outline">
                              {workflowView ===
                              "all"
                                ? customerAllOffers.length
                                : customerVisibleOffers.length}{" "}
                              Teklif
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <div className="flex shrink-0 items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVehicleCustomer(
                              customer
                            )
                          }
                        >
                          <Car className="size-4" />
                          <span className="hidden sm:inline">
                            Araç Ekle
                          </span>
                        </Button>
                      </div>
                    </div>

                    <AccordionContent className="border-t px-4 pb-4 pt-4">
                      {vehicles.length ===
                      0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                          {workflowView ===
                          "all"
                            ? "Henüz araç eklenmemiş."
                            : "Bu adımda teklif bulunan araç yok."}
                        </div>
                      ) : (
                        <Accordion
                          value={
                            openVehicleIdsByCustomer[
                              customer.id
                            ] ?? []
                          }
                          onValueChange={(
                            values
                          ) =>
                            setOpenVehicleIdsByCustomer(
                              (previous) => ({
                                ...previous,
                                [customer.id]:
                                  values,
                              })
                            )
                          }
                          className="space-y-2"
                        >
                          {vehicles.map(
                            (vehicle) => {
                              const vehicleOffers =
                                visibleOffers.filter(
                                  (offer) =>
                                    offer.customerId ===
                                      customer.id &&
                                    offer.vehicleId ===
                                      vehicle.id
                                );

                              const allVehicleOffers =
                                offers.filter(
                                  (offer) =>
                                    offer.customerId ===
                                      customer.id &&
                                    offer.vehicleId ===
                                      vehicle.id
                                );

                              return (
                                <AccordionItem
                                  key={vehicle.id}
                                  value={`vehicle-${customer.id}-${vehicle.id}`}
                                  className="overflow-hidden rounded-xl border bg-muted/10 px-0"
                                >
                                  <div className="flex items-stretch gap-2 px-4">
                                    <AccordionTrigger className="min-w-0 flex-1 py-4 text-left hover:no-underline">
                                      <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
                                          <Car className="size-4" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="truncate font-medium">
                                            {vehicle.brand}{" "}
                                            {vehicle.model}
                                          </div>

                                          <div className="mt-1 text-xs text-muted-foreground">
                                            {vehicle.year ??
                                              "-"}

                                            {vehicle.plate && (
                                              <>
                                                {" "}•{" "}
                                                {vehicle.plate}
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        <Badge
                                          variant="secondary"
                                          className="hidden shrink-0 sm:inline-flex"
                                        >
                                          {workflowView ===
                                          "all"
                                            ? allVehicleOffers.length
                                            : vehicleOffers.length}{" "}
                                          Teklif
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>

                                    <div className="flex shrink-0 items-center">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                          setOfferCustomer(
                                            customer
                                          );

                                          setOfferVehicle(
                                            vehicle
                                          );
                                        }}
                                      >
                                        <Plus className="size-4" />
                                        <span className="hidden sm:inline">
                                          Sistem Teklifi
                                        </span>
                                      </Button>
                                    </div>
                                  </div>

                                  <AccordionContent className="border-t px-4 pb-4 pt-4">
                                    {vehicleOffers.length ===
                                    0 ? (
                                      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        Bu araç için bu adımda teklif bulunmuyor.
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {vehicleOffers.map(
                                          renderOffer
                                        )}
                                      </div>
                                    )}
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            }
                          )}
                        </Accordion>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              }
            )}
          </Accordion>
        )}
      </div>

      {/* =====================================================
          DIALOGS
      ===================================================== */}

      <CustomerFormDialog
        open={
          customerDialog
        }
        onOpenChange={
          setCustomerDialog
        }
        onCreated={() => {
          void load();
        }}
      />

      <VehicleFormDialog
        open={Boolean(
          vehicleCustomer
        )}
        customer={
          vehicleCustomer
        }
        onOpenChange={(
          open
        ) => {
          if (!open) {
            setVehicleCustomer(
              null
            );
          }
        }}
        onSaved={() => {
          setVehicleCustomer(
            null
          );

          void load();
        }}
      />

      <CustomerSystemOfferDialog
        open={Boolean(
          offerCustomer &&
            offerVehicle
        )}
        customer={
          offerCustomer
        }
        vehicle={
          offerVehicle
        }
        onOpenChange={(
          open
        ) => {
          if (!open) {
            setOfferCustomer(
              null
            );

            setOfferVehicle(
              null
            );
          }
        }}
        onSaved={() => {
          setOfferCustomer(
            null
          );

          setOfferVehicle(
            null
          );

          setWorkflowView(
            "all"
          );

          void load();
        }}
      />

      <CustomerOfferWorkflowDetailDialog
        open={
          detailOpen
        }
        onOpenChange={(
          open
        ) => {
          setDetailOpen(
            open
          );

          if (!open) {
            setDetailOffer(
              null
            );
            setDetailRequirements(
              []
            );
          }
        }}
        offer={
          detailOffer
        }
        stockRequirements={
          detailRequirements
        }
        loading={
          detailLoading
        }
        processing={
          Boolean(
            detailOffer &&
            processingOfferId ===
              detailOffer.id
          )
        }
        onOrderCompleted={
          completeOrderFromDetail
        }
      />

      <CustomerOfferPaymentDialog
        open={Boolean(
          paymentOffer
        )}
        onOpenChange={(
          open
        ) => {
          if (!open) {
            setPaymentOffer(
              null
            );
          }
        }}
        offer={
          paymentOffer
        }
        submitting={Boolean(
          paymentOffer &&
          processingOfferId ===
            paymentOffer.id
        )}
        onSubmit={
          completeSaleFromPayment
        }
      />
    </>
  );
}
