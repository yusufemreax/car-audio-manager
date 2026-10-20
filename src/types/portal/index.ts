export interface PortalUser {
  vehicles?: {
    id: string;
    generationId: string;
    label: string;
    plate?: string;
  }[];
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}
export interface PortalMultimedia {
  id: string;
  title: string;
  vehicle: string;
  generationId: string;
  description: string;
  screenSize: string;
  ram: string;
  storage: string;
  priceTry: number;
  images: { url: string; label: string }[];
  features: { label: string; value: string }[];
}
export interface PortalAppointment {
  id: string;
  reference: string;
  startsAt: string;
  status: "pending" | "confirmed" | "cancelled";
  customer: { firstName: string; lastName: string; phone: string };
  multimedia: { id: string; title: string; vehicle: string; priceTry: number };
}
export interface PortalAvailability {
  earliestDate: string;
  warning: string | null;
  days: { date: string; slots: string[] }[];
}
export interface PortalVehicle {
  id: string;
  name: string;
  models: {
    id: string;
    name: string;
    generations: {
      id: string;
      name: string;
      startYear: number;
      endYear: number;
    }[];
  }[];
}
