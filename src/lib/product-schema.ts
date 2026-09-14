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
    "vehicle-camera",
  ]);

  const multimediaFrameSizes = [
    "9",
    "9.7",
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

const vehicleCameraSetups = [
  "front",
  "front-rear",
  "front-rear-interior",
  "six-channel",
] as const;

const vehicleCameraQualities = [
  "480p",
  "720p",
  "1080p",
  "2k",
  "4k",
] as const;

const sixChannelCameraQualities = [
  "720p",
  "1080p",
  "2k",
  "4k",
] as const;

const sixChannelMonitorScreenSizes = [
  "7",
  "9",
  "10.1",
] as const;

const vehicleCameraSdCardOptions = [
  "16",
  "32",
  "64",
  "128",
  "256",
  "512",
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

    const coreCount =
      String(
        product.specifications[
          "coreCount"
        ] ?? ""
      ).trim();

    if (
      coreCount !== "4" &&
      coreCount !== "8"
    ) {
      ctx.addIssue({
        code: "custom",

        path: [
          "specifications",
          "coreCount",
        ],

        message:
          "Geçerli bir çekirdek sayısı seçilmelidir.",
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
    if (product.category === "vehicle-camera") {
      const cameraSetup =
        product.specifications[
          "cameraSetup"
        ];

      if (
        typeof cameraSetup !== "string" ||
        !vehicleCameraSetups.includes(
          cameraSetup as
            (typeof vehicleCameraSetups)[number]
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: [
            "specifications",
            "cameraSetup",
          ],
          message:
            "Geçerli bir kamera tipi seçilmelidir.",
        });
      }

      const validateCameraQuality = (
        key: string,
        label: string
      ) => {
        const value =
          product.specifications[
            key
          ];

        if (
          typeof value !== "string" ||
          !vehicleCameraQualities.includes(
            value as
              (typeof vehicleCameraQualities)[number]
          )
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "specifications",
              key,
            ],
            message:
              `${label} için geçerli bir kalite seçilmelidir.`,
          });
        }
      };

      if (
        cameraSetup === "front" ||
        cameraSetup === "front-rear" ||
        cameraSetup === "front-rear-interior"
      ) {
        validateCameraQuality(
          "frontCameraQuality",
          "Ön kamera"
        );
      }

      if (
        cameraSetup === "front-rear" ||
        cameraSetup === "front-rear-interior"
      ) {
        validateCameraQuality(
          "rearCameraQuality",
          "Arka kamera"
        );
      }

      if (
        cameraSetup === "front-rear-interior"
      ) {
        validateCameraQuality(
          "interiorCameraQuality",
          "İç kamera"
        );
      }

      if (
        cameraSetup === "six-channel"
      ) {
        const cameraQuality =
          product.specifications[
            "sixChannelCameraQuality"
          ];

        if (
          typeof cameraQuality !== "string" ||
          !sixChannelCameraQualities.includes(
            cameraQuality as
              (typeof sixChannelCameraQualities)[number]
          )
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "specifications",
              "sixChannelCameraQuality",
            ],
            message:
              "6 kanal kamera sistemi için geçerli bir kamera kalitesi seçilmelidir.",
          });
        }

        const monitorScreenSize =
          product.specifications[
            "monitorScreenSize"
          ];

        if (
          typeof monitorScreenSize !== "string" ||
          !sixChannelMonitorScreenSizes.includes(
            monitorScreenSize as
              (typeof sixChannelMonitorScreenSizes)[number]
          )
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "specifications",
              "monitorScreenSize",
            ],
            message:
              "6 kanal kamera sistemi için geçerli bir monitör ekran boyutu seçilmelidir.",
          });
        }
      }

      const booleanFields = [
        {
          key: "hasAdas",
          label: "ADAS desteği",
        },
        {
          key: "hasParkingMode",
          label: "Park modu",
        },
        {
          key: "hasShockSensor",
          label: "Sallantı sensörü",
        },
      ];

      for (const field of booleanFields) {
        const value =
          product.specifications[
            field.key
          ];

        if (
          typeof value !== "boolean"
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

      const sdCardSupport =
        product.specifications[
          "sdCardSupport"
        ];

      if (
        typeof sdCardSupport !== "string" ||
        !vehicleCameraSdCardOptions.includes(
          sdCardSupport as
            (typeof vehicleCameraSdCardOptions)[number]
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: [
            "specifications",
            "sdCardSupport",
          ],
          message:
            "Geçerli bir SD kart desteği seçilmelidir.",
        });
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