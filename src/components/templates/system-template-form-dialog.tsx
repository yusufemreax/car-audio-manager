/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from "lucide-react";

import {
  ProductCategory,
} from "@/types/product";

import {
  SystemTemplate,
  SystemTemplateItem,
  SystemTemplatePayload,
} from "@/types/system-template";

import {
  SystemLaborItem,
} from "@/types/system-labor";

import {
  productCategories,
  productCategoryDefinitions,
} from "@/lib/product-config";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SystemTemplateFormDialogProps {
  open: boolean;

  onOpenChange: (
    open: boolean
  ) => void;

  template?:
    | SystemTemplate
    | null;

  onSubmit: (
    payload: SystemTemplatePayload
  ) => Promise<void>;
}

interface TemplateFormState {
  name: string;

  laborItems:
    SystemLaborItem[];

  items:
    SystemTemplateItem[];
}

function createEmptyForm(): TemplateFormState {
  return {
    name: "",
    laborItems: [],
    items: [],
  };
}

function createItemId() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}


export function SystemTemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSubmit,
}: SystemTemplateFormDialogProps) {
  const [
    form,
    setForm,
  ] =
    useState<TemplateFormState>(
      createEmptyForm()
    );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    submitError,
    setSubmitError,
  ] = useState<string | null>(
    null
  );

  /*
   * =======================================================
   * SINGLE VISIBLE ITEM INDEXES
   * =======================================================
   *
   * Aynı anda sadece bir işçilik ve bir ürün kartı render edilir.
   * Mouse wheel ile aktif index değiştirilir.
   */
  const [
    visibleLaborIndex,
    setVisibleLaborIndex,
  ] = useState(0);

  const [
    visibleProductIndex,
    setVisibleProductIndex,
  ] = useState(0);

  const laborWheelLockedRef =
    useRef(false);

  const productWheelLockedRef =
    useRef(false);

  const isEditing =
    Boolean(template);

  /*
   * CATEGORY SELECT ITEMS
   *
   * value:
   * speaker
   *
   * label:
   * Hoparlör
   */
  const categorySelectItems =
    useMemo(
      () =>
        productCategories.map(
          (category) => ({
            value:
              category.value,

            label:
              category.label,
          })
        ),
      []
    );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSubmitError(null);

    setVisibleLaborIndex(
      0
    );

    setVisibleProductIndex(
      0
    );

    if (!template) {
      setForm(
        createEmptyForm()
      );

      return;
    }

    setForm({
      name:
        template.name,

      laborItems:
        (template.laborItems ?? [])
          .map(
            (
              item,
              index
            ) => ({
              ...item,
              sortOrder:
                index,
            })
          ),

      items:
        [...template.items]
          .sort(
            (
              first,
              second
            ) =>
              first.sortOrder -
              second.sortOrder
          )
          .map(
            (
              item,
              index
            ) => ({
              ...item,

              sortOrder:
                index,
            })
          ),
    });
  }, [
    open,
    template,
  ]);

  useEffect(() => {
    setVisibleLaborIndex(
      (
        previous
      ) =>
        Math.min(
          previous,
          Math.max(
            0,
            form.laborItems.length -
              1
          )
        )
    );
  }, [
    form.laborItems.length,
  ]);

  useEffect(() => {
    setVisibleProductIndex(
      (
        previous
      ) =>
        Math.min(
          previous,
          Math.max(
            0,
            form.items.length -
              1
          )
        )
    );
  }, [
    form.items.length,
  ]);

  const addLaborItem = () => {
    const nextIndex =
      form.laborItems.length;

    setForm(
      (previous) => ({
        ...previous,
        laborItems: [
          ...previous.laborItems,
          {
            id:
              createItemId(),
            label: "",
            amountTry: 0,
            sortOrder:
              previous.laborItems.length,
          },
        ],
      })
    );

    setVisibleLaborIndex(
      nextIndex
    );
  };

  const updateLaborItem = (
    itemId: string,
    updates: Partial<SystemLaborItem>
  ) => {
    setForm(
      (previous) => ({
        ...previous,
        laborItems:
          previous.laborItems.map(
            (item) =>
              item.id ===
              itemId
                ? {
                    ...item,
                    ...updates,
                  }
                : item
          ),
      })
    );
  };

  const removeLaborItem = (
    itemId: string
  ) => {
    setForm(
      (previous) => ({
        ...previous,
        laborItems:
          previous.laborItems
            .filter(
              (item) =>
                item.id !==
                itemId
            )
            .map(
              (
                item,
                index
              ) => ({
                ...item,
                sortOrder:
                  index,
              })
            ),
      })
    );
  };

  const laborCostTry =
    form.laborItems.reduce(
      (
        total,
        item
      ) =>
        total +
        (Number(
          item.amountTry
        ) || 0),
      0
    );

  const addItem = () => {
    const defaultCategory =
      productCategories[0]
        .value;

    const nextIndex =
      form.items.length;

    setForm(
      (previous) => ({
        ...previous,

        items: [
          ...previous.items,

          {
            id:
              createItemId(),

            label: "",

            category:
              defaultCategory,

            quantity: 1,

            sortOrder:
              previous.items
                .length,
          },
        ],
      })
    );

    setVisibleProductIndex(
      nextIndex
    );
  };

  const updateItem = (
    itemId: string,
    updates: Partial<SystemTemplateItem>
  ) => {
    setForm(
      (previous) => ({
        ...previous,

        items:
          previous.items.map(
            (item) =>
              item.id ===
              itemId
                ? {
                    ...item,
                    ...updates,
                  }
                : item
          ),
      })
    );
  };

  const removeItem = (
    itemId: string
  ) => {
    setForm(
      (previous) => ({
        ...previous,

        items:
          previous.items
            .filter(
              (item) =>
                item.id !==
                itemId
            )
            .map(
              (
                item,
                index
              ) => ({
                ...item,

                sortOrder:
                  index,
              })
            ),
      })
    );
  };

  const moveItem = (
    index: number,
    direction:
      | "up"
      | "down"
  ) => {
    setForm(
      (previous) => {
        const items = [
          ...previous.items,
        ];

        const targetIndex =
          direction === "up"
            ? index - 1
            : index + 1;

        if (
          targetIndex < 0 ||
          targetIndex >=
            items.length
        ) {
          return previous;
        }

        const temporary =
          items[index];

        items[index] =
          items[
            targetIndex
          ];

        items[targetIndex] =
          temporary;

        return {
          ...previous,

          items:
            items.map(
              (
                item,
                itemIndex
              ) => ({
                ...item,

                sortOrder:
                  itemIndex,
              })
            ),
        };
      }
    );
  };

  /*
   * =======================================================
   * MOUSE WHEEL NAVIGATION
   * =======================================================
   */

  const changeLaborByWheel = (
    direction:
      | "next"
      | "previous"
  ) => {
    if (
      laborWheelLockedRef.current ||
      form.laborItems.length <=
        1
    ) {
      return;
    }

    laborWheelLockedRef.current =
      true;

    setVisibleLaborIndex(
      (
        previous
      ) => {
        if (
          direction ===
          "next"
        ) {
          return Math.min(
            previous + 1,
            form.laborItems.length -
              1
          );
        }

        return Math.max(
          previous - 1,
          0
        );
      }
    );

    window.setTimeout(
      () => {
        laborWheelLockedRef.current =
          false;
      },
      180
    );
  };

  const changeProductByWheel = (
    direction:
      | "next"
      | "previous"
  ) => {
    if (
      productWheelLockedRef.current ||
      form.items.length <=
        1
    ) {
      return;
    }

    productWheelLockedRef.current =
      true;

    setVisibleProductIndex(
      (
        previous
      ) => {
        if (
          direction ===
          "next"
        ) {
          return Math.min(
            previous + 1,
            form.items.length -
              1
          );
        }

        return Math.max(
          previous - 1,
          0
        );
      }
    );

    window.setTimeout(
      () => {
        productWheelLockedRef.current =
          false;
      },
      180
    );
  };

  const getSubCategoryOptions = (
    category:
      ProductCategory
  ) => {
    const definition =
      productCategoryDefinitions[
        category
      ];

    const field =
      definition.fields.find(
        (item) =>
          item.source ===
          "subCategory"
      );

    return (
      field?.options ?? []
    );
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmitError(null);

    if (
      !form.name.trim()
    ) {
      setSubmitError(
        "Şablon adı zorunludur."
      );

      return;
    }

    for (
      const laborItem of
        form.laborItems
    ) {
      if (
        !laborItem.label.trim()
      ) {
        setSubmitError(
          "Tüm işçilik kalemlerine bir açıklama vermelisiniz."
        );

        return;
      }

      if (
        !Number.isFinite(
          Number(
            laborItem.amountTry
          )
        ) ||
        Number(
          laborItem.amountTry
        ) < 0
      ) {
        setSubmitError(
          `"${laborItem.label}" için geçerli bir TL tutarı giriniz.`
        );

        return;
      }
    }

    if (
      form.items.length ===
      0
    ) {
      setSubmitError(
        "Şablona en az bir ürün alanı eklemelisiniz."
      );

      return;
    }

    for (
      const item of
        form.items
    ) {
      if (
        !item.label.trim()
      ) {
        setSubmitError(
          "Tüm ürün alanlarına bir isim vermelisiniz."
        );

        return;
      }

      if (
        !Number.isInteger(
          item.quantity
        ) ||
        item.quantity <= 0
      ) {
        setSubmitError(
          `"${item.label}" için geçerli bir adet giriniz.`
        );

        return;
      }
    }

    const payload: SystemTemplatePayload =
      {
        name:
          form.name.trim(),

        laborItems:
          form.laborItems.map(
            (
              item,
              index
            ) => ({
              id:
                item.id,
              label:
                item.label.trim(),
              amountTry:
                Number(
                  item.amountTry
                ) || 0,
              sortOrder:
                index,
            })
          ),

        items:
          form.items.map(
            (
              item,
              index
            ) => ({
              id:
                item.id,

              label:
                item.label.trim(),

              category:
                item.category,

              ...(item.subCategory
                ? {
                    subCategory:
                      item.subCategory,
                  }
                : {}),

              quantity:
                item.quantity,

              sortOrder:
                index,
            })
          ),
      };

    setSubmitting(true);

    try {
      await onSubmit(
        payload
      );

      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Şablon kaydedilemedi."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(
        newOpen
      ) => {
        if (submitting) {
          return;
        }

        onOpenChange(
          newOpen
        );
      }}
    >
      <DialogContent
        className="flex flex-col overflow-hidden sm:max-w-3xl"
        style={{
          height:
            "min(860px, calc(100dvh - 32px))",
          maxHeight:
            "calc(100dvh - 32px)",
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing
              ? "Şablonu Düzenle"
              : "Yeni Sistem Şablonu"}
          </DialogTitle>

          <DialogDescription>
            Sistem hazırlarken
            kullanılacak ürün
            alanlarını ve işçilik
            kalemlerini tanımlayın.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={
            handleSubmit
          }
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
        >
          {/* GENERAL */}
          <div className="shrink-0 space-y-2">
            <Label htmlFor="templateName">
              Şablon Adı

              <span className="ml-1 text-destructive">
                *
              </span>
            </Label>

            <Input
              id="templateName"
              value={
                form.name
              }
              onChange={(
                event
              ) =>
                setForm(
                  (
                    previous
                  ) => ({
                    ...previous,
                    name:
                      event.target.value,
                  })
                )
              }
              placeholder="Örn: Middle Hoparlör Geliştirme"
              required
              disabled={
                submitting
              }
            />
          </div>

          <div className="shrink-0 border-t" />
          
          
          {/* LABOR ITEMS */}
          <div className="shrink-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  İşçilik Kalemleri
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  Amfi montajı, multimedya montajı gibi işçilikleri ayrı ayrı tanımlayın.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  submitting
                }
                onClick={
                  addLaborItem
                }
              >
                <Plus className="size-4" />
                İşçilik Ekle
              </Button>
            </div>
              {form.laborItems.length === 0 ? (
                  <button
                    type="button"
                    disabled={
                      submitting
                    }
                    onClick={
                      addLaborItem
                    }
                    className="flex min-h-24 w-full flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors hover:bg-muted/30"
                  >
                    <Plus className="mb-2 size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      İşçilik kalemi ekle
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      Örn: Amfi Montajı, Multimedya Montajı
                    </span>
                  </button>
                ) : (
                  <div
                    className="overflow-hidden rounded-xl"
                    onWheel={(
                      event
                    ) => {
                      event.preventDefault();

                      if (
                        Math.abs(
                          event.deltaY
                        ) <
                        4
                      ) {
                        return;
                      }

                      changeLaborByWheel(
                        event.deltaY >
                          0
                          ? "next"
                          : "previous"
                      );
                    }}
                  >
                    {form.laborItems
                      .slice(
                        visibleLaborIndex,
                        visibleLaborIndex +
                          1
                      )
                      .map(
                        (
                          laborItem
                        ) => (
                          <div
                            key={
                              laborItem.id
                            }
                            className="grid gap-3 rounded-xl border bg-muted/10 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
                          >
                            <div className="space-y-2">
                              <Label>
                                İşçilik Açıklaması
                              </Label>

                              <Input
                                value={
                                  laborItem.label
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLaborItem(
                                    laborItem.id,
                                    {
                                      label:
                                        event.target.value,
                                    }
                                  )
                                }
                                placeholder="Örn: Amfi Montajı"
                                disabled={
                                  submitting
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>
                                Tutar (TL)
                              </Label>

                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  ₺
                                </span>

                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="pl-7"
                                  value={
                                    laborItem.amountTry
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLaborItem(
                                      laborItem.id,
                                      {
                                        amountTry:
                                          Number(
                                            event.target.value
                                          ) || 0,
                                      }
                                    )
                                  }
                                  disabled={
                                    submitting
                                  }
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                              {form.laborItems.length >
                                1 && (
                                <span className="whitespace-nowrap text-xs text-muted-foreground">
                                  {visibleLaborIndex +
                                    1}
                                  /
                                  {
                                    form
                                      .laborItems
                                      .length
                                  }
                                </span>
                              )}

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={
                                  submitting
                                }
                                onClick={() =>
                                  removeLaborItem(
                                    laborItem.id
                                  )
                                }
                              >
                                <Trash2 className="size-4" />

                                <span className="sr-only">
                                  İşçilik kalemini sil
                                </span>
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                )}

            <div className="flex shrink-0 items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
              <span className="text-sm font-medium">
                Toplam İşçilik
              </span>
              <span className="font-semibold">
                {new Intl.NumberFormat(
                  "tr-TR",
                  {
                    style: "currency",
                    currency: "TRY",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                ).format(
                  laborCostTry
                )}
              </span>
            </div>
          </div>
            
          

          <div className="shrink-0 border-t" />

          {/* ITEMS */}
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Sistem İçeriği
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  Sistem
                  hazırlanırken hangi
                  ürünlerin seçileceğini
                  tanımlayın.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  submitting
                }
                onClick={
                  addItem
                }
              >
                <Plus className="size-4" />

                Alan Ekle
              </Button>
            </div>

            {form.items.length ===
            0 ? (
              <button
                type="button"
                disabled={
                  submitting
                }
                onClick={
                  addItem
                }
                className="flex min-h-0 flex-1 w-full flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors hover:bg-muted/30"
              >
                <Plus className="mb-2 size-5 text-muted-foreground" />

                <span className="text-sm font-medium">
                  İlk ürün alanını
                  ekle
                </span>

                <span className="mt-1 text-xs text-muted-foreground">
                  Hoparlör, amfi,
                  kablo veya başka
                  bir kategori ekleyin.
                </span>
              </button>
            ) : (
              <div
                className="min-h-0 flex-1 overflow-hidden"
                onWheel={(
                  event
                ) => {
                  event.preventDefault();

                  if (
                    Math.abs(
                      event.deltaY
                    ) <
                    4
                  ) {
                    return;
                  }

                  changeProductByWheel(
                    event.deltaY >
                      0
                      ? "next"
                      : "previous"
                  );
                }}
              >
                {form.items
                  .slice(
                    visibleProductIndex,
                    visibleProductIndex +
                      1
                  )
                  .map(
                    (
                      item
                    ) => {
                      const index =
                        visibleProductIndex;

                      const subCategories =
                        getSubCategoryOptions(
                          item.category
                        );

                      const subCategorySelectItems =
                        [
                          {
                            value:
                              "__all__",

                            label:
                              "Tümü",
                          },

                          ...subCategories.map(
                            (
                              option
                            ) => ({
                              value:
                                option.value,

                              label:
                                option.label,
                            })
                          ),
                        ];

                      return (
                        <div
                          key={
                            item.id
                          }
                          className="h-full overflow-y-auto rounded-xl border bg-muted/10 p-4"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                                {index +
                                  1}
                              </div>

                              {form.items.length >
                                1 && (
                                <span className="text-xs text-muted-foreground">
                                  {index +
                                    1}
                                  /
                                  {
                                    form.items
                                      .length
                                  }
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  submitting ||
                                  index ===
                                    0
                                }
                                onClick={() =>
                                  moveItem(
                                    index,
                                    "up"
                                  )
                                }
                              >
                                <ArrowUp className="size-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  submitting ||
                                  index ===
                                    form
                                      .items
                                      .length -
                                      1
                                }
                                onClick={() =>
                                  moveItem(
                                    index,
                                    "down"
                                  )
                                }
                              >
                                <ArrowDown className="size-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  submitting
                                }
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  removeItem(
                                    item.id
                                  )
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                              <Label>
                                Alan Adı

                                <span className="ml-1 text-destructive">
                                  *
                                </span>
                              </Label>

                              <Input
                                value={
                                  item.label
                                }
                                disabled={
                                  submitting
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    item.id,
                                    {
                                      label:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder="Örn: Hoparlör - Ön Kısım"
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>
                                Ürün Kategorisi

                                <span className="ml-1 text-destructive">
                                  *
                                </span>
                              </Label>

                              <Select
                                items={
                                  categorySelectItems
                                }
                                value={
                                  item.category
                                }
                                disabled={
                                  submitting
                                }
                                onValueChange={(
                                  newValue
                                ) => {
                                  const category =
                                    newValue as
                                      | ProductCategory
                                      | null;

                                  if (
                                    !category
                                  ) {
                                    return;
                                  }

                                  updateItem(
                                    item.id,
                                    {
                                      category,
                                      subCategory:
                                        undefined,
                                    }
                                  );
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Kategori seçiniz" />
                                </SelectTrigger>

                                <SelectContent>
                                  {productCategories.map(
                                    (
                                      category
                                    ) => (
                                      <SelectItem
                                        key={
                                          category.value
                                        }
                                        value={
                                          category.value
                                        }
                                      >
                                        {
                                          category.label
                                        }
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>
                                Alt Kategori
                              </Label>

                              {subCategories.length >
                              0 ? (
                                <Select
                                  items={
                                    subCategorySelectItems
                                  }
                                  value={
                                    item.subCategory ??
                                    "__all__"
                                  }
                                  disabled={
                                    submitting
                                  }
                                  onValueChange={(
                                    newValue
                                  ) => {
                                    const value =
                                      newValue ??
                                      "__all__";

                                    updateItem(
                                      item.id,
                                      {
                                        subCategory:
                                          value ===
                                          "__all__"
                                            ? undefined
                                            : value,
                                      }
                                    );
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>

                                  <SelectContent>
                                    <SelectItem value="__all__">
                                      Tümü
                                    </SelectItem>

                                    {subCategories.map(
                                      (
                                        option
                                      ) => (
                                        <SelectItem
                                          key={
                                            option.value
                                          }
                                          value={
                                            option.value
                                          }
                                        >
                                          {
                                            option.label
                                          }
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                                  Alt kategori bulunmuyor
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>
                                Adet

                                <span className="ml-1 text-destructive">
                                  *
                                </span>
                              </Label>

                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={
                                  item.quantity
                                }
                                disabled={
                                  submitting
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    item.id,
                                    {
                                      quantity:
                                        Number(
                                          event
                                            .target
                                            .value
                                        ),
                                    }
                                  )
                                }
                                required
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
              </div>
            )}
          </div>

          {submitError && (
            <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {
                submitError
              }
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={
                submitting
              }
              onClick={() =>
                onOpenChange(
                  false
                )
              }
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              disabled={
                submitting
              }
            >
              {submitting
                ? "Kaydediliyor..."
                : isEditing
                  ? "Değişiklikleri Kaydet"
                  : "Şablonu Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}