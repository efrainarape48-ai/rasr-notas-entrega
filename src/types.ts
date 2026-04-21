export interface CompanyProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logoData?: string;
  footerText?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  taxId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryNoteLine {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export type DeliveryNoteStatus = 'draft' | 'issued' | 'cancelled' | 'canceled';

export interface DeliveryNote {
  id: string;
  noteNumber: string;
  issueDate: string;
  status: DeliveryNoteStatus | string;

  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerEmail?: string;
  customerTaxId?: string;

  lines: DeliveryNoteLine[];
  subtotal: number;
  total: number;
  notes?: string;

  createdAt?: string;
  updatedAt?: string;
}
