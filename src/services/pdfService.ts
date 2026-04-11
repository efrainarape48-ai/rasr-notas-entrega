import { jsPDF } from 'jspdf';
import type { CompanyProfile, DeliveryNote } from '../types';

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildPdf(note: DeliveryNote, company: CompanyProfile) {
  const pdf = new jsPDF('p', 'mm', 'a4');

  let y = 20;
  const left = 15;
  const right = 195;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(company?.name || 'RASR', left, y);

  y += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  if (company?.address) pdf.text(company.address, left, y);
  y += 5;
  if (company?.email) pdf.text(company.email, left, y);
  y += 5;
  if (company?.phone) pdf.text(company.phone, left, y);

  y = 20;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('NOTA DE ENTREGA', right, y, { align: 'right' });

  y += 8;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Número: ${note.noteNumber}`, right, y, { align: 'right' });
  y += 5;
  pdf.text(`Fecha: ${note.issueDate}`, right, y, { align: 'right' });
  y += 5;
  pdf.text(`Estado: ${note.status}`, right, y, { align: 'right' });

  y = 55;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Cliente', left, y);

  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(note.customerName || '', left, y);
  y += 5;
  if (note.customerAddress) pdf.text(note.customerAddress, left, y);
  y += 5;
  if (note.customerPhone) pdf.text(note.customerPhone, left, y);

  y += 12;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(left, y, right, y);

  y += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Producto', left, y);
  pdf.text('Cant.', 130, y, { align: 'right' });
  pdf.text('Precio', 160, y, { align: 'right' });
  pdf.text('Total', right, y, { align: 'right' });

  y += 4;
  pdf.line(left, y, right, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  note.lines.forEach((line) => {
    y += 8;
    if (y > 260) {
      pdf.addPage();
      y = 20;
    }

    pdf.text(line.name, left, y);
    pdf.text(String(line.quantity), 130, y, { align: 'right' });
    pdf.text(formatMoney(line.price), 160, y, { align: 'right' });
    pdf.text(formatMoney(line.total), right, y, { align: 'right' });
  });

  y += 10;
  pdf.line(120, y, right, y);

  y += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Subtotal', 160, y, { align: 'right' });
  pdf.text(formatMoney(note.subtotal), right, y, { align: 'right' });

  y += 7;
  pdf.setFontSize(12);
  pdf.text('Total', 160, y, { align: 'right' });
  pdf.text(formatMoney(note.total), right, y, { align: 'right' });

  if (note.notes) {
    y += 14;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Observaciones:', left, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    const split = pdf.splitTextToSize(note.notes, 180);
    pdf.text(split, left, y);
  }

  const footerText =
    company?.footerText ||
    'Gracias por su confianza.';

  const disclaimer =
    'Documento interno de nota de entrega. Sin derecho a crédito fiscal. Este documento no constituye factura fiscal y se emite únicamente como constancia de entrega de mercancía.';

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(footerText, 105, 282, { align: 'center' });
  pdf.text(pdf.splitTextToSize(disclaimer, 180), 105, 287, { align: 'center' });

  return pdf;
}

export function getProfessionalPDFBlob(
  note: DeliveryNote,
  company: CompanyProfile
): Blob {
  const pdf = buildPdf(note, company);
  return pdf.output('blob');
}

export function saveProfessionalPDF(
  note: DeliveryNote,
  company: CompanyProfile
): void {
  const pdf = buildPdf(note, company);
  const fileName = `${note.noteNumber}_${note.customerName.replace(/\s+/g, '_')}.pdf`;
  pdf.save(fileName);
}
