export interface CompanyProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId?: string;
  logoData?: string;
  footerText?: string;
  updatedAt?: string;
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

export interface Item {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  categoria: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type DeliveryStatus = 'draft' | 'delivered' | 'canceled';
export type DeliveryNoteStatus = DeliveryStatus;

export interface DeliveryNoteLine {
  id?: string;
  itemId?: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface DeliveryNote {
  id: string;
  noteNumber: string;
  issueDate: string;
  status: DeliveryStatus;

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
  signerName?: string;
  signatureSvg?: string;
  inventoryApplied?: boolean;

  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | string;
  notifications: boolean;
  autoPdf: boolean;
  currency: string;
  numberingFormat: string;
  language: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  company?: CompanyProfile;
}

export type Screen =
  | 'login'
  | 'register'
  | 'register-company'
  | 'dashboard'
  | 'customers'
  | 'customer-form'
  | 'items'
  | 'item-form'
  | 'delivery-notes'
  | 'delivery-note-form'
  | 'delivery-note-detail'
  | 'settings';
