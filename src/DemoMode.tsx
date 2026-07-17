import React, { useState, useMemo } from 'react';
import { LogOut, Package, Users, FileText, Settings } from 'lucide-react';
import { Item, Customer, DeliveryNote, CompanyProfile } from './types';

interface DemoModeProps {
  onExit: () => void;
}

export const DemoMode: React.FC<DemoModeProps> = ({ onExit }) => {
  const [screen, setScreen] = useState<'items' | 'customers' | 'notes' | 'settings'>('items');
  
  // Datos de demo con precios de costo
  const [items] = useState<Item[]>([
    {
      id: '1',
      sku: 'HER-012',
      name: 'Bandas - Set de 150 piezas de acero pastillita3',
      description: 'Set de 150 piezas de acero eeee e',
      price: 45.00,
      costPrice: 30.00,
      unit: 'Caja',
      stock: 2.25,
      categoria: 'General',
      activo: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      sku: 'HER-011',
      name: 'Gomas - Set de 150 piezas de acero pastillita3',
      description: 'Set de 150 piezas de acero ffffff ffffff d',
      price: 35.00,
      costPrice: 20.00,
      unit: 'Caja',
      stock: 10.5,
      categoria: 'General',
      activo: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      sku: 'HER-010',
      name: 'Pastillas',
      description: '',
      price: 1500.00,
      costPrice: 950.00,
      unit: 'Unidad',
      stock: 8.75,
      categoria: 'General',
      activo: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: '4',
      sku: 'HER-015',
      name: 'Pega',
      description: '',
      price: 35.00,
      costPrice: 18.00,
      unit: 'Botella',
      stock: 57,
      categoria: 'General',
      activo: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: '5',
      sku: 'HER-013',
      name: 'Resortes',
      description: '',
      price: 78.00,
      costPrice: 45.00,
      unit: 'Paquete',
      stock: 4,
      categoria: 'General',
      activo: false,
      createdAt: new Date().toISOString(),
    },
  ]);

  const [customers] = useState<Customer[]>([
    {
      id: '1',
      name: 'Cliente Test 1',
      phone: '+58-2123456789',
      email: 'cliente1@example.com',
      address: 'Calle Principal 123',
      taxId: 'V-12345678',
    },
    {
      id: '2',
      name: 'Cliente Test 2',
      phone: '+58-2124567890',
      email: 'cliente2@example.com',
      address: 'Avenida Secundaria 456',
      taxId: 'J-87654321',
    },
  ]);

  const [companyProfile] = useState<CompanyProfile>({
    id: '1',
    userId: 'demo',
    name: 'Emprendimiento Ricardo Silva 3',
    address: 'Barquisimeto, Lara',
    phone: '+58-2126789012',
    email: 'info@example.com',
    taxId: 'J-12345678',
    logo: '',
    footerText: 'Gracias por su compra',
  });

  // Cálculos de resumen
  const summaryData = useMemo(() => {
    const activeItems = items.filter(i => i.activo);
    const totalInvestment = items.reduce((sum, item) => {
      const cost = item.costPrice || 0;
      return sum + (cost * item.stock);
    }, 0);
    const totalSalesValue = items.reduce((sum, item) => sum + (item.price * item.stock), 0);
    const totalProfit = totalSalesValue - totalInvestment;
    const avgMargin = totalSalesValue > 0 ? (totalProfit / totalSalesValue * 100) : 0;

    return {
      totalInvestment,
      totalSalesValue,
      totalProfit,
      avgMargin,
      activeCount: activeItems.length,
      totalUnits: items.reduce((sum, item) => sum + item.stock, 0),
      lowStock: items.filter(i => i.stock < 10).length,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-background text-text">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-accent p-6 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🎬 MODO DEMO - STAGING</h1>
            <p className="text-sm opacity-90 mt-1">Visualiza los cambios sin necesidad de Firebase</p>
          </div>
          <button
            onClick={onExit}
            className="flex items-center gap-2 bg-white text-primary px-4 py-2 rounded font-bold hover:bg-gray-100"
          >
            <LogOut size={18} /> Salir
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto flex gap-4 px-6 py-4">
          <button
            onClick={() => setScreen('items')}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition ${
              screen === 'items' ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            <Package size={18} /> Inventario
          </button>
          <button
            onClick={() => setScreen('customers')}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition ${
              screen === 'customers' ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            <Users size={18} /> Clientes
          </button>
          <button
            onClick={() => setScreen('notes')}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition ${
              screen === 'notes' ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            <FileText size={18} /> Notas
          </button>
          <button
            onClick={() => setScreen('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition ${
              screen === 'settings' ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            <Settings size={18} /> Config
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {screen === 'items' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary mb-4">Inventario de Productos</h2>
              
              {/* Tabla */}
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full">
                  <thead className="bg-surface border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left font-bold text-primary">SKU</th>
                      <th className="px-6 py-3 text-left font-bold text-primary">Producto</th>
                      <th className="px-6 py-3 text-left font-bold text-primary hidden lg:table-cell">Categoría</th>
                      <th className="px-6 py-3 text-right font-bold text-primary hidden xl:table-cell">Precio Costo</th>
                      <th className="px-6 py-3 text-right font-bold text-primary">Precio Venta</th>
                      <th className="px-6 py-3 text-right font-bold text-primary">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border hover:bg-surface/50">
                        <td className="px-6 py-4 font-bold text-accent">{item.sku}</td>
                        <td className="px-6 py-4">
                          <a href="#" className="text-primary hover:underline">{item.name}</a>
                          {!item.activo && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Inactivo</span>}
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell text-sm text-muted">{item.categoria}</td>
                        <td className="px-6 py-4 text-right text-muted hidden xl:table-cell">
                          {item.costPrice ? `$${item.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-primary">
                          ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-accent">{item.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen */}
            <div className="premium-card p-6 space-y-6 border-t-4 border-accent">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-primary uppercase tracking-widest">📊 Resumen del Inventario</h3>
                <span className="text-[11px] font-bold text-muted uppercase tracking-widest bg-surface px-3 py-1 rounded">{summaryData.activeCount} Activos</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">💰 Inversión Total (Costo)</p>
                    <p className="text-2xl font-bold text-primary">${summaryData.totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-muted mt-2">Valor total de los costos × cantidad en stock</p>
                  </div>
                  
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">📈 Valor en Venta (Potencial)</p>
                    <p className="text-2xl font-bold text-accent">${summaryData.totalSalesValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-muted mt-2">Valor de venta × cantidad en stock</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-emerald-50 rounded-lg p-4 border-2 border-emerald-200">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2">💹 Ganancia Potencial</p>
                    <p className="text-2xl font-bold text-emerald-700">${summaryData.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-emerald-600 mt-2">Diferencia entre venta y costo</p>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-lg p-4 border-2 border-indigo-200">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-2">📊 Margen Promedio</p>
                    <p className="text-2xl font-bold text-indigo-700">{summaryData.avgMargin.toFixed(1)}%</p>
                    <p className="text-[9px] text-indigo-600 mt-2">Ganancia / Venta total</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{items.length}</p>
                  <p className="text-[9px] text-muted uppercase tracking-tighter mt-1">Productos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summaryData.totalUnits.toLocaleString()}</p>
                  <p className="text-[9px] text-muted uppercase tracking-tighter mt-1">Unidades</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{summaryData.lowStock}</p>
                  <p className="text-[9px] text-muted uppercase tracking-tighter mt-1">Bajo Stock</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {screen === 'customers' && (
          <div>
            <h2 className="text-2xl font-bold text-primary mb-4">Clientes de Demo</h2>
            <div className="grid gap-4">
              {customers.map((customer) => (
                <div key={customer.id} className="bg-surface border border-border rounded-lg p-4">
                  <h3 className="font-bold text-lg text-primary">{customer.name}</h3>
                  <p className="text-sm text-muted">{customer.phone}</p>
                  <p className="text-sm text-muted">{customer.email}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === 'notes' && (
          <div>
            <h2 className="text-2xl font-bold text-primary mb-4">Notas de Entrega</h2>
            <p className="text-muted">En modo demo, no se pueden crear notas. Solo visualiza el inventario.</p>
          </div>
        )}

        {screen === 'settings' && (
          <div>
            <h2 className="text-2xl font-bold text-primary mb-4">Configuración Empresa</h2>
            <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-muted uppercase">Nombre</p>
                <p className="text-lg font-bold text-primary">{companyProfile.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase">Dirección</p>
                <p className="text-lg text-text">{companyProfile.address}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase">Teléfono</p>
                <p className="text-lg text-text">{companyProfile.phone}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase">Email</p>
                <p className="text-lg text-text">{companyProfile.email}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase">RIF/NIT</p>
                <p className="text-lg text-text">{companyProfile.taxId}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
