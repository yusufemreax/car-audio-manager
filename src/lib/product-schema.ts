import { z } from "zod";

export const productCategorySchema =
  z.enum([
    "speaker",
    "amplifier",
    "cable",
    "deck-converter",
    "distribution-block",
    "enclosure",
    "dsp-processor",
    "installation-equipment",
    "multimedia",
    "multimedia-frame",
  ]);

  const multimediaFrameSizes = [
    "9",
    "10.1",
  ] as const;

  const multimediaScreenSizes = [
    "7",
    "8",
    "9",
    "9.7",
    "10.1",
    "10.6",
    "11.8",
    "13.1",
  ] as const;

  const multimediaRamOptions = [
    "2",
    "4",
    "6",
    "8",
  ] as const;

  const multimediaStorageOptions = [
    "32",
    "64",
    "128",
  ] as const;

  const androidVersions = [
    "10",
    "13",
  ] as const;

  const displayTechnologies = [
    "ips",
    "qled",
  ] as const;

const speakerTypes = [
  "midrange",
  "midbass",
  "component",
  "coaxial",
  "tweeter",
  "subwoofer",
] as const;

const cableTypes = [
  "power-cable",
  "rca-cable",
  "rca-y-cable",
  "speaker-cable",
] as const;

const enclosureSizes = [
  "20cm",
  "25cm",
  "30cm",
  "16x4",
  "20x4",
  "16x4-2x10",
  "20x4-2x10",
] as const;

export const productInputSchema = z
  .object({
    productCode: z
      .string()
      .trim()
      .min(
        1,
        "Ürün kodu zorunludur."
      )
      .max(
        100,
        "Ürün kodu en fazla 100 karakter olabilir."
      )
      .transform((value) =>
        value.toUpperCase()
      ),

    brand: z
      .string()
      .trim()
      .min(
        1,
        "Marka zorunludur."
      )
      .max(150),

    model: z
      .string()
      .trim()
      .min(
        1,
        "Model zorunludur."
      )
      .max(200),
    priceUsd: z
      .number({
        message:
          "Dolar fiyatı sayı olmalıdır.",
      })
      .finite()
      .positive(
        "Dolar fiyatı sıfırdan büyük olmalıdır."
      ),
    category:
      productCategorySchema,

    subCategory: z
      .string()
      .trim()
      .min(1)
      .optional(),

    specifications: z.record(
      z.string(),
      z.union([
        z.string(),
        z.number().finite(),
        z.boolean(),
      ])
    ),

    description: z
      .string()
      .trim()
      .max(2000)
      .optional(),
  })
  .superRefine((product, ctx) => {
    if (      product.category ===      "deck-converter"    ) {
      const channelCount =
        product.specifications[
          "channelCount"
        ];

      if (
        typeof channelCount !== "number" ||
        !Number.isFinite(channelCount) ||
        channelCount <= 0
      ) {
        ctx.addIssue({
          code: "custom",

          path: [
            "specifications",
            "channelCount",
          ],

          message:
            "Kanal sayısı sıfırdan büyük olmalıdır.",
        });
      }
    }    
    if (      product.category ===      "distribution-block"    ) {
      const outputCount =
        product.specifications[
          "outputCount"
        ];

      if (
        typeof outputCount !== "number" ||
        !Number.isFinite(outputCount) ||
        outputCount <= 0
      ) {
        ctx.addIssue({
          code: "custom",

          path: [
            "specifications",
            "outputCount",
          ],

          message:
            "Çıkış sayısı sıfırdan büyük olmalıdır.",
        });
      }
    }
    if (      product.category ===      "enclosure"    ) {
      const size =
        product.specifications[
          "size"
        ];

      if (
        typeof size !== "string" ||
        !enclosureSizes.includes(
          size as
            (typeof enclosureSizes)[number]
        )
      ) {
        ctx.addIssue({
          code: "custom",

          path: [
            "specifications",
            "size",
          ],

          message:
            "Geçerli bir kabin boyutu seçilmelidir.",
        });
      }

      const isSpl =
        product.specifications[
          "isSpl"
        ];

      if (
        typeof isSpl !== "boolean"
      ) {
        ctx.addIssue({
          code: "custom",

          path: [
            "specifications",
            "isSpl",
          ],

          message:
            "SPL bilgisi belirtilmelidir.",
        });
      }
    }
    if (      product.category ===      "dsp-processor"    ) {
      const channelCount =
        product.specifications[
          "channelCount"
        ];

      if (
        typeof channelCount !== "number" ||
        !Number.isFinite(channelCount) ||
        channelCount <= 0
      ) {
        ctx.addIssue({
          code: "custom",

          path: [
            "specifications",
            "channelCount",
          ],

          message:
            "Kanal sayısı sıfırdan büyük olmalıdır.",
        });
      }

      const hasSpeakerLevelInput =
        product.specifications[
          "hasSpeakerLevelInput"
        ];

      if (
        typeof hasSpeakerLevelInput !==
        "boolean"
      ) {
        ctx.addIssue({
          code: "custom",

          path: [
            "specifications",
            "hasSpeakerLevelInput",
          ],

          message:
            "SPK girişi bilgisi belirtilmelidir.",
        });
      }
    }
    if (product.category === "cable") {
      if (
        !product.subCategory ||
        !cableTypes.includes(
          product.subCategory as
            (typeof cableTypes)[number]
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["subCategory"],
          message:
            "Geçerli bir kablo tipi seçilmelidir.",
        });
      }

      const crossSection =
        product.specifications[
          "crossSection"
        ];

      if (
        typeof crossSection !== "number" ||
        !Number.isFinite(crossSection) ||
        crossSection < 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: [
            "specifications",
            "crossSection",
          ],
          message:
            "Kesit 0 veya daha büyük olmalıdır.",
        });
      }

      const isOfc =
        product.specifications[
          "isOfc"
        ];

      if (
        typeof isOfc !== "boolean"
      ) {
        ctx.addIssue({
          code: "custom",
          path: [
            "specifications",
            "isOfc",
          ],
          message:
            "OFC bilgisi belirtilmelidir.",
        });
      }
    }
    if (product.category === "speaker") {
      if (
        !product.subCategory ||
        !speakerTypes.includes(
          product.subCategory as
            (typeof speakerTypes)[number]
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["subCategory"],
          message:
            "Geçerli bir hoparlör türü seçilmelidir.",
        });
      }

      const requiredNumbers = [
        {
          key: "size",
          label: "Boyut",
        },
        {
          key: "rmsPower",
          label: "Güç RMS",
        },
        {
          key: "impedance",
          label: "Direnç",
        },
      ];

      for (const item of requiredNumbers) {
        const value =
          product.specifications[
            item.key
          ];

        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value <= 0
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "specifications",
              item.key,
            ],
            message: `${item.label} sıfırdan büyük bir sayı olmalıdır.`,
          });
        }
      }
    }
    if (product.category === "amplifier") {
      const allowedChannels = [
        "mono",
        "2",
        "4",
        "5",
        "6",
        "8",
      ];

      const channelCount =
        product.specifications[
          "channelCount"
        ];

      if (
        typeof channelCount !== "string" ||
        !allowedChannels.includes(
          channelCount
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: [
            "specifications",
            "channelCount",
          ],
          message:
            "Geçerli bir kanal sayısı seçilmelidir.",
        });
      }

      const rmsFields = [
        {
          key: "rmsAt4Ohm",
          label: "4 Ohm RMS",
        },
        {
          key: "rmsAt2Ohm",
          label: "2 Ohm RMS",
        },
        {
          key: "rmsAt1Ohm",
          label: "1 Ohm RMS",
        },
        {
          key: "bridgeRms",
          label: "Köprü RMS",
        },
      ];

      for (const field of rmsFields) {
        const value =
          product.specifications[
            field.key
          ];

        if (
          value !== undefined &&
          (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0
          )
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "specifications",
              field.key,
            ],
            message: `${field.label} geçerli bir sayı olmalıdır.`,
          });
        }
      }

      const hasSpeakerLevelInput =
        product.specifications[
          "hasSpeakerLevelInput"
        ];

      if (
        typeof hasSpeakerLevelInput !==
        "boolean"
      ) {
        ctx.addIssue({
          code: "custom",
          path: [
            "specifications",
            "hasSpeakerLevelInput",
          ],
          message:
            "SPK girişi bilgisi belirtilmelidir.",
        });
      }
    }
    if (    product.category ===    "multimedia"  ) {
    const screenSize =
      product.specifications[
        "screenSize"
      ];

    if (
      typeof screenSize !== "string" ||
      !multimediaScreenSizes.includes(
        screenSize as
          (typeof multimediaScreenSizes)[number]
      )
    ) {
      ctx.addIssue({
        code: "custom",

        path: [
          "specifications",
          "screenSize",
        ],

        message:
          "Geçerli bir ekran boyutu seçilmelidir.",
      });
    }

    const ram =
      product.specifications[
        "ram"
      ];

    if (
      typeof ram !== "string" ||
      !multimediaRamOptions.includes(
        ram as
          (typeof multimediaRamOptions)[number]
      )
    ) {
      ctx.addIssue({
        code: "custom",

        path: [
          "specifications",
          "ram",
        ],

        message:
          "Geçerli bir RAM değeri seçilmelidir.",
      });
    }

    const storage =
      product.specifications[
        "storage"
      ];

    if (
      typeof storage !== "string" ||
      !multimediaStorageOptions.includes(
        storage as
          (typeof multimediaStorageOptions)[number]
      )
    ) {
      ctx.addIssue({
        code: "custom",

        path: [
          "specifications",
          "storage",
        ],

        message:
          "Geçerli bir hafıza değeri seçilmelidir.",
      });
    }

    const androidVersion =
      product.specifications[
        "androidVersion"
      ];

    if (
      typeof androidVersion !== "string" ||
      !androidVersions.includes(
        androidVersion as
          (typeof androidVersions)[number]
      )
    ) {
      ctx.addIssue({
        code: "custom",

        path: [
          "specifications",
          "androidVersion",
        ],

        message:
          "Geçerli bir Android sürümü seçilmelidir.",
      });
    }

    const displayTechnology =
      product.specifications[
        "displayTechnology"
      ];

    if (
      typeof displayTechnology !==
        "string" ||
      !displayTechnologies.includes(
        displayTechnology as
          (typeof displayTechnologies)[number]
      )
    ) {
      ctx.addIssue({
        code: "custom",

        path: [
          "specifications",
          "displayTechnology",
        ],

        message:
          "Geçerli bir ekran özelliği seçilmelidir.",
      });
    }

    const booleanFields = [
      {
        key:
          "hasFrontRecordingCamera",
        label:
          "Ön kayıt kamerası",
      },
      {
        key: "hasCarPlay",
        label: "CarPlay",
      },
      {
        key: "hasDsp",
        label: "DSP",
      },
    ];

    for (
      const field of
        booleanFields
    ) {
      const value =
        product.specifications[
          field.key
        ];

      if (
        typeof value !==
        "boolean"
      ) {
        ctx.addIssue({
          code: "custom",

          path: [
            "specifications",
            field.key,
          ],

          message:
            `${field.label} bilgisi belirtilmelidir.`,
        });
      }
    }
    }
    if (  product.category ===  "multimedia-frame") {
      const size =
      product.specifications[
        "size"
      ];

    if (
      typeof size !== "string" ||
      !multimediaFrameSizes.includes(
        size as
          (typeof multimediaFrameSizes)[number]
      )
    ) {
      ctx.addIssue({
        code: "custom",

        path: [
          "specifications",
          "size",
        ],

        message:
          "Geçerli bir çerçeve boyutu seçilmelidir.",
      });
    }
      const requiredFields = [
        {
          key: "vehicleBrand",
          label: "Araç markası",
        },
        {
          key: "vehicleModel",
          label: "Araç modeli",
        },
        {
          key: "compatibleYears",
          label: "Uyumlu yıllar",
        },
      ];

      for (
        const field of
          requiredFields
      ) {
        const value =
          product.specifications[
            field.key
          ];

        if (
          typeof value !==
            "string" ||
          !value.trim()
        ) {
          ctx.addIssue({
            code: "custom",

            path: [
              "specifications",
              field.key,
            ],

            message:
              `${field.label} zorunludur.`,
          });
        }
      }
    }

});

export type ProductInput =
  z.infer<
    typeof productInputSchema
  >;