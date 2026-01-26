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
      // CRITICAL VALIDATION: Ensure member matches invoice
      if (!member) {
        console.error(`❌ RECEIPT GENERATION ERROR: Member object is required`);
        throw new Error('Member object is required for receipt generation');
      }
      if (!invoice) {
        console.error(`❌ RECEIPT GENERATION ERROR: Invoice object is required`);
        throw new Error('Invoice object is required for receipt generation');
      }
      if (member.id !== invoice.memberId) {
        console.error(
          `❌ RECEIPT GENERATION ERROR: Member ID mismatch detected!
           Expected invoice.memberId to match member.id
           member.id = "${member.id}"
           invoice.memberId = "${invoice.memberId}"
           invoice.id = "${invoice.id}"
           member.name = "${member.name}"
           This indicates data corruption or incorrect member lookup.`
        );
        throw new Error(`Member ID mismatch: Cannot generate receipt when member.id (${member.id}) does not match invoice.memberId (${invoice.memberId})`);
      }
      
      console.log(`✓ Receipt generation validated: member.id=${member.id} matches invoice.memberId=${invoice.memberId} for invoice ${invoice.id}`);
      console.log(`  Member: ${member.name}, Invoice Amount: ${invoice.amount}`);
      
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
      const memberName = member?.name || 'N/A';
      const memberId = member?.id || 'N/A';
      
      // Subscription type must always come from the member record (single source of truth)
      const memberSubscriptionTypeRaw = typeof member?.subscriptionType === 'string'
        ? member.subscriptionType.trim()
        : (member?.subscriptionType ?? '');
      const invoiceSubscriptionTypeRaw = typeof invoice?.subscriptionType === 'string'
        ? invoice.subscriptionType.trim()
        : (invoice?.invoiceType ?? '');
      const subscriptionType = (memberSubscriptionTypeRaw && String(memberSubscriptionTypeRaw))
        || (invoiceSubscriptionTypeRaw && String(invoiceSubscriptionTypeRaw))
        || 'Not Assigned';
      const isLifetimeSubscription = typeof subscriptionType === 'string' && subscriptionType.toLowerCase().includes('lifetime');
      const showRenewalText = !isLifetimeSubscription;
      
      // Extract year from invoice period
      const periodStr = String(invoice?.period || '').trim();
      const yearMatch = periodStr.match(/\d{4}/);
      const renewalYear = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

      // Two-column table layout for invoice details (50/50 split for centered divider)
      const detailRowHeight = 20;
      const detailCol1Width = contentWidth * 0.5; // Left column (50%)
      const detailCol2Width = contentWidth * 0.5; // Right column (50%)
      
      // Invoice details table
      const detailsStartY = currentY;
      
      const verticalBorderX = leftMargin + detailCol1Width;
      
      // Row 1: Receipt No and Date (Invoice No removed)
      doc.rect(leftMargin, currentY, contentWidth, detailRowHeight)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
      
      // Vertical border in the middle
      doc.moveTo(verticalBorderX, currentY)
         .lineTo(verticalBorderX, currentY + detailRowHeight)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();
      
      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica');
      
      doc.text(`Receipt No: ${receiptNoValue || '-'}`, leftMargin + 5, currentY + 5, { width: detailCol1Width - 10 });
      doc.text(`Date: ${receiptDate}`, leftMargin + detailCol1Width + 5, currentY + 5, { width: detailCol2Width - 10 });
      currentY += detailRowHeight;
      
      // Row 2: Member Name only (Member ID hidden)
      doc.rect(leftMargin, currentY, contentWidth, detailRowHeight)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
      
      // Vertical border in the middle
      doc.moveTo(verticalBorderX, currentY)
         .lineTo(verticalBorderX, currentY + detailRowHeight)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();
      
      doc.text(`Member Name: ${memberName}`, leftMargin + 5, currentY + 5, { width: detailCol1Width - 10 });
      // Year moved to empty cell (where Member ID was)
      doc.text(showRenewalText ? `Year: ${renewalYear}` : '', leftMargin + detailCol1Width + 5, currentY + 5, { width: detailCol2Width - 10 });
      currentY += detailRowHeight;
      
      // Row 3: Subscription Type only (Year moved to Row 2)
      doc.rect(leftMargin, currentY, contentWidth, detailRowHeight)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
      
      // Vertical border in the middle (centered)
      doc.moveTo(verticalBorderX, currentY)
         .lineTo(verticalBorderX, currentY + detailRowHeight)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();
      
      // Subscription Type in left column (with proper width to prevent overflow)
      doc.text(`Subscription Type: ${subscriptionType}`, leftMargin + 5, currentY + 5, { 
        width: detailCol1Width - 10
      });
      
      // Right cell empty (Year moved to Row 2)
      doc.text('', leftMargin + detailCol1Width + 5, currentY + 5, { width: detailCol2Width - 10 });
      currentY += detailRowHeight + (responsiveHeightUnit * 3);

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
      doc.text(showRenewalText ? 'Year' : '', leftMargin + col1Width + 5, tableTopY + 5, { width: col2Width - 10 });
      doc.text('Amount (HKD)', leftMargin + col1Width + col2Width + 5, tableTopY + 5, { width: col3Width - 10 });
      
      currentY = tableTopY + rowHeight;
      
      // Table data rows (using amountStr and amountNum already declared above)
      const formattedAmount = amountNum.toFixed(2);
      
      // First data row - Membership Renewal Fee (hidden label/year for lifetime subscriptions)
      doc.rect(leftMargin, currentY, contentWidth, rowHeight)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
      
      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica');
      
      doc.text(showRenewalText ? 'Membership Renewal Fee' : subscriptionType, leftMargin + 5, currentY + 5, { width: col1Width - 10 });
      doc.text(showRenewalText ? renewalYear : '', leftMargin + col1Width + 5, currentY + 5, { width: col2Width - 10 });
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
      
      currentY += (responsiveHeightUnit * 2.5);
      
      const paymentRef = payment?.reference || payment?.transactionId || '';
      doc.text(`Reference / Transaction ID: ${paymentRef}`, leftMargin, currentY, { width: contentWidth });
      
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
export async function generateDonationReceiptPDF(donation, member = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Donation Receipt',
          Author: 'Indian Muslim Association Jama-ath Ltd.',
          Subject: `Donation Receipt - ${donation._id || donation.id || 'N/A'}`,
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
      const contentWidth = pageWidth - (margin * 2);
      const leftMargin = margin;
      const rightMargin = pageWidth - margin;

      const responsiveUnit = pageWidth / 100;
      const responsiveHeightUnit = pageHeight / 100;
      const getResponsiveWidth = (percent) => (contentWidth * percent) / 100;
      const getResponsiveX = (percent) => leftMargin + (contentWidth * percent) / 100;

      // Helper function to draw checkbox
      const drawCheckbox = (x, y, size = 8, checked = false) => {
        doc.rect(x, y, size, size).stroke();
        if (checked) {
          doc.moveTo(x + 1, y + size / 2)
             .lineTo(x + size / 2 - 1, y + size - 1)
             .lineTo(x + size - 1, y + 1)
             .stroke();
        }
      };

      // Helper function to draw underline
      const drawUnderline = (x, y, width) => {
        doc.moveTo(x, y).lineTo(x + width, y).stroke();
      };

      let currentY = margin + (responsiveHeightUnit * 2);

      // Header - Organization Name
      doc.fontSize(Math.max(14, responsiveUnit * 2.5))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('INDIAN MUSLIM ASSOCIATION JAMA-ATH LTD.', leftMargin, currentY, { 
           width: contentWidth,
           align: 'center'
         });

      currentY += (responsiveHeightUnit * 2);

      // Hong Kong
      doc.fontSize(Math.max(11, responsiveUnit * 2))
         .fillColor('#000000')
         .font('Helvetica')
         .text('Hong Kong', leftMargin, currentY, { 
           width: contentWidth,
           align: 'center'
         });

      currentY += (responsiveHeightUnit * 1.8);

      // Estd. 1979
      doc.fontSize(Math.max(9, responsiveUnit * 1.6))
         .fillColor('#666666')
         .font('Helvetica-Oblique')
         .text('Estd. 1979', leftMargin, currentY, { 
           width: contentWidth,
           align: 'center'
         });

      currentY += (responsiveHeightUnit * 3);

      // Receipt Title
      doc.fontSize(Math.max(12, responsiveUnit * 2.2))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('Donation Receipt', leftMargin, currentY, { 
           width: contentWidth,
           align: 'center'
         });

      currentY += (responsiveHeightUnit * 4);

      // Receipt No (using sequential receipt number)
      const receiptNoValue = await getNextReceiptNumber();
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text(`Receipt No: ${receiptNoValue}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Date
      let receiptDate = donation.date;
      if (!receiptDate && donation.createdAt) {
        receiptDate = new Date(donation.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
      if (!receiptDate) {
        receiptDate = new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica')
         .text(`Date: ${receiptDate}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Donor Name
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Donor Name: ${donation.donorName || 'N/A'}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Donor Type (Member/Non-Member)
      const donorType = donation.isMember ? 'Member' : 'Non-Member';
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Donor Type: ${donorType}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Member ID (if member)
      if (donation.isMember && donation.memberId) {
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Member ID: IMA/${donation.memberId}`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Donation Type
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Donation Type: ${donation.donationType || 'N/A'}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Amount
      const amountStr = donation.amount || 'HK$0';
      const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
      const formattedAmount = amountNum.toFixed(2);
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica-Bold')
         .text(`Amount: HK$${formattedAmount}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Payment Type (Cash/Online)
      const paymentType = donation.payment_type || 'online';
      const paymentTypeDisplay = paymentType === 'cash' ? 'Cash' : 'Online Payment';
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Payment Type: ${paymentTypeDisplay}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Payment Method
      const paymentMethod = donation.method || 'N/A';
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Payment Method: ${paymentMethod}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Receiver Name (if online payment)
      if (donation.payment_type === 'online' && donation.receiver_name) {
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Receiver Name: ${donation.receiver_name}`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Payment Screenshot (indicate if available)
      if (donation.screenshot) {
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Payment Proof: Available`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Notes
      if (donation.notes) {
        currentY += (responsiveHeightUnit * 1.5);
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Notes: ${donation.notes}`, leftMargin, currentY, { 
             width: contentWidth,
             align: 'left'
           });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Timestamps (if available)
      if (donation.createdAt) {
        const createdAt = new Date(donation.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        doc.fontSize(Math.max(8, responsiveUnit * 1.5))
           .fillColor('#666666')
           .font('Helvetica')
           .text(`Recorded: ${createdAt}`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2);
      }

      currentY += (responsiveHeightUnit * 4);

      // Thank you message
      doc.fontSize(Math.max(10, responsiveUnit * 1.9))
         .font('Helvetica-Bold')
         .fillColor('#2e7d32')
         .text('Thank you for your generous donation!', leftMargin, currentY, { 
           width: contentWidth,
           align: 'center'
         });

      currentY += (responsiveHeightUnit * 4);

      // Bottom section - On Behalf of
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica')
         .text('On Behalf of', leftMargin, currentY, { 
           width: contentWidth,
           align: 'right'
         });

      currentY += (responsiveHeightUnit * 2);

      doc.fontSize(Math.max(10, responsiveUnit * 2))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('Indian Muslim Association Jama-ath Ltd.', leftMargin, currentY, { 
           width: contentWidth,
           align: 'right'
         });

      doc.end();
    } catch (error) {
      console.error('Error in generateDonationReceiptPDF:', error);
      reject(error);
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
