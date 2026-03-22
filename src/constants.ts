import { Customer, Item, DeliveryNote } from './types';

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Distribuidora Central S.A.',
    email: 'contacto@distribuidora.com',
    phone: '+52 55 1234 5678',
    address: 'Av. Insurgentes Sur 123, Ciudad de México',
    taxId: 'DCE123456ABC',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c2',
    name: 'Logística del Norte',
    email: 'ventas@logistica.mx',
    phone: '+52 81 8765 4321',
    address: 'Calle Industrial 456, Monterrey, NL',
    taxId: 'LNO987654XYZ',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c3',
    name: 'Comercializadora del Pacífico',
    email: 'info@compacifico.com',
    phone: '+52 33 2468 1357',
    address: 'Blvd. Costero 789, Ensenada, BC',
    taxId: 'CPA456789DEF',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const MOCK_ITEMS: Item[] = [
  {
    id: 'i1',
    sku: 'HER-001',
    name: 'Caja de Herramientas Premium',
    description: 'Set de 150 piezas de acero cromo-vanadio',
    price: 1250.00,
    unit: 'unidad',
    stock: 25,
    categoria: 'Herramientas Manuales',
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'i2',
    sku: 'ELE-001',
    name: 'Taladro Inalámbrico 20V',
    description: 'Motor sin escobillas, incluye 2 baterías',
    price: 2499.00,
    unit: 'unidad',
    stock: 12,
    categoria: 'Herramientas Eléctricas',
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'i3',
    sku: 'HER-002',
    name: 'Set de Destornilladores',
    description: '12 piezas con puntas magnéticas',
    price: 450.00,
    unit: 'set',
    stock: 50,
    categoria: 'Herramientas Manuales',
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'i4',
    sku: 'SEG-001',
    name: 'Guantes de Seguridad',
    description: 'Nivel 5 de protección contra cortes',
    price: 180.00,
    unit: 'par',
    stock: 100,
    categoria: 'Seguridad Industrial',
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'i5',
    sku: 'SEG-002',
    name: 'Casco de Protección',
    description: 'Clase E, con ajuste de trinquete',
    price: 320.00,
    unit: 'unidad',
    stock: 40,
    categoria: 'Seguridad Industrial',
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const MOCK_DELIVERY_NOTES: DeliveryNote[] = [
  {
    id: 'dn1',
    noteNumber: 'NE-0001',
    issueDate: '2024-03-20',
    status: 'delivered',
    customerId: 'c1',
    customerName: 'Distribuidora Central S.A.',
    customerPhone: '+52 55 1234 5678',
    customerAddress: 'Av. Insurgentes Sur 123, Ciudad de México',
    lines: [
      {
        itemId: 'i1',
        name: 'Caja de Herramientas Premium',
        quantity: 2,
        price: 1250.00,
        total: 2500.00
      },
      {
        itemId: 'i3',
        name: 'Set de Destornilladores',
        quantity: 5,
        price: 450.00,
        total: 2250.00
      }
    ],
    subtotal: 4750.00,
    total: 4750.00,
    notes: 'Entrega realizada en el almacén principal.',
    signerName: 'Juan Pérez',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dn2',
    noteNumber: 'NE-0002',
    issueDate: '2024-03-21',
    status: 'draft',
    customerId: 'c2',
    customerName: 'Logística del Norte',
    customerPhone: '+52 81 8765 4321',
    customerAddress: 'Calle Industrial 456, Monterrey, NL',
    lines: [
      {
        itemId: 'i2',
        name: 'Taladro Inalámbrico 20V',
        quantity: 1,
        price: 2499.00,
        total: 2499.00
      }
    ],
    subtotal: 2499.00,
    total: 2499.00,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];
