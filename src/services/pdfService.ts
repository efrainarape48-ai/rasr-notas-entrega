import { jsPDF } from 'jspdf';
import type { CompanyProfile, DeliveryNote, DeliveryNoteLine } from '../types';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT = 15;
const RIGHT = 195;
const FOOTER_Y = 282;
const MAX_PRODUCTS_PER_PAGE = 10;

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

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  if (arr.length === 0) {
    return [[]];
  }

  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
}

function tryAddLogo(pdf: jsPDF, company: CompanyProfile) {
  const logoData = company?.logoData;
  if (!logoData) return false;

  const isPng = logoData.startsWith('data:image/png');
  const isJpeg =
    logoData.startsWith('data:image/jpeg') ||
    logoData.startsWith('data:image/jpg');

  if (!isPng && !isJpeg) {
    return false;
  }

  try {
    const format = isPng ? 'PNG' : 'JPEG';
    pdf.addImage(logoData, format, LEFT, 14, 24, 24);
    return true;
  } catch (error) {
    console.error('No se pudo insertar el logo en el PDF:', error);
    return false;
  }
}

function drawFooter(pdf: jsPDF, company: CompanyProfile, pageNumber: number) {
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
  pdf.text(`Página ${pageNumber}`, RIGHT, PAGE_HEIGHT - 5, {
    align: 'right',
  });
}

function drawHeader(
  pdf: jsPDF,
  note: DeliveryNote,
  company: CompanyProfile,
  pageNumber: number
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
  pdf.text(`Hoja: ${pageNumber}`, RIGHT, 40, { align: 'right' });

  pdf.setDrawColor(210, 210, 210);
  pdf.line(LEFT, 45, RIGHT, 45);
}

function drawCustomerBlock(pdf: jsPDF, note: DeliveryNote) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Cliente / Receptor', LEFT, 54);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  let y = 60;

  pdf.text(safeText(note.customerName), LEFT, y);
  y += 5;

  if (note.customerAddress) {
    const addressLines = pdf.splitTextToSize(note.customerAddress, 120);
    pdf.text(addressLines, LEFT, y);
    y += addressLines.length * 4.5;
  }

  if (note.customerPhone) {
    pdf.text(`Teléfono: ${note.customerPhone}`, LEFT, y);
    y += 5;
  }

  return Math.max(y + 8, 84);
}

function drawTableHeader(pdf: jsPDF, startY: number) {
  pdf.setDrawColor(200, 200, 200);
  pdf.line(LEFT, startY - 4, RIGHT, startY - 4);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Producto', LEFT, startY);
  pdf.text('Cant.', 130, startY, { align: 'right' });
  pdf.text('Precio', 160, startY, { align: 'right' });
  pdf.text('Total', RIGHT, startY, { align: 'right' });

  pdf.line(LEFT, startY + 3, RIGHT, startY + 3);

  return startY + 11;
}

function drawLineItems(pdf: jsPDF, lines: DeliveryNoteLine[], startY: number) {
  let y = drawTableHeader(pdf, startY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  if (lines.length === 0) {
    pdf.setTextColor(110, 110, 110);
    pdf.text('No hay productos agregados.', LEFT, y);
    pdf.setTextColor(0, 0, 0);
    return y + 8;
  }

  lines.forEach((line) => {
    const name = fitText(pdf, safeText(line.name), 95);

    pdf.text(name, LEFT, y);
    pdf.text(String(line.quantity), 130, y, { align: 'right' });
    pdf.text(formatMoney(line.price), 160, y, { align: 'right' });
    pdf.text(formatMoney(line.total), RIGHT, y, { align: 'right' });

    y += 8;
  });

  return y;
}

function drawTotals(pdf: jsPDF, note: DeliveryNote, startY: number) {
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

  return y;
}

function drawNotesOnCurrentPage(
  pdf: jsPDF,
  notesLines: string[],
  startY: number
) {
  let y = startY + 14;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Observaciones', LEFT, y);

  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(notesLines, LEFT, y);
}

function drawNotesPage(
  pdf: jsPDF,
  note: DeliveryNote,
  company: CompanyProfile,
  pageNumber: number,
  notesLines: string[]
) {
  pdf.addPage();
  drawHeader(pdf, note, company, pageNumber);
  drawFooter(pdf, company, pageNumber);

  let y = 58;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Observaciones', LEFT, y);

  y += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(notesLines, LEFT, y);
}

function buildPdf(note: DeliveryNote, company: CompanyProfile) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const itemPages = chunkArray(note.lines || [], MAX_PRODUCTS_PER_PAGE);

  let pageNumber = 1;

  itemPages.forEach((pageLines, index) => {
    if (index > 0) {
      pdf.addPage();
      pageNumber += 1;
    }

    drawHeader(pdf, note, company, pageNumber);
    drawFooter(pdf, company, pageNumber);

    const customerEndY = drawCustomerBlock(pdf, note);
    const itemsEndY = drawLineItems(pdf, pageLines, customerEndY);

    if (index === itemPages.length - 1) {
      const totalsEndY = drawTotals(pdf, note, itemsEndY);

      if (note.notes) {
        const notesLines = pdf.splitTextToSize(note.notes, 180);

        const notesStartY = totalsEndY + 14;
        const availableHeight = 260 - notesStartY;
        const linesFitCurrentPage = Math.max(
          0,
          Math.floor((availableHeight - 6) / 4.5)
        );

        if (notesLines.length > 0) {
          if (notesLines.length <= linesFitCurrentPage) {
            drawNotesOnCurrentPage(pdf, notesLines, totalsEndY);
          } else {
            const currentChunk =
              linesFitCurrentPage > 0
                ? notesLines.slice(0, linesFitCurrentPage)
                : [];

            const remaining =
              linesFitCurrentPage > 0
                ? notesLines.slice(linesFitCurrentPage)
                : notesLines;

            if (currentChunk.length > 0) {
              drawNotesOnCurrentPage(pdf, currentChunk, totalsEndY);
            }

            const notesPerExtraPage = 45;
            const extraPages = chunkArray(remaining, notesPerExtraPage);

            extraPages.forEach((chunk) => {
              pageNumber += 1;
              drawNotesPage(pdf, note, company, pageNumber, chunk);
            });
          }
        }
      }
    }
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
