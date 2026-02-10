

import PDFDocument from 'pdfkit';
import { ensureConnection } from '../config/database.js';
import UserModel from '../models/User.js';
import InvoiceModel from '../models/Invoice.js';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getNextReceiptNumber } from './receiptCounter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Convert number to words (simple version for amounts)
 * @param {number} num - Number to convert
 * @returns {string} Number in words
 */
export function numberToWords(num) {
  try {
    // Validate input
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) {
      return '';
    }

    // Ensure it's an integer
    num = Math.floor(Math.abs(num));

    // Handle zero
    if (num === 0) return 'Zero';

    // Limit to reasonable range to prevent stack overflow
    if (num > 999999999) {
      return 'Very Large Amount';
    }

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num < 20) {
      return ones[num] || '';
    }
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      return (tens[ten] || '') + (one > 0 ? ' ' + (ones[one] || '') : '');
    }
    if (num < 1000) {
      const hundred = Math.floor(num / 100);
      const remainder = num % 100;
      return (ones[hundred] || '') + ' Hundred' + (remainder > 0 ? ' ' + numberToWords(remainder) : '');
    }
    if (num < 100000) {
      const thousand = Math.floor(num / 1000);
      const remainder = num % 1000;
      return numberToWords(thousand) + ' Thousand' + (remainder > 0 ? ' ' + numberToWords(remainder) : '');
    }
    if (num < 10000000) {
      const lakh = Math.floor(num / 100000);
      const remainder = num % 100000;
      return numberToWords(lakh) + ' Lakh' + (remainder > 0 ? ' ' + numberToWords(remainder) : '');
    }
    const crore = Math.floor(num / 10000000);
    const remainder = num % 10000000;
    return numberToWords(crore) + ' Crore' + (remainder > 0 ? ' ' + numberToWords(remainder) : '');
  } catch (error) {
    console.error('Error in numberToWords:', error, 'for num:', num);
    return ''; // Return empty string on error
  }
}

/**
 * Generate a PDF receipt for a payment confirmation
 * @param {Object} member - Member object
 * @param {Object} invoice - Invoice object
 * @param {Object} payment - Payment object
 * @param {string} receiptNo - Optional receipt number (if not provided, will generate new one)
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePaymentReceiptPDF(member, invoice, payment, receiptNo = null) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🚨 RUNTIME pdfReceipt.js LOADED — MEMBER ID:', member?.id);
      // CRITICAL VALIDATION: Ensure member matches invoice
      if (!member) {
        console.error(`❌ RECEIPT GENERATION ERROR: Member object is required`);
        throw new Error('Member object is required for receipt generation');
      }
      if (!invoice) {
        console.error(`❌ RECEIPT GENERATION ERROR: Invoice object is required`);
        throw new Error('Invoice object is required for receipt generation');
      }

      // VALIDATION RULES (ANY ONE is sufficient):
      // 1) invoice.memberNo === member.memberNo (primary)
      // 2) invoice.memberId === member.id
      // 3) invoice.memberId exists in member.previousDisplayIds[].id
      const normalizeMemberNo = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const parsed = Number(String(value).trim());
        return Number.isFinite(parsed) ? parsed : null;
      };

      const invoiceMemberNo = normalizeMemberNo(invoice?.memberNo);
      const memberNo = normalizeMemberNo(member?.memberNo);

      const invoiceMemberId = typeof invoice?.memberId === 'string'
        ? invoice.memberId
        : (invoice?.memberId === null || invoice?.memberId === undefined ? '' : String(invoice.memberId));
      const memberDisplayId = typeof member?.id === 'string'
        ? member.id
        : (member?.id === null || member?.id === undefined ? '' : String(member.id));

      const previousDisplayIds = Array.isArray(member?.previousDisplayIds)
        ? member.previousDisplayIds
          .map((entry) => {
            if (!entry) return '';
            if (typeof entry.id === 'string') return entry.id;
            if (entry.id === null || entry.id === undefined) return '';
            return String(entry.id);
          })
          .filter(Boolean)
        : [];

      const matchesByMemberNo = invoiceMemberNo !== null && memberNo !== null && invoiceMemberNo === memberNo;
      const matchesByCurrentDisplayId = Boolean(invoiceMemberId) && Boolean(memberDisplayId) && invoiceMemberId === memberDisplayId;
      const matchesByPreviousDisplayId = Boolean(invoiceMemberId) && previousDisplayIds.includes(invoiceMemberId);

      if (!matchesByMemberNo && !matchesByCurrentDisplayId && !matchesByPreviousDisplayId) {
        console.error(
          `❌ RECEIPT GENERATION ERROR: Member mismatch detected!
           invoice.id = "${invoice?.id}"
           invoice.memberNo = "${invoice?.memberNo}"
           member.memberNo = "${member?.memberNo}"
           invoice.memberId = "${invoice?.memberId}"
           member.id = "${member?.id}"
           member.name = "${member?.name}"`
        );
        throw new Error('Member mismatch: invoice does not belong to this member');
      }

      console.log(
        `✓ Receipt generation validated for invoice ${invoice?.id || 'N/A'} ` +
        `(match: ${matchesByMemberNo ? 'memberNo' : matchesByCurrentDisplayId ? 'currentId' : 'previousId'})`
      );
      console.log(`  Member: ${member?.name}, Invoice Amount: ${invoice?.amount}`);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Official Receipt',
          Author: 'Indian Muslim Association Jama-ath Ltd.',
          Subject: `Official Receipt - ${invoice?.id || payment?.invoiceId || 'N/A'}`,
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // A4 dimensions in points: 595.28 x 841.89
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2); // 495.28
      const leftMargin = margin;
      const rightMargin = pageWidth - margin;

      // Responsive calculations - use percentages for better scaling
      // This allows the layout to adapt if page size changes
      const responsiveUnit = pageWidth / 100; // 1% of page width = ~5.95 points
      const responsiveHeightUnit = pageHeight / 100; // 1% of page height = ~8.42 points

      // Helper function to get responsive width (percentage of content width)
      const getResponsiveWidth = (percent) => (contentWidth * percent) / 100;

      // Helper function to get responsive X position (percentage from left margin)
      const getResponsiveX = (percent) => leftMargin + (contentWidth * percent) / 100;

      // Helper function to draw checkbox
      const drawCheckbox = (x, y, size = 8, checked = false) => {
        doc.rect(x, y, size, size)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke();
        if (checked) {
          // Draw checkmark more clearly and centered
          const checkmarkSize = size * 0.7;
          doc.fontSize(checkmarkSize)
            .fillColor('#000000')
            .font('Helvetica-Bold')
            .text('✓', x + (size - checkmarkSize) / 2, y + (size - checkmarkSize) / 2 - 1);
        }
      };

      // Helper function to draw underline
      const drawUnderline = (x, y, width) => {
        doc.moveTo(x, y)
          .lineTo(x + width, y)
          .strokeColor('#000000')
          .lineWidth(0.5)
          .stroke();
      };

      let currentY = margin;

      // Prepare logo path first
      let logoPath = null;
      try {
        // Try multiple possible logo paths and formats
        const logoExtensions = ['png', 'jpg', 'jpeg'];
        const basePaths = [
          path.join(__dirname, '../public'),
          path.join(__dirname, '../assets'),
          path.join(__dirname, '../../public'),
          path.join(__dirname, '../../assets'),
          path.join(process.cwd(), 'server/public'),
          path.join(process.cwd(), 'server/assets'),
          path.join(process.cwd(), 'public'),
          path.join(process.cwd(), 'assets'),
        ];

        for (const basePath of basePaths) {
          for (const ext of logoExtensions) {
            const testPath = path.join(basePath, `logo.${ext}`);
            if (fs.existsSync(testPath)) {
              logoPath = testPath;
              break;
            }
          }
          if (logoPath) break;
        }
      } catch (logoError) {
        console.log('Logo not found or failed to load:', logoError.message);
      }

      // Calculate header text height to position logo accordingly
      const headerTextHeight = (responsiveHeightUnit * 2) + (responsiveHeightUnit * 1.8) + (responsiveHeightUnit * 1.8); // Approximate height of all three text lines

      // Logo size - bigger (80x80 points)
      const logoSize = 80;

      // Header section - Center everything, with logo on the left
      const headerStartY = currentY;
      let logoY = headerStartY;

      // Position logo on the left side, centered vertically with header text
      if (logoPath) {
        try {
          logoY = headerStartY + (headerTextHeight / 2) - (logoSize / 2); // Center logo vertically with text
          doc.image(logoPath, leftMargin, logoY, {
            fit: [logoSize, logoSize],
            align: 'left'
          });
        } catch (logoError) {
          console.log('Error loading logo:', logoError.message);
        }
      }

      // Header - Organization Name (centered on full page width, ignoring logo)
      doc.fontSize(Math.max(14, responsiveUnit * 2.5))
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('INDIAN MUSLIM ASSOCIATION JAMA-ATH LTD.', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY += (responsiveHeightUnit * 2);

      // Hong Kong (centered on full page width)
      doc.fontSize(Math.max(11, responsiveUnit * 2))
        .fillColor('#000000')
        .font('Helvetica')
        .text('Hong Kong', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY += (responsiveHeightUnit * 1.8);

      // Estd. 1979 (centered on full page width)
      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
        .fillColor('#666666')
        .font('Helvetica-Oblique')
        .text('Estd. 1979', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      // Move to next section - use the maximum of logo bottom or text bottom
      const logoBottom = logoPath ? logoY + logoSize : headerStartY;
      currentY = Math.max(currentY + (responsiveHeightUnit * 1.5), logoBottom) + (responsiveHeightUnit * 1.5);

      currentY += (responsiveHeightUnit * 3);

      // Official Receipt Title
      doc.fontSize(Math.max(12, responsiveUnit * 2.2))
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('OFFICIAL RECEIPT', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY += (responsiveHeightUnit * 4);

      const isBlankReceiptField = (value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        return false;
      };

      const displayReceiptField = (value) => (isBlankReceiptField(value) ? '-' : String(value));

      // Prepare data
      // Only use receipt number if provided or exists in invoice - do NOT generate new one if empty
      const receiptNoValue = receiptNo || invoice?.receiptNumber || null;
      const receiptDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      // CRITICAL: Use ONLY the member object passed, never fall back to invoice.memberName
      // The member object MUST be fetched using invoice.memberId before calling this function
      let memberName = displayReceiptField(member?.name);
      // Member ID: use the current business display ID (AMxxx / LMxxx) from the member record.
      // DISPLAY ONLY — do not derive or recompute IDs.
      const memberId = displayReceiptField(member?.id);

      // Subscription Type: render the exact stored value (no mapping / no normalization).
      const subscriptionType = displayReceiptField(invoice?.subscriptionType ?? member?.subscriptionType ?? invoice?.invoiceType);

      // Display-only: Replace internal upgrade marker with professional wording.
      // Apply ONLY for Annual -> Lifetime Member + Janaza Fund upgrades.
      if (typeof memberName === 'string' && memberName.includes('(Upgraded AMLM)')) {
        const isLifetimeJanazaFund = String(subscriptionType).trim() === 'Lifetime Member + Janaza Fund';
        const hasAnnualLegacyDisplayId = Array.isArray(member?.previousDisplayIds)
          && member.previousDisplayIds.some((entry) => String(entry?.id || '').trim().toUpperCase().startsWith('AM'));

        if (isLifetimeJanazaFund && hasAnnualLegacyDisplayId) {
          memberName = memberName.replace('(Upgraded AMLM)', '(Upgraded to Lifetime)');
        } else {
          memberName = memberName.replace('(Upgraded AMLM)', '').replace(/\s+/g, ' ').trim();
          if (!memberName) memberName = '-';
        }
      }

      // Keep existing receipt table description behavior for Lifetime vs Annual.
      const isLifetimeSubscription =
        typeof subscriptionType === 'string' && subscriptionType.toLowerCase().includes('lifetime');
      const showRenewalText = !isLifetimeSubscription;

      // Extract year from invoice period
      const periodStr = String(invoice?.period || '').trim();
      const yearMatch = periodStr.match(/\d{4}/);
      const membershipYear = yearMatch ? yearMatch[0] : null;
      const membershipYearDisplay = displayReceiptField(membershipYear);

      // Two-column header grid (labels + values, 50/50 split)
      const detailRowHeight = 30;
      const detailCol1Width = contentWidth * 0.5; // Left column (50%)
      const detailCol2Width = contentWidth * 0.5; // Right column (50%)

      // Invoice details table
      const detailsStartY = currentY;

      const verticalBorderX = leftMargin + detailCol1Width;

      const drawHeaderRow = ({ leftLabel, leftValue, rightLabel, rightValue }) => {
        const col1Width = contentWidth * 0.5;
        const col2Width = contentWidth - col1Width;
        // Outer border
        doc.rect(leftMargin, currentY, contentWidth, detailRowHeight)
          .strokeColor('#000000')
          .lineWidth(0.5)
          .stroke();

        // Center divider
        doc.moveTo(verticalBorderX, currentY)
          .lineTo(verticalBorderX, currentY + detailRowHeight)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke();

        const cellPaddingX = 5;
        const labelY = currentY + 4;
        const valueY = currentY + 16;

        doc.fontSize(Math.max(8, responsiveUnit * 1.4))
          .fillColor('#000000')
          .font('Helvetica-Bold');
        doc.text(String(leftLabel), leftMargin + cellPaddingX, labelY, { width: col1Width - (cellPaddingX * 2) });
        doc.text(String(rightLabel), leftMargin + col1Width + cellPaddingX, labelY, { width: col2Width - (cellPaddingX * 2) });

        doc.fontSize(Math.max(9, responsiveUnit * 1.6))
          .fillColor('#000000')
          .font('Helvetica');
        doc.text(displayReceiptField(leftValue), leftMargin + cellPaddingX, valueY, { width: col1Width - (cellPaddingX * 2) });
        doc.text(displayReceiptField(rightValue), leftMargin + col1Width + cellPaddingX, valueY, { width: col2Width - (cellPaddingX * 2) });

        currentY += detailRowHeight;
      };

      // Header layout (exact 3 rows, 2 columns):
      // Receipt No | Date
      // Member Name | Member ID
      // Subscription Type | Membership Year
      // drawHeaderRow({ leftLabel: 'Receipt No', rightLabel: 'Date', leftValue: receiptNoValue || '-', rightValue: receiptDate });
      drawHeaderRow({ leftLabel: 'Receipt No', rightLabel: 'Date', leftValue: receiptNoValue || '-', rightValue: receiptDate });

      console.log("[PDF FINAL HEADER] Member ID =", member?.id);
      drawHeaderRow({
        leftLabel: 'Member Name',
        rightLabel: 'Member ID',
        leftValue: `${memberName}`,
        rightValue: member?.id || "-",
      });
      drawHeaderRow({ leftLabel: 'Subscription Type', rightLabel: 'Membership Year', leftValue: subscriptionType, rightValue: membershipYearDisplay });
      // currentY is already advanced inside drawHeaderRow for each header row

      // Description and Amount Table
      const tableTopY = currentY;
      const rowHeight = 20;
      const col1Width = contentWidth * 0.5; // Description column
      const col2Width = contentWidth * 0.2; // Year column
      const col3Width = contentWidth * 0.3; // Amount column

      // Table header with grey background
      const headerColor = '#E5E5E5'; // Light grey
      doc.rect(leftMargin, tableTopY, contentWidth, rowHeight)
        .fill(headerColor)
        .strokeColor('#000000')
        .lineWidth(0.5)
        .stroke();

      // Header text
      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
        .fillColor('#000000')
        .font('Helvetica-Bold');

      doc.text('Description', leftMargin + 5, tableTopY + 5, { width: col1Width - 10 });
      doc.text('Year', leftMargin + col1Width + 5, tableTopY + 5, { width: col2Width - 10 });
      doc.text('Amount (HKD)', leftMargin + col1Width + col2Width + 5, tableTopY + 5, { width: col3Width - 10 });

      currentY = tableTopY + rowHeight;

      // Table data rows (using amountStr and amountNum already declared above)
      const amountValue = payment?.amount ?? invoice?.amount ?? '';
      const amountStr = typeof amountValue === 'string' ? amountValue : String(amountValue ?? '');
      const amountNum = typeof amountValue === 'number'
        ? Number(amountValue)
        : Number(String(amountValue).replace(/[^\d.]/g, ""));
      if (Number.isNaN(amountNum)) {
        throw new Error("Invalid amount for receipt generation");
      }
      const formattedAmount = amountNum.toFixed(2);

      // First data row
      doc.rect(leftMargin, currentY, contentWidth, rowHeight)
        .strokeColor('#000000')
        .lineWidth(0.5)
        .stroke();

      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
        .fillColor('#000000')
        .font('Helvetica');

      doc.text(showRenewalText ? 'Membership Renewal Fee' : subscriptionType, leftMargin + 5, currentY + 5, { width: col1Width - 10 });
      doc.text(membershipYearDisplay, leftMargin + col1Width + 5, currentY + 5, { width: col2Width - 10 });
      doc.text(`HK$${formattedAmount}`, leftMargin + col1Width + col2Width + 5, currentY + 5, { width: col3Width - 10, align: 'right' });

      currentY += rowHeight;

      // Total row (bold)
      doc.rect(leftMargin, currentY, contentWidth, rowHeight)
        .strokeColor('#000000')
        .lineWidth(0.5)
        .stroke();

      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
        .fillColor('#000000')
        .font('Helvetica-Bold');

      doc.text('Total Amount', leftMargin + 5, currentY + 5, {
        width: col1Width + col2Width - 10
      });
      doc.text(`HK$${formattedAmount}`, leftMargin + col1Width + col2Width + 5, currentY + 5, {
        width: col3Width - 10,
        align: 'right'
      });

      currentY += rowHeight + (responsiveHeightUnit * 3);

      // Payment Information Section
      doc.fontSize(Math.max(10, responsiveUnit * 1.9))
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Payment Information', leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
        .fillColor('#000000')
        .font('Helvetica');

      const paymentMethod = String(payment?.method || invoice?.method || '').trim();
      const paymentMethodDisplay = paymentMethod || '';
      doc.text(`Payment Method: ${paymentMethodDisplay}`, leftMargin, currentY, { width: contentWidth });

      // currentY += (responsiveHeightUnit * 2.5);

      // const paymentRef = payment?.reference || payment?.transactionId || '';
      // doc.text(`Reference / Transaction ID: ${paymentRef}`, leftMargin, currentY, { width: contentWidth });

      // Receiver Name hidden - removed from PDF
      currentY += (responsiveHeightUnit * 4);

      // Footer disclaimer
      doc.fontSize(Math.max(8, responsiveUnit * 1.4))
        .fillColor('#000000')
        .font('Helvetica')
        .text('This is a system-generated invoice and does not require a signature.', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY += (responsiveHeightUnit * 2);

      doc.text('Issued by', leftMargin, currentY, {
        width: contentWidth,
        align: 'center'
      });

      currentY += (responsiveHeightUnit * 1.5);

      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Indian Muslim Association Jama-ath Ltd.', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      // Close the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Fetch image from URL and return as buffer
 * @param {string} url - Image URL (can be HTTP, HTTPS, or data URL)
 * @returns {Promise<Buffer|null>} Image buffer or null if failed
 */
/**
 * Generate a PDF receipt for a donation
 * @param {Object} donation - Donation object
 * @param {Object} member - Member object (if isMember is true)
 * @returns {Promise<Buffer>} PDF buffer
 */

export async function generateDonationReceiptPDF(donation, member = null, receiptNo = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Donation Receipt',
          Author: 'Indian Muslim Association Jama-ath Ltd.',
          Subject: `Donation Receipt - ${donation?.id || 'N/A'}`
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      /* ================= PAGE METRICS ================= */
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      const leftMargin = margin;

      const responsiveUnit = pageWidth / 100;
      const responsiveHeightUnit = pageHeight / 100;

      let currentY = margin;

      /* ================= LOGO ================= */
      let logoPath = null;
      try {
        const logoExtensions = ['png', 'jpg', 'jpeg'];
        const basePaths = [
          path.join(process.cwd(), 'public'),
          path.join(process.cwd(), 'assets'),
          path.join(process.cwd(), 'server/public'),
          path.join(process.cwd(), 'server/assets'),
        ];

        for (const basePath of basePaths) {
          for (const ext of logoExtensions) {
            const testPath = path.join(basePath, `logo.${ext}`);
            if (fs.existsSync(testPath)) {
              logoPath = testPath;
              break;
            }
          }
          if (logoPath) break;
        }
      } catch { }

      const headerTextHeight =
        (responsiveHeightUnit * 2) +
        (responsiveHeightUnit * 1.8) +
        (responsiveHeightUnit * 1.8);

      const logoSize = 80;
      let logoY = currentY;

      if (logoPath) {
        logoY = currentY + (headerTextHeight / 2) - (logoSize / 2);
        doc.image(logoPath, leftMargin, logoY, { fit: [logoSize, logoSize] });
      }

      /* ================= HEADER ================= */
      doc.font('Helvetica-Bold')
        .fontSize(Math.max(14, responsiveUnit * 2.5))
        .text('INDIAN MUSLIM ASSOCIATION JAMA-ATH LTD.', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY += responsiveHeightUnit * 2;

      doc.font('Helvetica')
        .fontSize(Math.max(11, responsiveUnit * 2))
        .text('Hong Kong', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY += responsiveHeightUnit * 1.8;

      doc.font('Helvetica-Oblique')
        .fontSize(Math.max(9, responsiveUnit * 1.6))
        .fillColor('#666')
        .text('Estd. 1979', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY = Math.max(currentY + 20, logoY + logoSize) + 30;

      doc.font('Helvetica-Bold')
        .fontSize(Math.max(12, responsiveUnit * 2.2))
        .fillColor('#000')
        .text('DONATION RECEIPT', leftMargin, currentY, {
          width: contentWidth,
          align: 'center'
        });

      currentY += 40;

      /* ================= HEADER TABLE ================= */
      const rowHeight = 30;
      const colWidth = contentWidth / 2;

      const drawRow = (lLabel, lValue, rLabel, rValue) => {
        doc.rect(leftMargin, currentY, contentWidth, rowHeight)
          .strokeColor('#000000')
          .lineWidth(0.5)
          .stroke();

        doc.moveTo(leftMargin + colWidth, currentY)
          .lineTo(leftMargin + colWidth, currentY + rowHeight)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke();

        doc.font('Helvetica-Bold').fontSize(8)
          .text(lLabel, leftMargin + 6, currentY + 5)
          .text(rLabel, leftMargin + colWidth + 6, currentY + 5);

        doc.font('Helvetica').fontSize(9)
          .text(lValue || '-', leftMargin + 6, currentY + 16)
          .text(rValue || '-', leftMargin + colWidth + 6, currentY + 16);

        currentY += rowHeight;
      };

      const receiptDate = donation?.date
        ? new Date(donation.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      // drawRow('Donor Name', donation?.donorName || '-', 'Receipt No', donation?.receipt_number || '-');
      drawRow('Receipt No', donation?.receipt_number || '-', 'Date', receiptDate);
      drawRow('Donor Name', donation?.donorName || '-','Member ID', member?.id || '-');
      drawRow('Amount (HKD)', `HK$${Number(donation?.amount || 0).toFixed(2)}`, 'Donation Towards', donation?.donationType || '-');

      /* ================= DESCRIPTION / AMOUNT TABLE (MATCHES PAYMENT RECEIPT EXACTLY) ================= */

      const tableTopY = currentY;
      const tableRowHeight = 20;

      const col1Width = contentWidth * 0.5;
      const col2Width = contentWidth * 0.2;
      const col3Width = contentWidth * 0.3;

      // const headerColor = '#E5E5E5';

      // Header row
      // doc.rect(leftMargin, tableTopY, contentWidth, tableRowHeight)
      //   // .fill(headerColor)
      //   .strokeColor('#000000')
      //   .lineWidth(0.5)
      //   .stroke();

      // doc.font('Helvetica-Bold').fontSize(9);
      // doc.text('Description', leftMargin + 5, tableTopY + 5, { width: col1Width - 10 });
      // doc.text('Year', leftMargin + col1Width + 5, tableTopY + 5, { width: col2Width - 10 });
      // doc.text('Amount (HKD)', leftMargin + col1Width + col2Width + 5, tableTopY + 5, {
      //   width: col3Width - 10
      // });

      // const headerColor = '#E5E5E5';

      // // Header background
      // doc.rect(leftMargin, tableTopY, contentWidth, tableRowHeight)
      //   .fill(headerColor)
      //   .strokeColor('#000000')
      //   .lineWidth(0.5)
      //   .stroke();

      // 🔴 CRITICAL RESET — THIS FIXES EVERYTHING
      // doc.fillColor('#000000');

      // Header text
      // doc.font('Helvetica-Bold').fontSize(9);
      // doc.text('Description', leftMargin + 5, tableTopY + 5, { width: col1Width - 10 });
      // doc.text('Year', leftMargin + col1Width + 5, tableTopY + 5, { width: col2Width - 10 });
      // doc.text(
      //   'Amount (HKD)',
      //   leftMargin + col1Width + col2Width + 5,
      //   tableTopY + 5,
      //   { width: col3Width - 10 }
      // );


      currentY = tableTopY + tableRowHeight;

      const donationAmountNum = Number(donation?.amount || 0);
      const donationAmount = donationAmountNum.toFixed(2);
      const donationYear = donation?.date
        ? new Date(donation.date).getFullYear()
        : new Date().getFullYear();

      // Data row
      // doc.rect(leftMargin, currentY, contentWidth, tableRowHeight)
      //   .strokeColor('#000000')
      //   .lineWidth(0.5)
      //   .stroke();

      // doc.font('Helvetica').fontSize(9);
      // doc.text(donation?.donationType || 'Donation', leftMargin + 5, currentY + 5, { width: col1Width - 10 });
      // doc.text(donationYear, leftMargin + col1Width + 5, currentY + 5, { width: col2Width - 10 });
      // doc.text(`HK$${donationAmount}`, leftMargin + col1Width + col2Width + 5, currentY + 5, {
      //   width: col3Width - 10,
      //   align: 'right'
      // });

      // currentY += tableRowHeight;

      // Total row
      // doc.rect(leftMargin, currentY, contentWidth, tableRowHeight)
      //   .strokeColor('#000000')
      //   .lineWidth(0.5)
      //   .stroke();

      // doc.font('Helvetica-Bold').fontSize(9);
      // doc.text('Total Amount', leftMargin + 5, currentY + 5, {
      //   width: col1Width + col2Width - 10
      // });
      // doc.text(`HK$${donationAmount}`, leftMargin + col1Width + col2Width + 5, currentY + 5, {
      //   width: col3Width - 10,
      //   align: 'right'
      // });

      // currentY += tableRowHeight + 25;

      /* ================= PAYMENT INFO ================= */
      doc.font('Helvetica-Bold').fontSize(10)
        .text('Payment Information', leftMargin, currentY);

      currentY += 20;

      doc.font('Helvetica').fontSize(9)
        .text(`Payment Method: ${donation?.method || '-'}`, leftMargin, currentY);

      currentY += 30;

      doc.font('Helvetica-Bold')
        .fontSize(9)
        .text(
          'Thank you for your Generosity,\nYour donation supports our ongoing Charitable and Community services',
          leftMargin,
          currentY,
          { width: contentWidth, align: 'center' }
        );

      currentY += 35;

      // doc.font('Helvetica').fontSize(9)
      //   .text(
      //     'For any queries, please contact: Email: info@imahk.org Whatsapp: +852 9545 4447',
      //     // currentY,
      //     { align: 'center' }
      //   );

      doc.font('Helvetica')
        .fontSize(9)
        .text(
          'For any queries, please contact: Email: info@imahk.org Whatsapp: +852 9545 4447',
          leftMargin,
          currentY,
          { width: contentWidth, align: 'center' }
        );

      currentY += 30;

      /* ================= FOOTER ================= */
      doc.font('Helvetica')
        .fontSize(9)
        .text(
          'This is a system-generated receipt and does not require a signature.',
          leftMargin,
          currentY,
          { width: contentWidth, align: 'center' }
        );

      currentY += 30;

      doc.font('Helvetica-Bold')
        .fontSize(9)
        .text(
          'Issued by\nIndian Muslim Association Jama-ath Ltd.',
          leftMargin,
          currentY,
          { width: contentWidth, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}



async function fetchImageFromUrl(url) {
  return new Promise((resolve) => {
    try {
      // Handle data URLs (base64)
      if (url.startsWith('data:')) {
        const base64Data = url.split(',')[1];
        if (base64Data) {
          resolve(Buffer.from(base64Data, 'base64'));
          return;
        }
      }

      // Handle HTTP/HTTPS URLs
      const protocol = url.startsWith('https:') ? https : http;

      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          console.error(`Failed to fetch image: ${response.statusCode}`);
          resolve(null);
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        response.on('error', (error) => {
          console.error('Error fetching image:', error);
          resolve(null);
        });
      }).on('error', (error) => {
        console.error('Error fetching image:', error);
        resolve(null);
      });
    } catch (error) {
      console.error('Error processing image URL:', error);
      resolve(null);
    }
  });
}
