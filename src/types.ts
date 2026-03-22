export type DeliveryStatus = 'draft' | 'delivered' | 'canceled';

export interface CompanyProfile {
  name: string;
  phone: string;
  email: string;
  address: string;
  taxId?: string;
  logoUrl?: string;
  logoData?: string; // Base64 or SVG string
  footerText?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  company?: CompanyProfile;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
  autoPdf: boolean;
  currency: string;
  numberingFormat: string;
  language: 'es' | 'en';
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryNoteLine {
  itemId: string;
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
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  lines: DeliveryNoteLine[];
  subtotal: number;
  total: number;
  notes?: string;
  signerName?: string;
  signatureSvg?: string;
  createdAt: string;
  updatedAt: string;
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
