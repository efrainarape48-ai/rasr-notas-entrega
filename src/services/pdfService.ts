import { jsPDF } from 'jspdf';
import type { CompanyProfile, DeliveryNote, DeliveryNoteLine } from '../types';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT = 15;
const RIGHT = 195;
const FOOTER_Y = 282;
const FOOTER_LINE_Y = FOOTER_Y - 4;
const BODY_BOTTOM_Y = FOOTER_LINE_Y - 8;

const COMPANY_NAME_FONT_SIZE = 15;
const DOCUMENT_TITLE_FONT_SIZE = 14;
const HEADER_INFO_FONT_SIZE = 8.7;
const TABLE_HEADER_FONT_SIZE = 9;
const TABLE_BODY_FONT_SIZE = 9;
const TABLE_ROW_HEIGHT = 6.2;
const NOTES_LINE_HEIGHT = 4.5;
const RESERVED_TOTALS_HEIGHT = 24;
const MIN_ITEMS_ON_LAST_PAGE = 5;

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

function fitTextToLines(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const clean = safeText(text);
  if (!clean) return [] as string[];

  const lines = pdf.splitTextToSize(clean, maxWidth) as string[];
  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  const remainingLastLine = lines.slice(maxLines - 1).join(' ');
  visible[maxLines - 1] = fitText(pdf, remainingLastLine, maxWidth);

  return visible;
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
  pdf.line(LEFT, FOOTER_LINE_Y, RIGHT, FOOTER_LINE_Y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(footerText, PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' });

  const disclaimerLines = pdf.splitTextToSize(disclaimer, 175) as string[];
  pdf.setFontSize(7.5);
  pdf.text(disclaimerLines, PAGE_WIDTH / 2, FOOTER_Y + 5, {
    align: 'center',
  });

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
  const textStartX = hasLogo ? 45 : LEFT;
  const leftMaxWidth = hasLogo ? 95 : 120;

  let leftY = 18;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(COMPANY_NAME_FONT_SIZE);

  const companyNameLines = fitTextToLines(
    pdf,
    safeText(company?.name) || 'RASR',
    leftMaxWidth,
    2
  );

  pdf.text(companyNameLines, textStartX, leftY);
  leftY += Math.max(companyNameLines.length, 1) * 5.2;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(HEADER_INFO_FONT_SIZE);

  if (company?.address) {
    const addressLines = pdf.splitTextToSize(company.address, leftMaxWidth) as string[];
    pdf.text(addressLines, textStartX, leftY);
    leftY += addressLines.length * 4.2;
  }

  if (company?.email) {
    const emailLines = pdf.splitTextToSize(company.email, leftMaxWidth) as string[];
    pdf.text(emailLines, textStartX, leftY);
    leftY += emailLines.length * 4.2;
  }

  if (company?.phone) {
    pdf.text(company.phone, textStartX, leftY);
    leftY += 4.2;
  }

  if (company?.taxId) {
    const taxIdText = fitText(pdf, `Identificación fiscal: ${company.taxId}`, leftMaxWidth);
    pdf.text(taxIdText, textStartX, leftY);
    leftY += 4.2;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(DOCUMENT_TITLE_FONT_SIZE);
  pdf.text('NOTA DE ENTREGA', RIGHT, 18, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);

  let rightY = 24;
  pdf.text(`Número: ${note.noteNumber}`, RIGHT, rightY, { align: 'right' });
  rightY += 4.8;
  pdf.text(`Fecha: ${note.issueDate}`, RIGHT, rightY, { align: 'right' });
  rightY += 4.8;
  pdf.text(`Estado: ${note.status}`, RIGHT, rightY, { align: 'right' });
  rightY += 4.8;
  pdf.text(`Hoja: ${pageNumber}`, RIGHT, rightY, { align: 'right' });

  const headerBottomY = Math.max(46, leftY + 3, rightY + 4);

  pdf.setDrawColor(210, 210, 210);
  pdf.line(LEFT, headerBottomY, RIGHT, headerBottomY);

  return headerBottomY;
}

function drawCustomerBlock(pdf: jsPDF, note: DeliveryNote, startY: number) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Cliente / Receptor', LEFT, startY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);

  let y = startY + 6;

  const customerNameLines = pdf.splitTextToSize(
    safeText(note.customerName) || 'Sin cliente',
    120
  ) as string[];
  pdf.text(customerNameLines, LEFT, y);
  y += Math.max(customerNameLines.length, 1) * 4.6;

  if (note.customerAddress) {
    const addressLines = pdf.splitTextToSize(note.customerAddress, 120) as string[];
    pdf.text(addressLines, LEFT, y);
    y += addressLines.length * 4.3;
  }

  if (note.customerPhone) {
    pdf.text(`Teléfono: ${note.customerPhone}`, LEFT, y);
    y += 4.8;
  }

  return Math.max(y + 5, startY + 18);
}

function drawTableHeader(pdf: jsPDF, startY: number) {
  pdf.setDrawColor(200, 200, 200);
  pdf.line(LEFT, startY - 3, RIGHT, startY - 3);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(TABLE_HEADER_FONT_SIZE);
  pdf.text('Producto', LEFT, startY);
  pdf.text('Cant.', 132, startY, { align: 'right' });
  pdf.text('Precio', 162, startY, { align: 'right' });
  pdf.text('Total', RIGHT, startY, { align: 'right' });

  pdf.line(LEFT, startY + 2.5, RIGHT, startY + 2.5);

  return startY + 7;
}

function drawLineItems(pdf: jsPDF, lines: DeliveryNoteLine[], startY: number) {
  let y = drawTableHeader(pdf, startY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(TABLE_BODY_FONT_SIZE);

  if (lines.length === 0) {
    pdf.setTextColor(110, 110, 110);
    pdf.text('No hay productos agregados.', LEFT, y);
    pdf.setTextColor(0, 0, 0);
    return y + 6;
  }

  lines.forEach((line) => {
    const name = fitText(pdf, safeText(line.name), 102);

    pdf.text(name, LEFT, y);
    pdf.text(String(line.quantity), 132, y, { align: 'right' });
    pdf.text(formatMoney(line.price), 162, y, { align: 'right' });
    pdf.text(formatMoney(line.total), RIGHT, y, { align: 'right' });

    y += TABLE_ROW_HEIGHT;
  });

  return y;
}

function drawTotals(pdf: jsPDF, note: DeliveryNote, startY: number) {
  let y = startY + 2;

  pdf.setDrawColor(210, 210, 210);
  pdf.line(120, y, RIGHT, y);

  y += 7;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('Subtotal', 162, y, { align: 'right' });
  pdf.text(formatMoney(note.subtotal), RIGHT, y, { align: 'right' });

  y += 6.5;
  pdf.setFontSize(11);
  pdf.text('Total', 162, y, { align: 'right' });
  pdf.text(formatMoney(note.total), RIGHT, y, { align: 'right' });

  return y;
}

function drawNotesOnCurrentPage(
  pdf: jsPDF,
  notesLines: string[],
  startY: number
) {
  let y = startY + 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Observaciones', LEFT, y);

  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
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
  const headerBottomY = drawHeader(pdf, note, company, pageNumber);
  drawFooter(pdf, company, pageNumber);

  let y = headerBottomY + 12;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text('Observaciones', LEFT, y);

  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(notesLines, LEFT, y);
}

function getPageLayoutMetrics(pdf: jsPDF, note: DeliveryNote, company: CompanyProfile) {
  const headerBottomY = drawHeader(pdf, note, company, 1);
  const customerEndY = drawCustomerBlock(pdf, note, headerBottomY + 9);
  const firstRowY = drawTableHeader(pdf, customerEndY);

  return {
    headerBottomY,
    customerEndY,
    firstRowY,
    maxRowsWithoutTotals: Math.max(
      1,
      Math.floor((BODY_BOTTOM_Y - firstRowY) / TABLE_ROW_HEIGHT)
    ),
    maxRowsWithTotals: Math.max(
      1,
      Math.floor((BODY_BOTTOM_Y - RESERVED_TOTALS_HEIGHT - firstRowY) / TABLE_ROW_HEIGHT)
    ),
  };
}

function planItemPages(
  totalLines: DeliveryNoteLine[],
  maxRowsWithoutTotals: number,
  maxRowsWithTotals: number
) {
  if (totalLines.length === 0) {
    return [[]] as DeliveryNoteLine[][];
  }

  const pages: DeliveryNoteLine[][] = [];
  let cursor = 0;

  while (cursor < totalLines.length) {
    const remaining = totalLines.length - cursor;

    if (remaining <= maxRowsWithTotals) {
      pages.push(totalLines.slice(cursor));
      break;
    }

    const nextCursor = cursor + maxRowsWithoutTotals;
    pages.push(totalLines.slice(cursor, nextCursor));
    cursor = nextCursor;
  }

  if (pages.length > 1) {
    const lastPage = pages[pages.length - 1];
    const prevPage = pages[pages.length - 2];

    if (lastPage.length < MIN_ITEMS_ON_LAST_PAGE && prevPage.length > MIN_ITEMS_ON_LAST_PAGE) {
      const needed = MIN_ITEMS_ON_LAST_PAGE - lastPage.length;
      const movable = Math.min(needed, prevPage.length - MIN_ITEMS_ON_LAST_PAGE);

      if (movable > 0) {
        const movedItems = prevPage.splice(prevPage.length - movable, movable);
        pages[pages.length - 1] = [...movedItems, ...lastPage];
      }
    }
  }

  return pages;
}

function buildPdf(note: DeliveryNote, company: CompanyProfile) {
  const pdf = new jsPDF('p', 'mm', 'a4');

  const layout = getPageLayoutMetrics(pdf, note, company);
  pdf.deletePage(1);

  const itemPages = planItemPages(
    note.lines || [],
    layout.maxRowsWithoutTotals,
    layout.maxRowsWithTotals
  );

  let pageNumber = 1;

  itemPages.forEach((pageLines, index) => {
    if (index > 0) {
      pdf.addPage();
      pageNumber += 1;
    }

    const headerBottomY = drawHeader(pdf, note, company, pageNumber);
    drawFooter(pdf, company, pageNumber);

    const customerEndY = drawCustomerBlock(pdf, note, headerBottomY + 9);
    const itemsEndY = drawLineItems(pdf, pageLines, customerEndY);

    if (index === itemPages.length - 1) {
      const totalsEndY = drawTotals(pdf, note, itemsEndY);

      if (note.notes) {
        const notesLines = pdf.splitTextToSize(note.notes, 180) as string[];

        const notesTitleY = totalsEndY + 10;
        const notesTextY = notesTitleY + 6;
        const linesFitCurrentPage = Math.max(
          0,
          Math.floor((BODY_BOTTOM_Y - notesTextY) / NOTES_LINE_HEIGHT)
        );

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

          const extraNotesStartY = 64;
          const notesPerExtraPage = Math.max(
            1,
            Math.floor((BODY_BOTTOM_Y - extraNotesStartY) / NOTES_LINE_HEIGHT)
          );
          const extraPages = chunkArray(remaining, notesPerExtraPage);

          extraPages.forEach((chunk) => {
            pageNumber += 1;
            drawNotesPage(pdf, note, company, pageNumber, chunk);
          });
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
