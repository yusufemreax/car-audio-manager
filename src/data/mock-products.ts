import { Product } from "@/types/product";

export const mockProducts: Product[] = [
  {
    id: "1",

    productCode: "HP-0001",

    brand: "Hertz",

    model: "SV 200.1",

    priceUsd: 0,
    suppliers: ["EGB"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    category: "speaker",

    subCategory: "midrange",

    specifications: {
      size: 8,
      rmsPower: 200,
      impedance: 4,
    },
  },

  {
    id: "2",

    productCode: "HP-0002",

    brand: "Pioneer",

    model: "TS-W312",

    priceUsd: 0,
    suppliers: ["EGB"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    category: "speaker",

    subCategory: "subwoofer",

    specifications: {
      size: 12,
      rmsPower: 500,
      impedance: 4,
    },
  },

  {
    id: "3",

    productCode: "HP-0003",

    brand: "JBL",

    model: "Stage3 637",

    priceUsd: 0,
    suppliers: ["EGB"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    category: "speaker",

    subCategory: "coaxial",

    specifications: {
      size: 6.5,
      rmsPower: 45,
      impedance: 3,
    },
  },

  {
    id: "4",

    productCode: "HP-0004",

    brand: "Audison",

    model: "AP 6.5",

    priceUsd: 0,
    suppliers: ["EGB"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    category: "speaker",

    subCategory: "midbass",

    specifications: {
      size: 6.5,
      rmsPower: 70,
      impedance: 4,
    },
  },
];