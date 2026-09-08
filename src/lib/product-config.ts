import {
  ProductCategory,
} from "@/types/product";

export interface ProductFieldOption {
  label: string;
  value: string;
}

export interface ProductFieldDefinition {
  key: string;
  label: string;
  source:
    | "subCategory"
    | "specifications";
  inputType:
    | "text"
    | "number"
    | "select"
    | "boolean"
    | "power-channel";
  required?: boolean;
  unit?: string;
  options?: ProductFieldOption[];

  /*
   * Sadece power-channel alanlarında kullanılır.
   * Örn: 4CH, 2CH, 1CH
   */
  defaultChannel?: string;

  /*
   * Alanın başka bir specification değerine göre
   * gösterilmesini sağlar.
   *
   * Örn: Subw alanları sadece channelCount = 5 iken görünür.
   */
  visibleWhen?: {
    key: string;
    /*
     * Tek bir değerde görünürlük için.
     * Mevcut kurallarla geriye dönük uyumludur.
     */
    value?: string;

    /*
     * Birden fazla değerde görünürlük için.
     * Örn. arka kamera kalitesi hem
     * front-rear hem front-rear-interior seçiminde görünür.
     */
    values?: string[];
  };
}

export interface ProductCategoryDefinition {
  value: ProductCategory;
  label: string;
  href: string;
  fields: ProductFieldDefinition[];
}

export const productCategoryDefinitions:
  Record<
    ProductCategory,
    ProductCategoryDefinition
  > = {
  speaker: {
    value: "speaker",
    label: "Hoparlör",
    href: "/products/speaker",
    fields: [
      {
        key: "subCategory",
        label: "Hoparlör Tipi",
        source: "subCategory",
        inputType: "select",
        required: true,
        options: [
          {
            value: "midrange",
            label: "Midrange",
          },
          {
            value: "midbass",
            label: "Midbass",
          },
          {
            value: "component",
            label: "Component",
          },
          {
            value: "coaxial",
            label: "Coaxial",
          },
          {
            value: "tweeter",
            label: "Tweeter",
          },
          {
            value: "subwoofer",
            label: "Subwoofer",
          },
        ],
      },
      {
        key: "size",
        label: "Boyut",
        source: "specifications",
        inputType: "number",
        required: true,
        unit: '"',
      },
      {
        key: "rmsPower",
        label: "RMS Güç",
        source: "specifications",
        inputType: "number",
        required: true,
        unit: "W",
      },
      {
        key: "impedance",
        label: "Empedans",
        source: "specifications",
        inputType: "number",
        required: true,
        unit: "Ω",
      },
    ],
  },

  amplifier: {
    value: "amplifier",
    label: "Amfi",
    href: "/products/amplifier",
    fields: [
      {
        key: "channelCount",
        label: "Kanal Sayısı",
        source: "specifications",
        inputType: "select",
        required: true,
        options: [
          {
            value: "mono",
            label: "Mono",
          },
          {
            value: "2",
            label: "2 Kanal",
          },
          {
            value: "4",
            label: "4 Kanal",
          },
          {
            value: "5",
            label: "5 Kanal",
          },
          {
            value: "6",
            label: "6 Kanal",
          },
          {
            value: "8",
            label: "8 Kanal",
          },
        ],
      },
      {
        key: "rmsAt4Ohm",
        label: "RMS 4Ω",
        source: "specifications",
        inputType: "power-channel",
        unit: "W",
        defaultChannel: "4CH",
      },
      {
        key: "rmsAt2Ohm",
        label: "RMS 2Ω",
        source: "specifications",
        inputType: "power-channel",
        unit: "W",
        defaultChannel: "4CH",
      },
      {
        key: "rmsAt1Ohm",
        label: "RMS 1Ω",
        source: "specifications",
        inputType: "power-channel",
        unit: "W",
        defaultChannel: "4CH",
      },
      {
        key: "bridgeRmsAt4Ohm",
        label: "Köprü 4Ω",
        source: "specifications",
        inputType: "power-channel",
        unit: "W",
        defaultChannel: "2CH",
      },
      {
        key: "bridgeRmsAt2Ohm",
        label: "Köprü 2Ω",
        source: "specifications",
        inputType: "power-channel",
        unit: "W",
        defaultChannel: "2CH",
      },
      {
        key: "subwooferRmsAt4Ohm",
        label: "Subw 4Ω",
        source: "specifications",
        inputType: "power-channel",
        unit: "W",
        defaultChannel: "1CH",
        visibleWhen: {
          key: "channelCount",
          value: "5",
        },
      },
      {
        key: "subwooferRmsAt2Ohm",
        label: "Subw 2Ω",
        source: "specifications",
        inputType: "power-channel",
        unit: "W",
        defaultChannel: "1CH",
        visibleWhen: {
          key: "channelCount",
          value: "5",
        },
      },
      {
        key: "hasSpeakerLevelInput",
        label: "Hoparlör Seviye Girişi",
        source: "specifications",
        inputType: "boolean",
      },
    ],
  },

  cable: {
    value: "cable",
    label: "Kablo",
    href: "/products/cable",
    fields: [
      {
        key: "subCategory",
        label: "Kablo Tipi",
        source: "subCategory",
        inputType: "select",
        required: true,
        options: [
          {
            value: "power-cable",
            label: "Güç Kablosu",
          },
          {
            value: "rca-cable",
            label: "RCA Kablo",
          },
          {
            value: "rca-y-cable",
            label: "RCA Y Kablo",
          },
          {
            value: "speaker-cable",
            label: "Hoparlör Kablosu",
          },
        ],
      },
      {
        key: "crossSection",
        label: "Kesit",
        source: "specifications",
        inputType: "number",
        required: true,
        unit: "GA",
      },
      {
        key: "isOfc",
        label: "OFC",
        source: "specifications",
        inputType: "boolean",
      },
    ],
  },

  "deck-converter": {
    value: "deck-converter",
    label: "Teyp Dönüştürücü",
    href: "/products/deck-converter",
    fields: [
      {
        key: "channelCount",
        label: "Kanal Sayısı",
        source: "specifications",
        inputType: "number",
        required: true,
      },
    ],
  },

  "distribution-block": {
    value: "distribution-block",
    label: "Dağıtım Bloğu",
    href: "/products/distribution-block",
    fields: [
      {
        key: "outputCount",
        label: "Çıkış Sayısı",
        source: "specifications",
        inputType: "number",
        required: true,
      },
    ],
  },

  enclosure: {
    value: "enclosure",
    label: "Kabin",
    href: "/products/enclosure",
    fields: [
      {
        key: "size",
        label: "Boyut",
        source: "specifications",
        inputType: "select",
        required: true,
        options: [
          {
            value: "20cm",
            label: "20 CM",
          },
          {
            value: "25cm",
            label: "25 CM",
          },
          {
            value: "30cm",
            label: "30 CM",
          },
          {
            value: "16x4",
            label: "16x4",
          },
          {
            value: "20x4",
            label: "20x4",
          },
          {
            value: "16x4-2x10",
            label: "16x4 + 2x10",
          },
          {
            value: "20x4-2x10",
            label: "20x4 + 2x10",
          },
        ],
      },
      {
        key: "isSpl",
        label: "SPL",
        source: "specifications",
        inputType: "boolean",
      },
    ],
  },

  "dsp-processor": {
    value: "dsp-processor",
    label: "DSP İşlemci",
    href: "/products/dsp-processor",
    fields: [
      {
        key: "channelCount",
        label: "Kanal Sayısı",
        source: "specifications",
        inputType: "number",
        required: true,
      },
      {
        key: "hasSpeakerLevelInput",
        label: "Hoparlör Seviye Girişi",
        source: "specifications",
        inputType: "boolean",
      },
    ],
  },

  "installation-equipment": {
    value: "installation-equipment",
    label: "Montaj Ekipmanı",
    href: "/products/installation-equipment",
    fields: [],
  },

  multimedia: {
    value: "multimedia",
    label: "Multimedya",
    href: "/products/multimedia",
    fields: [
      {
        key: "screenSize",
        label: "Ekran Boyutu",
        source: "specifications",
        inputType: "select",
        required: true,
        unit: '"',
        options: [
          { value: "7", label: '7"' },
          { value: "8", label: '8"' },
          { value: "9", label: '9"' },
          { value: "9.7", label: '9.7"' },
          { value: "10.1", label: '10.1"' },
          { value: "10.6", label: '10.6"' },
          { value: "11.8", label: '11.8"' },
          { value: "13.1", label: '13.1"' },
        ],
      },
      {
        key: "ram",
        label: "RAM",
        source: "specifications",
        inputType: "select",
        required: true,
        unit: "GB",
        options: [
          { value: "2", label: "2 GB" },
          { value: "4", label: "4 GB" },
          { value: "6", label: "6 GB" },
          { value: "8", label: "8 GB" },
        ],
      },
      {
        key: "storage",
        label: "Depolama",
        source: "specifications",
        inputType: "select",
        required: true,
        unit: "GB",
        options: [
          { value: "32", label: "32 GB" },
          { value: "64", label: "64 GB" },
          { value: "128", label: "128 GB" },
        ],
      },
      {
        key: "androidVersion",
        label: "Android Sürümü",
        source: "specifications",
        inputType: "select",
        required: true,
        options: [
          { value: "10", label: "Android 10" },
          { value: "13", label: "Android 13" },
        ],
      },
      {
        key: "displayTechnology",
        label: "Ekran Teknolojisi",
        source: "specifications",
        inputType: "select",
        required: true,
        options: [
          { value: "ips", label: "IPS" },
          { value: "qled", label: "QLED" },
        ],
      },
      {
        key: "hasFrontRecordingCamera",
        label: "Ön Kayıt Kamerası",
        source: "specifications",
        inputType: "boolean",
      },
      {
        key: "hasCarPlay",
        label: "CarPlay",
        source: "specifications",
        inputType: "boolean",
      },
      {
        key: "hasDsp",
        label: "DSP",
        source: "specifications",
        inputType: "boolean",
      },
    ],
  },

  "multimedia-frame": {
    value: "multimedia-frame",
    label: "Multimedya Çerçevesi",
    href: "/products/multimedia-frame",
    fields: [
      {
        key: "size",
        label: "Boyut",
        source: "specifications",
        inputType: "select",
        required: true,
        unit: '"',
        options: [
          { value: "9", label: '9"' },
          { value: "9.7", label: '9.7"' },
          { value: "10.1", label: '10.1"' },
        ],
      },
      {
        key: "vehicleBrand",
        label: "Araç Markası",
        source: "specifications",
        inputType: "text",
        required: true,
      },
      {
        key: "vehicleModel",
        label: "Araç Modeli",
        source: "specifications",
        inputType: "text",
        required: true,
      },
      {
        key: "compatibleYears",
        label: "Uyumlu Yıllar",
        source: "specifications",
        inputType: "text",
        required: true,
      },
    ],
  },

  "vehicle-camera": {
    value: "vehicle-camera",
    label: "Araç Kamerası",
    href: "/products/vehicle-camera",
    fields: [
      {
        key: "cameraSetup",
        label: "Kamera Tipi",
        source: "specifications",
        inputType: "select",
        required: true,
        options: [
          {
            value: "front",
            label: "Ön",
          },
          {
            value: "front-rear",
            label: "Ön - Arka",
          },
          {
            value: "front-rear-interior",
            label: "Ön - Arka - İç",
          },
        ],
      },
      {
        key: "frontCameraQuality",
        label: "Ön Kamera Kalitesi",
        source: "specifications",
        inputType: "select",
        required: true,
        visibleWhen: {
          key: "cameraSetup",
          values: [
            "front",
            "front-rear",
            "front-rear-interior",
          ],
        },
        options: [
          { value: "480p", label: "480p" },
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p HD" },
          { value: "2k", label: "2K" },
          { value: "4k", label: "4K" },
        ],
      },
      {
        key: "rearCameraQuality",
        label: "Arka Kamera Kalitesi",
        source: "specifications",
        inputType: "select",
        required: true,
        visibleWhen: {
          key: "cameraSetup",
          values: [
            "front-rear",
            "front-rear-interior",
          ],
        },
        options: [
          { value: "480p", label: "480p" },
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p HD" },
          { value: "2k", label: "2K" },
          { value: "4k", label: "4K" },
        ],
      },
      {
        key: "interiorCameraQuality",
        label: "İç Kamera Kalitesi",
        source: "specifications",
        inputType: "select",
        required: true,
        visibleWhen: {
          key: "cameraSetup",
          value: "front-rear-interior",
        },
        options: [
          { value: "480p", label: "480p" },
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p HD" },
          { value: "2k", label: "2K" },
          { value: "4k", label: "4K" },
        ],
      },
      {
        key: "hasAdas",
        label: "ADAS Desteği",
        source: "specifications",
        inputType: "boolean",
      },
      {
        key: "hasParkingMode",
        label: "Park Modu",
        source: "specifications",
        inputType: "boolean",
      },
      {
        key: "hasShockSensor",
        label: "Sallantı Sensörü",
        source: "specifications",
        inputType: "boolean",
      },
      {
        key: "sdCardSupport",
        label: "SD Kart Desteği",
        source: "specifications",
        inputType: "select",
        required: true,
        options: [
          { value: "16", label: "16 GB" },
          { value: "32", label: "32 GB" },
          { value: "64", label: "64 GB" },
          { value: "128", label: "128 GB" },
          { value: "256", label: "256 GB" },
          { value: "512", label: "512 GB" },
        ],
      },
    ],
  },
};

export const productCategories =
  Object.values(
    productCategoryDefinitions
  );

export function isProductCategory(
  value: string
): value is ProductCategory {
  return value in productCategoryDefinitions;
}
