import { jsPDF } from 'jspdf';
import type { CompanyProfile, Customer, DeliveryNote, DeliveryNoteLine, DeliveryStatus } from '../types';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT = 15;
const RIGHT = 195;
const FOOTER_Y = 282;
const FOOTER_LINE_Y = FOOTER_Y - 4;
const BODY_BOTTOM_Y = FOOTER_LINE_Y - 8;

const LOGO_SIZE = 36;
const LOGO_Y = 12;
const COMPANY_NAME_FONT_SIZE = 11;
const DOCUMENT_TITLE_FONT_SIZE = 10.5;
const DOCUMENT_NUMBER_FONT_SIZE = 10.2;
const HEADER_INFO_FONT_SIZE = 8.5;
const CUSTOMER_TITLE_FONT_SIZE = 10.5;
const CUSTOMER_BODY_FONT_SIZE = 9.7;

// Tabla de productos
const TABLE_HEADER_FONT_SIZE = 10;
const TABLE_BODY_FONT_SIZE = 10;
const TABLE_ROW_HEIGHT = 6.8;
const PRODUCT_LINE_HEIGHT = 4.2;
const PRODUCT_MAX_LINES = 2;

const NOTES_LINE_HEIGHT = 4.5;
const RESERVED_TOTALS_HEIGHT = 25;

// Columnas de la tabla
// Producto queda más ancho.
// Cant., Precio y Total quedan más compactos hacia la derecha.
const QTY_X = 145;
const PRICE_X = 170;
const TOTAL_X = RIGHT;
const PRODUCT_MAX_WIDTH = QTY_X - LEFT - 8;

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; fill: [number, number, number]; text: [number, number, number] }> = {
  draft: {
    label: 'Borrador',
    fill: [232, 238, 247],
    text: [30, 58, 95],
  },
  delivered: {
    label: 'Entregado',
    fill: [219, 245, 232],
    text: [18, 104, 60],
  },
  canceled: {
    label: 'Cancelado',
    fill: [254, 243, 199],
    text: [146, 64, 14],
  },
};

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function safeText(value?: string) {
  return (value || '').trim();
}

function getStatusConfig(status?: string) {
  if (status === 'delivered' || status === 'draft' || status === 'canceled') {
    return STATUS_CONFIG[status];
  }

  return {
    label: safeText(status) || 'Sin estado',
    fill: [238, 238, 238] as [number, number, number],
    text: [80, 80, 80] as [number, number, number],
  };
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

function getProductNameLines(pdf: jsPDF, name: string) {
  const clean = safeText(name);
  if (!clean) return [''];

  const lines = pdf.splitTextToSize(clean, PRODUCT_MAX_WIDTH) as string[];

  if (lines.length <= PRODUCT_MAX_LINES) {
    return lines;
  }

  const visible = lines.slice(0, PRODUCT_MAX_LINES);
  const remainingLastLine = lines.slice(PRODUCT_MAX_LINES - 1).join(' ');
  visible[PRODUCT_MAX_LINES - 1] = fitText(pdf, remainingLastLine, PRODUCT_MAX_WIDTH);

  return visible;
}

function getLineItemRowHeight(pdf: jsPDF, line: DeliveryNoteLine) {
  const productNameLines = getProductNameLines(pdf, line.name);

  return Math.max(
    TABLE_ROW_HEIGHT,
    productNameLines.length * PRODUCT_LINE_HEIGHT + 2
  );
}

function getLinesHeight(pdf: jsPDF, lines: DeliveryNoteLine[]) {
  if (lines.length === 0) {
    return TABLE_ROW_HEIGHT;
  }

  return lines.reduce((sum, line) => {
    return sum + getLineItemRowHeight(pdf, line);
  }, 0);
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
    pdf.addImage(logoData, format, LEFT, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
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
  pdf.setTextColor(0, 0, 0);
  pdf.text(footerText, PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' });

  const disclaimerLines = pdf.splitTextToSize(disclaimer, 175) as string[];
  pdf.setFontSize(7.5);
  pdf.setTextColor(90, 90, 90);
  pdf.text(disclaimerLines, PAGE_WIDTH / 2, FOOTER_Y + 5, {
    align: 'center',
  });

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(8);
  pdf.text(`Página ${pageNumber}`, RIGHT, PAGE_HEIGHT - 5, {
    align: 'right',
  });
}

function drawStatusBadge(pdf: jsPDF, status: string | undefined, rightX: number, y: number) {
  const config = getStatusConfig(status);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.2);

  const paddingX = 2.8;
  const badgeHeight = 5.2;
  const textWidth = pdf.getTextWidth(config.label);
  const badgeWidth = textWidth + paddingX * 2;
  const x = rightX - badgeWidth;

  pdf.setFillColor(...config.fill);
  pdf.roundedRect(x, y - 3.7, badgeWidth, badgeHeight, 1.5, 1.5, 'F');

  pdf.setTextColor(...config.text);
  pdf.text(config.label, rightX - paddingX, y, { align: 'right' });
  pdf.setTextColor(0, 0, 0);

  return y + 5.4;
}

function drawHeader(
  pdf: jsPDF,
  note: DeliveryNote,
  company: CompanyProfile,
  pageNumber: number
) {
  const hasLogo = tryAddLogo(pdf, company);
  const textStartX = hasLogo ? LEFT + LOGO_SIZE + 6 : LEFT;
  const leftMaxWidth = hasLogo ? 88 : 122;

  let leftY = 17;

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(COMPANY_NAME_FONT_SIZE);

  const companyNameLines = fitTextToLines(
    pdf,
    safeText(company?.name) || 'RASR',
    leftMaxWidth,
    2
  );

  pdf.text(companyNameLines, textStartX, leftY);
  leftY += Math.max(companyNameLines.length, 1) * 4.8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(HEADER_INFO_FONT_SIZE);

  if (company?.address) {
    const addressLines = pdf.splitTextToSize(company.address, leftMaxWidth) as string[];
    pdf.text(addressLines, textStartX, leftY);
    leftY += addressLines.length * 4.1;
  }

  if (company?.email) {
    const emailLines = pdf.splitTextToSize(company.email, leftMaxWidth) as string[];
    pdf.text(emailLines, textStartX, leftY);
    leftY += emailLines.length * 4.1;
  }

  if (company?.phone) {
    pdf.text(company.phone, textStartX, leftY);
    leftY += 4.1;
  }

  if (company?.taxId) {
    const taxIdText = fitText(pdf, `Identificación fiscal: ${company.taxId}`, leftMaxWidth);
    pdf.text(taxIdText, textStartX, leftY);
    leftY += 4.1;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(DOCUMENT_TITLE_FONT_SIZE);
  pdf.text('NOTA DE ENTREGA', RIGHT, 17, { align: 'right' });

  let rightY = 24;
  pdf.setFontSize(DOCUMENT_NUMBER_FONT_SIZE);
  pdf.text(note.noteNumber, RIGHT, rightY, { align: 'right' });

  rightY += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.8);
  pdf.text(`Fecha: ${note.issueDate}`, RIGHT, rightY, { align: 'right' });

  rightY += 5.2;
  rightY = drawStatusBadge(pdf, note.status, RIGHT, rightY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(`Hoja: ${pageNumber}`, RIGHT, rightY, { align: 'right' });
  rightY += 4.8;

  const headerBottomY = Math.max(
    LOGO_Y + LOGO_SIZE + 5,
    53,
    leftY + 3,
    rightY + 4
  );

  pdf.setDrawColor(210, 210, 210);
  pdf.line(LEFT, headerBottomY, RIGHT, headerBottomY);

  return headerBottomY;
}

function getCustomerField(
  note: DeliveryNote,
  customer: Customer | null | undefined,
  field: keyof Pick<Customer, 'name' | 'email' | 'phone' | 'address' | 'taxId'>
) {
  const noteFieldMap: Record<string, string | undefined> = {
    name: note.customerName,
    email: note.customerEmail,
    phone: note.customerPhone,
    address: note.customerAddress,
    taxId: note.customerTaxId,
  };

  return safeText(customer?.[field]) || safeText(noteFieldMap[field]);
}

function addWrappedLine(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const clean = safeText(text);
  if (!clean) return y;

  const lines = pdf.splitTextToSize(clean, maxWidth) as string[];
  pdf.text(lines, x, y);
  return y + Math.max(lines.length, 1) * lineHeight;
}

function drawCustomerBlock(
  pdf: jsPDF,
  note: DeliveryNote,
  startY: number,
  customer?: Customer | null
) {
  const customerName = getCustomerField(note, customer, 'name') || 'Sin cliente';
  const customerTaxId = getCustomerField(note, customer, 'taxId');
  const customerPhone = getCustomerField(note, customer, 'phone');
  const customerEmail = getCustomerField(note, customer, 'email');
  const customerAddress = getCustomerField(note, customer, 'address');

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(CUSTOMER_TITLE_FONT_SIZE);
  pdf.text('Cliente', LEFT, startY);

  let y = startY + 6.2;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(CUSTOMER_BODY_FONT_SIZE + 0.3);
  y = addWrappedLine(pdf, customerName, LEFT, y, 175, 4.6);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(CUSTOMER_BODY_FONT_SIZE);

  if (customerTaxId) {
    y = addWrappedLine(pdf, `Identificación fiscal: ${customerTaxId}`, LEFT, y, 175, 4.4);
  }

  if (customerPhone) {
    y = addWrappedLine(pdf, `Teléfono: ${customerPhone}`, LEFT, y, 175, 4.4);
  }

  if (customerEmail) {
    y = addWrappedLine(pdf, `Correo: ${customerEmail}`, LEFT, y, 175, 4.4);
  }

  if (customerAddress) {
    y = addWrappedLine(pdf, `Dirección: ${customerAddress}`, LEFT, y, 175, 4.4);
  }

  return Math.max(y + 4.5, startY + 20);
}

function drawTableHeader(pdf: jsPDF, startY: number) {
  const headerTopY = startY - 5.4;
  const headerHeight = 8.4;

  pdf.setFillColor(242, 244, 247);
  pdf.rect(LEFT, headerTopY, RIGHT - LEFT, headerHeight, 'F');

  pdf.setDrawColor(205, 211, 220);
  pdf.line(LEFT, headerTopY, RIGHT, headerTopY);
  pdf.line(LEFT, headerTopY + headerHeight, RIGHT, headerTopY + headerHeight);

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(TABLE_HEADER_FONT_SIZE);

  pdf.text('Producto', LEFT + 2, startY);
  pdf.text('Cant.', QTY_X, startY, { align: 'right' });
  pdf.text('Precio', PRICE_X, startY, { align: 'right' });
  pdf.text('Total', TOTAL_X - 1, startY, { align: 'right' });

  return startY + 8.8;
}

function drawLineItems(pdf: jsPDF, lines: DeliveryNoteLine[], startY: number) {
  let y = drawTableHeader(pdf, startY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(TABLE_BODY_FONT_SIZE);

  if (lines.length === 0) {
    pdf.setTextColor(110, 110, 110);
    pdf.text('No hay productos agregados.', LEFT, y);
    pdf.setTextColor(0, 0, 0);
    return y + 7;
  }

  lines.forEach((line) => {
    const productNameLines = getProductNameLines(pdf, line.name);
    const rowHeight = getLineItemRowHeight(pdf, line);

    pdf.setTextColor(0, 0, 0);

    productNameLines.forEach((productLine, index) => {
      pdf.text(productLine, LEFT, y + index * PRODUCT_LINE_HEIGHT);
    });

    pdf.text(formatQuantity(line.quantity), QTY_X, y, { align: 'right' });
    pdf.text(formatMoney(line.price), PRICE_X, y, { align: 'right' });
    pdf.text(formatMoney(line.total), TOTAL_X, y, { align: 'right' });

    y += rowHeight;
  });

  return y;
}

function drawTotals(pdf: jsPDF, note: DeliveryNote, startY: number) {
  let y = startY + 2.5;

  pdf.setDrawColor(210, 210, 210);
  pdf.line(120, y, RIGHT, y);

  y += 7;
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Subtotal', PRICE_X, y, { align: 'right' });
  pdf.text(formatMoney(note.subtotal), RIGHT, y, { align: 'right' });

  y += 6.8;
  pdf.setFontSize(11.5);
  pdf.text('Total', PRICE_X, y, { align: 'right' });
  pdf.text(formatMoney(note.total), RIGHT, y, { align: 'right' });

  return y;
}

function drawNotesOnCurrentPage(
  pdf: jsPDF,
  notesLines: string[],
  startY: number
) {
  let y = startY + 10;

  pdf.setTextColor(0, 0, 0);
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

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text('Observaciones', LEFT, y);

  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(notesLines, LEFT, y);
}

function getPageLayoutMetrics(
  note: DeliveryNote,
  company: CompanyProfile,
  customer?: Customer | null
) {
  const measurePdf = new jsPDF('p', 'mm', 'a4');
  const headerBottomY = drawHeader(measurePdf, note, company, 1);
  const customerEndY = drawCustomerBlock(measurePdf, note, headerBottomY + 9, customer);
  const firstRowY = drawTableHeader(measurePdf, customerEndY);

  measurePdf.setFont('helvetica', 'normal');
  measurePdf.setFontSize(TABLE_BODY_FONT_SIZE);

  return {
    maxHeightWithoutTotals: Math.max(
      TABLE_ROW_HEIGHT,
      BODY_BOTTOM_Y - firstRowY
    ),
    maxHeightWithTotals: Math.max(
      TABLE_ROW_HEIGHT,
      BODY_BOTTOM_Y - RESERVED_TOTALS_HEIGHT - firstRowY
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

function buildPdf(note: DeliveryNote, company: CompanyProfile, customer?: Customer | null) {
  const pdf = new jsPDF('p', 'mm', 'a4');

  const layout = getPageLayoutMetrics(note, company, customer);
  const itemPages = planItemPages(
    pdf,
    note.lines || [],
    layout.maxHeightWithoutTotals,
    layout.maxHeightWithTotals
  );

  let pageNumber = 1;

  itemPages.forEach((pageLines, index) => {
    if (index > 0) {
      pdf.addPage();
      pageNumber += 1;
    }

    const headerBottomY = drawHeader(pdf, note, company, pageNumber);
    drawFooter(pdf, company, pageNumber);

    const customerEndY = drawCustomerBlock(pdf, note, headerBottomY + 9, customer);
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
  company: CompanyProfile,
  customer?: Customer | null
): Blob {
  const pdf = buildPdf(note, company, customer);
  return pdf.output('blob');
}

export function saveProfessionalPDF(
  note: DeliveryNote,
  company: CompanyProfile,
  customer?: Customer | null
): void {
  const pdf = buildPdf(note, company, customer);
  const safeCustomer = (note.customerName || customer?.name || 'cliente').replace(/\s+/g, '_');
  const fileName = `${note.noteNumber}_${safeCustomer}.pdf`;
  pdf.save(fileName);
}
