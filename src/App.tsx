import React, { useMemo, useState } from 'react';
import './App.css';
import type { CompanyProfile, Customer, DeliveryNote, DeliveryNoteLine } from './types';
import { getProfessionalPDFBlob, saveProfessionalPDF } from './services/pdfService';

function createEmptyLine(): DeliveryNoteLine {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: 1,
    price: 0,
    total: 0,
  };
}

function App() {
  const [company, setCompany] = useState<CompanyProfile>({
    name: 'Mi Empresa',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    logoData: '',
    footerText: 'Gracias por su confianza.',
  });

  const [customer, setCustomer] = useState<Customer>({
    id: crypto.randomUUID(),
    name: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
  });

  const [note, setNote] = useState<DeliveryNote>({
    id: crypto.randomUUID(),
    noteNumber: 'NE-2026-0001',
    issueDate: new Date().toISOString().slice(0, 10),
    status: 'issued',
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerEmail: '',
    customerTaxId: '',
    lines: [createEmptyLine()],
    subtotal: 0,
    total: 0,
    notes: '',
  });

  const totals = useMemo(() => {
    const subtotal = note.lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
    return {
      subtotal,
      total: subtotal,
    };
  }, [note.lines]);

  const syncNoteCustomerFields = (nextCustomer: Customer) => {
    setNote((prev) => ({
      ...prev,
      customerId: nextCustomer.id,
      customerName: nextCustomer.name || '',
      customerPhone: nextCustomer.phone || '',
      customerAddress: nextCustomer.address || '',
      customerEmail: nextCustomer.email || '',
      customerTaxId: nextCustomer.taxId || '',
    }));
  };

  const handleCompanyChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCompany((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCustomerChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setCustomer((prev) => {
      const nextCustomer = {
        ...prev,
        [name]: value,
      };
      syncNoteCustomerFields(nextCustomer);
      return nextCustomer;
    });
  };

  const handleNoteChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNote((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLineChange = (
    lineId: string,
    field: keyof DeliveryNoteLine,
    value: string | number
  ) => {
    setNote((prev) => {
      const nextLines = prev.lines.map((line) => {
        if (line.id !== lineId) return line;

        const updated: DeliveryNoteLine = {
          ...line,
          [field]:
            field === 'quantity' || field === 'price' || field === 'total'
              ? Number(value) || 0
              : String(value),
        };

        const quantity = Number(updated.quantity) || 0;
        const price = Number(updated.price) || 0;
        updated.total = quantity * price;

        return updated;
      });

      const subtotal = nextLines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);

      return {
        ...prev,
        lines: nextLines,
        subtotal,
        total: subtotal,
      };
    });
  };

  const addLine = () => {
    setNote((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine()],
    }));
  };

  const removeLine = (lineId: string) => {
    setNote((prev) => {
      const nextLines = prev.lines.filter((line) => line.id !== lineId);
      const finalLines = nextLines.length > 0 ? nextLines : [createEmptyLine()];
      const subtotal = finalLines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);

      return {
        ...prev,
        lines: finalLines,
        subtotal,
        total: subtotal,
      };
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCompany((prev) => ({
        ...prev,
        logoData: String(reader.result || ''),
      }));
    };
    reader.readAsDataURL(file);
  };

  const buildNoteForPdf = (): DeliveryNote => ({
    ...note,
    customerId: customer.id,
    customerName: customer.name || note.customerName || '',
    customerPhone: customer.phone || note.customerPhone || '',
    customerAddress: customer.address || note.customerAddress || '',
    customerEmail: customer.email || note.customerEmail || '',
    customerTaxId: customer.taxId || note.customerTaxId || '',
    subtotal: totals.subtotal,
    total: totals.total,
    lines: note.lines.map((line) => ({
      ...line,
      quantity: Number(line.quantity) || 0,
      price: Number(line.price) || 0,
      total: (Number(line.quantity) || 0) * (Number(line.price) || 0),
    })),
  });

  const handleDownloadPdf = () => {
    const finalNote = buildNoteForPdf();
    saveProfessionalPDF(finalNote, company, customer);
  };

  const handlePreviewPdf = async () => {
    const finalNote = buildNoteForPdf();
    const blob = getProfessionalPDFBlob(finalNote, company, customer);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="app-shell">
      <div className="container">
        <h1>Notas de entrega</h1>

        <section className="card">
          <h2>Empresa</h2>

          <div className="grid">
            <label>
              Nombre
              <input
                name="name"
                value={company.name}
                onChange={handleCompanyChange}
                placeholder="Nombre de la empresa"
              />
            </label>

            <label>
              Teléfono
              <input
                name="phone"
                value={company.phone}
                onChange={handleCompanyChange}
                placeholder="Teléfono"
              />
            </label>

            <label>
              Email
              <input
                name="email"
                value={company.email}
                onChange={handleCompanyChange}
                placeholder="correo@empresa.com"
              />
            </label>

            <label>
              Identificación fiscal
              <input
                name="taxId"
                value={company.taxId}
                onChange={handleCompanyChange}
                placeholder="RNC / NIF / RFC"
              />
            </label>

            <label className="full">
              Dirección
              <textarea
                name="address"
                value={company.address}
                onChange={handleCompanyChange}
                placeholder="Dirección de la empresa"
                rows={3}
              />
            </label>

            <label className="full">
              Texto de pie de página
              <input
                name="footerText"
                value={company.footerText || ''}
                onChange={handleCompanyChange}
                placeholder="Mensaje del pie del PDF"
              />
            </label>

            <label className="full">
              Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Cliente</h2>

          <div className="grid">
            <label>
              Nombre
              <input
                name="name"
                value={customer.name}
                onChange={handleCustomerChange}
                placeholder="Nombre del cliente"
              />
            </label>

            <label>
              Teléfono
              <input
                name="phone"
                value={customer.phone}
                onChange={handleCustomerChange}
                placeholder="Teléfono"
              />
            </label>

            <label>
              Correo
              <input
                name="email"
                value={customer.email || ''}
                onChange={handleCustomerChange}
                placeholder="correo@cliente.com"
              />
            </label>

            <label>
              Identificación fiscal
              <input
                name="taxId"
                value={customer.taxId || ''}
                onChange={handleCustomerChange}
                placeholder="RNC / NIF / RFC"
              />
            </label>

            <label className="full">
              Dirección
              <textarea
                name="address"
                value={customer.address || ''}
                onChange={handleCustomerChange}
                placeholder="Dirección del cliente"
                rows={3}
              />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Nota de entrega</h2>

          <div className="grid">
            <label>
              No. de nota
              <input
                name="noteNumber"
                value={note.noteNumber}
                onChange={handleNoteChange}
                placeholder="NE-2026-0001"
              />
            </label>

            <label>
              Fecha
              <input
                type="date"
                name="issueDate"
                value={note.issueDate}
                onChange={handleNoteChange}
              />
            </label>

            <label>
              Estado
              <select name="status" value={note.status} onChange={handleNoteChange}>
                <option value="draft">draft</option>
                <option value="issued">issued</option>
                <option value="cancelled">cancelled</option>
                <option value="canceled">canceled</option>
              </select>
            </label>

            <label className="full">
              Observaciones
              <textarea
                name="notes"
                value={note.notes || ''}
                onChange={handleNoteChange}
                placeholder="Notas u observaciones"
                rows={4}
              />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <h2>Productos</h2>
            <button type="button" onClick={addLine}>
              Agregar producto
            </button>
          </div>

          <div className="lines-list">
            {note.lines.map((line) => (
              <div className="line-row" key={line.id}>
                <input
                  value={line.name}
                  onChange={(e) => handleLineChange(line.id, 'name', e.target.value)}
                  placeholder="Nombre del producto"
                />

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={line.quantity}
                  onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value)}
                  placeholder="Cant."
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.price}
                  onChange={(e) => handleLineChange(line.id, 'price', e.target.value)}
                  placeholder="Precio"
                />

                <input
                  type="number"
                  value={line.total}
                  readOnly
                  placeholder="Total"
                />

                <button type="button" onClick={() => removeLine(line.id)}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>

          <div className="totals">
            <div>
              <strong>Subtotal:</strong> {totals.subtotal.toFixed(2)}
            </div>
            <div>
              <strong>Total:</strong> {totals.total.toFixed(2)}
            </div>
          </div>
        </section>

        <section className="actions">
          <button type="button" onClick={handlePreviewPdf}>
            Vista previa PDF
          </button>
          <button type="button" onClick={handleDownloadPdf}>
            Descargar PDF
          </button>
        </section>
      </div>
    </div>
  );
}

export default App;
