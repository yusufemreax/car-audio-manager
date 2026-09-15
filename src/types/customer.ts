export interface CustomerVehicle {
  id: string;
  vehicleBrandId?: string;
  vehicleModelId?: string;
  vehicleGenerationId?: string;
  vehicleGenerationName?: string;
  vehicleStartYear?: number;
  vehicleEndYear?: number;


  brand: string;

  model: string;

  year?: number;

  plate?: string;

  note?: string;
}

export interface Customer {
  id: string;

  name: string;

  phone?: string;

  email?: string;

  notes?: string;

  vehicles: CustomerVehicle[];

  createdAt: string;

  updatedAt: string;
}

export interface CustomerPayload {
  name: string;

  phone?: string;

  email?: string;

  notes?: string;
}

export interface CustomerVehiclePayload {
  vehicleBrandId?: string;
  vehicleModelId?: string;
  vehicleGenerationId?: string;
  vehicleGenerationName?: string;
  vehicleStartYear?: number;
  vehicleEndYear?: number;

  brand: string;

  model: string;

  year?: number;

  plate?: string;

  note?: string;
}