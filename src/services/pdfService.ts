import { jsPDF } from 'jspdf';
import type { CompanyProfile, DeliveryNote, DeliveryNoteLine } from '../types';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT = 15;
const RIGHT = 195;
const FOOTER_Y = 282;
const ITEMS_PER_PAGE = 10;

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeText(value?: string) {
  return (value || '').trim();
}

function fitText(pdf: jsPDF, text: string, maxWidth: number) {
  if (!text) return '';
  if (pdf.getTextWidth(text) <= maxWidth) return text;

  let current = text;
  while (current.length > 0 && pdf.getTextWidth(`${current}…`) > maxWidth) {
    current = current.slice(0, -1);
  }
  return `${current}…`;
}

function chunkLines(lines: DeliveryNoteLine[], size: number) {
  const chunks: DeliveryNoteLine[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks.length ? chunks : [[]];
}

function tryAddLogo(pdf: jsPDF, company: CompanyProfile) {
  const logoData = company?.logoData;
  if (!logoData) return false;

  const isRaster =
    logoData.startsWith('data:image/png') ||
    logoData.startsWith('data:image/jpeg') ||
    logoData.startsWith('data:image/jpg') ||
    logoData.startsWith('data:image/webp');

  if (!isRaster) return false;

  try {
    const format = logoData.startsWith('data:image/png')
      ? 'PNG'
      : logoData.startsWith('data:image/webp')
      ? 'WEBP'
      : 'JPEG';

    pdf.addImage(logoData, format, LEFT, 14, 24, 24);
    return true;
  } catch (error) {
    console.error('No se pudo insertar el logo en el PDF:', error);
    return false;
  }
}

function drawFooter(pdf: jsPDF, company: CompanyProfile, pageNumber: number, totalPages: number) {
  const footerText = company?.footerText || 'Gracias por su confianza.';
  const disclaimer =
    'Documento interno de nota de entrega. Sin derecho a crédito fiscal. Este documento no constituye factura fiscal y se emite únicamente como constancia de entrega de mercancía.';

  pdf.setDrawColor(220, 220, 220);
  pdf.line(LEFT, FOOTER_Y - 4, RIGHT, FOOTER_Y - 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(footerText, PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' });

  const disclaimerLines = pdf.splitTextToSize(disclaimer, 175);
  pdf.text(disclaimerLines, PAGE_WIDTH / 2, FOOTER_Y + 5, { align: 'center' });

  pdf.setFontSize(8);
  pdf.text(`Página ${pageNumber} de ${totalPages}`, RIGHT, PAGE_HEIGHT - 5, {
    align: 'right',
  });
}

function drawHeader(
  pdf: jsPDF,
  note: DeliveryNote,
  company: CompanyProfile,
  pageNumber: number,
  totalPages: number
) {
  const hasLogo = tryAddLogo(pdf, company);

  const textStartX = hasLogo ? 44 : LEFT;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(safeText(company?.name) || 'RASR', textStartX, 20);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  let infoY = 26;
  if (company?.address) {
    pdf.text(company.address, textStartX, infoY);
    infoY += 4.5;
  }
  if (company?.email) {
    pdf.text(company.email, textStartX, infoY);
    infoY += 4.5;
  }
  if (company?.phone) {
    pdf.text(company.phone, textStartX, infoY);
    infoY += 4.5;
  }
  if (company?.taxId) {
    pdf.text(`Identificación fiscal: ${company.taxId}`, textStartX, infoY);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('NOTA DE ENTREGA', RIGHT, 18, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Número: ${note.noteNumber}`, RIGHT, 25, { align: 'right' });
  pdf.text(`Fecha: ${note.issueDate}`, RIGHT, 30, { align: 'right' });
  pdf.text(`Estado: ${note.status}`, RIGHT, 35, { align: 'right' });

  if (totalPages > 1) {
    pdf.setFontSize(9);
    pdf.text(`Hoja ${pageNumber}/${totalPages}`, RIGHT, 40, { align: 'right' });
  }

  pdf.setDrawColor(210, 210, 210);
  pdf.line(LEFT, 45, RIGHT, 45);
}

function drawCustomerBlock(pdf: jsPDF, note: DeliveryNote) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Cliente / Receptor', LEFT, 54);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(safeText(note.customerName), LEFT, 60);

  if (note.customerAddress) {
    const addressLines = pdf.splitTextToSize(note.customerAddress, 120);
    pdf.text(addressLines, LEFT, 65);
  }

  if (note.customerPhone) {
    pdf.text(`Teléfono: ${note.customerPhone}`, LEFT, 74);
  }
}

function drawTableHeader(pdf: jsPDF) {
  const y = 84;

  pdf.setDrawColor(200, 200, 200);
  pdf.line(LEFT, y - 4, RIGHT, y - 4);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Producto', LEFT, y);
  pdf.text('Cant.', 130, y, { align: 'right' });
  pdf.text('Precio', 160, y, { align: 'right' });
  pdf.text('Total', RIGHT, y, { align: 'right' });

  pdf.line(LEFT, y + 3, RIGHT, y + 3);

  return y + 11;
}

function drawLineItems(pdf: jsPDF, lines: DeliveryNoteLine[]) {
  let y = drawTableHeader(pdf);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  lines.forEach((line) => {
    const productName = fitText(pdf, safeText(line.name), 95);

    pdf.text(productName, LEFT, y);
    pdf.text(String(line.quantity), 130, y, { align: 'right' });
    pdf.text(formatMoney(line.price), 160, y, { align: 'right' });
    pdf.text(formatMoney(line.total), RIGHT, y, { align: 'right' });

    y += 8;
  });

  return y;
}

function drawTotalsAndNotes(pdf: jsPDF, note: DeliveryNote, startY: number) {
  let y = startY + 4;

  pdf.setDrawColor(210, 210, 210);
  pdf.line(120, y, RIGHT, y);

  y += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Subtotal', 160, y, { align: 'right' });
  pdf.text(formatMoney(note.subtotal), RIGHT, y, { align: 'right' });

  y += 7;
  pdf.setFontSize(12);
  pdf.text('Total', 160, y, { align: 'right' });
  pdf.text(formatMoney(note.total), RIGHT, y, { align: 'right' });

  if (note.notes) {
    y += 14;

    const notesLines = pdf.splitTextToSize(note.notes, 180);

    if (y + notesLines.length * 4.5 > 265) {
      pdf.addPage();
      y = 25;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Observaciones', LEFT, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(notesLines, LEFT, y);
      return;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Observaciones', LEFT, y);
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(notesLines, LEFT, y);
  }
}

function buildPdf(note: DeliveryNote, company: CompanyProfile) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const lines = Array.isArray(note.lines) ? note.lines : [];
  const pages = chunkLines(lines, ITEMS_PER_PAGE);

  pages.forEach((pageLines, index) => {
    if (index > 0) {
      pdf.addPage();
    }

    drawHeader(pdf, note, company, index + 1, pages.length);
    drawCustomerBlock(pdf, note);
    const endY = drawLineItems(pdf, pageLines);

    if (index === pages.length - 1) {
      drawTotalsAndNotes(pdf, note, endY);
    }

    drawFooter(pdf, company, index + 1, pages.length);
  });

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
  const safeCustomer = note.customerName.replace(/\s+/g, '_') || 'cliente';
  const fileName = `${note.noteNumber}_${safeCustomer}.pdf`;
  pdf.save(fileName);
}
