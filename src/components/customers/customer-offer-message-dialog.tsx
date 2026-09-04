/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MessageSquareText,
} from "lucide-react";

import {
  CustomerSystemOffer,
} from "@/types/customer-system-offer";

import {
  productCategoryDefinitions,
} from "@/lib/product-config";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Label,
} from "@/components/ui/label";

import {
  Textarea,
} from "@/components/ui/textarea";

/*
 * =========================================================
 * PROPS
 * =========================================================
 */

interface CustomerOfferMessageDialogProps {
  open: boolean;

  onOpenChange:
    (open: boolean) => void;

  offer:
    CustomerSystemOffer | null;
}

/*
 * =========================================================
 * FORMAT PRICE
 * =========================================================
 */

function formatTryForMessage(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

/*
 * =========================================================
 * UPPERCASE TR
 * =========================================================
 */

function upperTr(
  value:
    string | null | undefined
) {
  return (
    value ?? ""
  ).toLocaleUpperCase(
    "tr-TR"
  );
}

/*
 * =========================================================
 * SUB CATEGORY LABEL
 * =========================================================
 */

function getSubCategoryLabel(
  category: string,
  subCategory?:
    string
) {
  if (
    !subCategory
  ) {
    return "";
  }

  const definition =
    productCategoryDefinitions[
      category as keyof typeof productCategoryDefinitions
    ];

  if (
    !definition
  ) {
    return subCategory;
  }

  const subCategoryField =
    definition.fields.find(
      (
        field
      ) =>
        field.source ===
        "subCategory"
    );

  const option =
    subCategoryField
      ?.options
      ?.find(
        (
          item
        ) =>
          item.value ===
          subCategory
      );

  return (
    option?.label ??
    subCategory
  );
}

/*
 * =========================================================
 * CATEGORY LABEL
 * =========================================================
 */

function getCategoryLabel(
  category: string
) {
  const definition =
    productCategoryDefinitions[
      category as keyof typeof productCategoryDefinitions
    ];

  return (
    definition?.label ??
    category
  );
}

/*
 * =========================================================
 * ITEM LINE
 * =========================================================
 */

function buildItemLine(
  item:
    CustomerSystemOffer["systemSnapshot"]["items"][number]
) {
  const categoryLabel =
    upperTr(
      getCategoryLabel(
        item.category
      )
    );

  const subCategoryLabel =
    upperTr(
      getSubCategoryLabel(
        item.category,
        item.subCategory
      )
    );

  const brand =
    upperTr(
      item.brand
    );

  const model =
    upperTr(
      item.model
    );

  const quantity =
    Math.max(
      1,
      Number(
        item.quantity
      ) || 1
    );

  /*
   * Örn:
   *
   * HOPARLÖR/KOMPANENT HERTZ CK-165 1 ADET
   *
   * Alt kategori yoksa:
   *
   * AMFİ HERTZ CP-5.1K 1 ADET
   */

  const categoryPart =
    subCategoryLabel
      ? `${categoryLabel}/${subCategoryLabel}`
      : categoryLabel;

  return [
    categoryPart,
    brand,
    model,
    `${quantity} ADET`,
  ]
    .filter(
      (
        value
      ) =>
        Boolean(
          String(
            value
          ).trim()
        )
    )
    .join(
      " "
    );
}

/*
 * =========================================================
 * MESSAGE BUILDER
 * =========================================================
 */

function buildOfferMessage(
  offer:
    CustomerSystemOffer
) {
  const items =
    offer.systemSnapshot
      ?.items ??
    [];

  const lines =
    items
      .filter(
        (
          item
        ) =>
          Boolean(
            item.productId
          )
      )
      .map(
        (
          item
        ) =>
          buildItemLine(
            item
          )
      );

  /*
   * Customer'a özel ekstra indirim
   * finalCustomerTotalTry içerisine
   * zaten yansımış durumda.
   */

  const customerTotal =
    offer.finalCustomerTotalTry ??
    offer.systemSnapshot
      ?.customerTotalTry ??
    0;

  return [
    ...lines,

    "",

    `MONTAJ DAHİL ${formatTryForMessage(
      customerTotal
    )} TL`,
  ].join(
    "\n"
  );
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export function CustomerOfferMessageDialog({
  open,
  onOpenChange,
  offer,
}: CustomerOfferMessageDialogProps) {
  const generatedMessage =
    useMemo(
      () => {
        if (
          !offer
        ) {
          return "";
        }

        return buildOfferMessage(
          offer
        );
      },
      [
        offer,
      ]
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  /*
   * Popup her açıldığında
   * mesajı güncel tekliften üret.
   */
  useEffect(() => {
    if (
      !open
    ) {
      return;
    }

    setMessage(
      generatedMessage
    );
  }, [
    open,
    generatedMessage,
  ]);

  return (
    <Dialog
      open={
        open
      }
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="size-5" />

            Teklif Mesajı
          </DialogTitle>

          <DialogDescription>
            Müşteriye
            göndereceğiniz teklif
            mesajını buradan
            düzenleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="customerOfferMessage">
            Mesaj
          </Label>

          <Textarea
            id="customerOfferMessage"
            value={
              message
            }
            onChange={(
              event
            ) =>
              setMessage(
                event.target.value
              )
            }
            className="
              min-h-[420px]
              resize-y
              font-mono
              text-sm
              leading-7
            "
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setMessage(
                generatedMessage
              )
            }
          >
            Mesajı Yenile
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onOpenChange(
                false
              )
            }
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}