import PDFDocument from 'pdfkit';
import { ensureConnection } from '../config/database.js';
import UserModel from '../models/User.js';
import InvoiceModel from '../models/Invoice.js';
import https from 'https';
import http from 'http';

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
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePaymentReceiptPDF(member, invoice, payment) {
  return new Promise(async (resolve, reject) => {
    try {
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

      // Top border (red line)
      doc.moveTo(leftMargin, margin)
         .lineTo(rightMargin, margin)
         .strokeColor('#FF0000')
         .lineWidth(2)
         .stroke();

      // Header Section - responsive positioning
      const headerY = margin + (responsiveHeightUnit * 2); // ~2% from top
      
      // Logo (circular area on left) - responsive size (7.5% of page width)
      const logoX = leftMargin;
      const logoY = headerY;
      const logoSize = responsiveUnit * 7.5; // ~45 points, scales with page
      doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2)
         .strokeColor('#000000')
         .lineWidth(1.5)
         .stroke();
      
      // Organization name on the right of logo - responsive positioning
      const orgNameX = logoX + logoSize + (responsiveUnit * 2); // 2% spacing
      const orgNameY = headerY + 2;
      const orgNameWidth = contentWidth - (logoSize + responsiveUnit * 2);
      doc.fontSize(Math.max(11, responsiveUnit * 2.2)) // Responsive font size
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('INDIAN MUSLIM ASSOCIATION JAMA-ATH LTD.', orgNameX, orgNameY, { 
           width: orgNameWidth,
           lineGap: 1
         });
      
      // Hong Kong and Estd.1979 - responsive positioning
      const locationY = orgNameY + (responsiveHeightUnit * 2.1); // ~2.1% spacing
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('Hong Kong', orgNameX, locationY, { width: getResponsiveWidth(40) });
      
      doc.fontSize(Math.max(7, responsiveUnit * 1.4))
         .fillColor('#666666')
         .font('Helvetica-Oblique')
         .text('Estd.1979', orgNameX, locationY + (responsiveHeightUnit * 1.3), { width: getResponsiveWidth(40) });

      // Receipt No (top right, in red) - responsive positioning
      const receiptNoValue = payment?.id || payment?.reference || invoice?.id || `REC-${Date.now()}`;
      const receiptNoWidth = getResponsiveWidth(13.5); // ~13.5% of content width
      const receiptNoX = rightMargin - receiptNoWidth;
      const receiptNoY = headerY + 2;
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#FF0000')
         .font('Helvetica-Bold')
         .text(`No. ${receiptNoValue}`, receiptNoX, receiptNoY, { width: receiptNoWidth, align: 'right' });

      // Date field (left of receipt number) - responsive positioning
      const dateValue = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const dateLabelWidth = getResponsiveWidth(9); // ~9% of content width
      const dateX = receiptNoX - getResponsiveWidth(18.5); // Positioned 18.5% from right
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('DATE:', dateX, receiptNoY, { width: dateLabelWidth });
      
      // Date underlines - responsive sizing
      const dateUnderlineY = receiptNoY + (responsiveHeightUnit * 1.3);
      const dateParts = dateValue.split('/');
      const dateUnderlineWidth = getResponsiveWidth(3.6); // Day/Month width
      const dateYearUnderlineWidth = getResponsiveWidth(5); // Year width
      const dateSpacing = getResponsiveWidth(4.5); // Spacing between date parts
      
      drawUnderline(dateX + dateLabelWidth + 2, dateUnderlineY, dateUnderlineWidth);
      drawUnderline(dateX + dateLabelWidth + 2 + dateUnderlineWidth + dateSpacing, dateUnderlineY, dateUnderlineWidth);
      drawUnderline(dateX + dateLabelWidth + 2 + (dateUnderlineWidth * 2) + (dateSpacing * 2), dateUnderlineY, dateYearUnderlineWidth);
      
      // Fill in date values
      doc.fontSize(Math.max(7, responsiveUnit * 1.4))
         .fillColor('#000000')
         .font('Helvetica')
         .text(dateParts[0] || '', dateX + dateLabelWidth + 4, receiptNoY + 9, { width: dateUnderlineWidth - 2 });
      doc.text(dateParts[1] || '', dateX + dateLabelWidth + 4 + dateUnderlineWidth + dateSpacing, receiptNoY + 9, { width: dateUnderlineWidth - 2 });
      doc.text(dateParts[2] || '', dateX + dateLabelWidth + 4 + (dateUnderlineWidth * 2) + (dateSpacing * 2), receiptNoY + 9, { width: dateYearUnderlineWidth - 2 });

      // OFFICIAL RECEIPT box (centered, thick black border) - responsive sizing
      const receiptBoxY = locationY + (responsiveHeightUnit * 3.3); // ~3.3% spacing
      const receiptBoxWidth = getResponsiveWidth(36); // ~36% of content width
      const receiptBoxHeight = responsiveHeightUnit * 3.3; // ~3.3% of page height
      const receiptBoxX = (pageWidth - receiptBoxWidth) / 2; // Centered
      
      doc.rect(receiptBoxX, receiptBoxY, receiptBoxWidth, receiptBoxHeight)
         .strokeColor('#000000')
         .lineWidth(2)
         .stroke();
      
      doc.fontSize(Math.max(11, responsiveUnit * 2.2))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('OFFICIAL RECEIPT', receiptBoxX, receiptBoxY + (receiptBoxHeight * 0.25), { 
           width: receiptBoxWidth,
           align: 'center'
         });

      // Main content starts here - responsive spacing
      let currentY = receiptBoxY + receiptBoxHeight + (responsiveHeightUnit * 3);

      // "GRACEFULLY RECEIVED from _________"
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica')
         .text('GRACEFULLY RECEIVED from', leftMargin, currentY, { width: contentWidth });
      
      currentY += (responsiveHeightUnit * 1.7); // Responsive spacing
      const memberName = member?.name || invoice?.memberName || '';
      const nameIndent = getResponsiveWidth(5); // 5% indent
      const nameUnderlineWidth = contentWidth - nameIndent;
      drawUnderline(leftMargin + nameIndent, currentY, nameUnderlineWidth);
      if (memberName) {
        doc.fontSize(Math.max(8, responsiveUnit * 1.6))
           .fillColor('#000000')
           .font('Helvetica')
           .text(memberName, leftMargin + nameIndent + 2, currentY - 9, { width: nameUnderlineWidth - 4 });
      }
      
      currentY += (responsiveHeightUnit * 2.6);

      // "the sum of HK Dollars_________"
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica')
         .text('the sum of HK Dollars', leftMargin, currentY, { width: contentWidth });
      
      currentY += (responsiveHeightUnit * 1.7);
      // Extract numeric amount and convert to words
      const amountStr = invoice?.amount || payment?.amount || 'HK$0';
      const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
      let amountInWords = '';
      try {
        if (amountNum > 0 && !isNaN(amountNum) && isFinite(amountNum)) {
          amountInWords = numberToWords(Math.floor(amountNum)) + ' Only';
        }
      } catch (wordsError) {
        console.error('Error converting amount to words in PDF:', wordsError);
        amountInWords = '';
      }
      
      const amountWordsWidth = contentWidth - nameIndent;
      drawUnderline(leftMargin + nameIndent, currentY, amountWordsWidth);
      if (amountInWords) {
        doc.fontSize(Math.max(8, responsiveUnit * 1.6))
           .fillColor('#000000')
           .font('Helvetica')
           .text(amountInWords, leftMargin + nameIndent + 2, currentY - 9, { width: amountWordsWidth - 4 });
      }
      
      // Amount box (large box on right with HKD label on left) - responsive sizing
      const amountBoxWidth = getResponsiveWidth(22); // ~22% of content width
      const amountBoxHeight = responsiveHeightUnit * 4.5; // ~4.5% of page height
      const amountBoxX = rightMargin - amountBoxWidth;
      const amountBoxY = currentY - (responsiveHeightUnit * 2.1);
      
      // HKD label box (small box on left) - responsive sizing
      const hkdBoxWidth = getResponsiveWidth(6.5); // ~6.5% of content width
      const hkdBoxHeight = amountBoxHeight;
      doc.rect(amountBoxX - hkdBoxWidth, amountBoxY, hkdBoxWidth, hkdBoxHeight)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();
      doc.fontSize(Math.max(7, responsiveUnit * 1.4))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('HKD', amountBoxX - hkdBoxWidth + 2, amountBoxY + (hkdBoxHeight * 0.37), { width: hkdBoxWidth - 4, align: 'center' });
      
      // Amount box (large box)
      doc.rect(amountBoxX, amountBoxY, amountBoxWidth, amountBoxHeight)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();
      
      // Format amount for display
      const formattedAmount = amountNum.toFixed(2);
      doc.fontSize(Math.max(9, responsiveUnit * 1.85))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text(formattedAmount, amountBoxX + 5, amountBoxY + (amountBoxHeight * 0.32), { 
           width: amountBoxWidth - 10,
           align: 'right'
         });
      
      currentY += (responsiveHeightUnit * 4.2);

      // "For the account of:"
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('For the account of:', leftMargin, currentY, { width: contentWidth });
      
      currentY += (responsiveHeightUnit * 2.1);

      // Checkbox options - responsive sizing
      const checkboxSize = Math.max(6, responsiveUnit * 1.2); // Responsive checkbox size
      const checkboxSpacing = responsiveHeightUnit * 2.6; // Responsive spacing
      
      // IMA Annual Membership (Year _______) - Improved detection logic
      const checkbox1X = leftMargin;
      const checkbox1Y = currentY;
      
      // Check if it's an annual membership invoice
      // Criteria: invoice has a year period OR member subscription type is Annual Member
      const hasYearPeriod = invoice?.period && invoice.period.match(/\d{4}/);
      const isAnnualSubscription = member?.subscriptionType === 'Annual Member' || 
                                   invoice?.subscriptionType === 'Annual Member';
      const isAnnualMember = (hasYearPeriod || isAnnualSubscription) && 
                            member?.subscriptionType !== 'Lifetime Membership' &&
                            member?.subscriptionType !== 'Lifetime Janaza Fund Member';
      
      // Check if it's a donation
      const isDonation = payment?.type === 'donation' || 
                        invoice?.type === 'donation' ||
                        payment?.category === 'donation' ||
                        invoice?.category === 'donation';
      
      // Annual Membership checkbox: checked if it's an annual membership and not a donation
      const shouldCheckAnnual = isAnnualMember && !isDonation;
      
      // Debug logging for account type
      console.log('PDF Receipt - Account Type Detection:', {
        hasYearPeriod,
        isAnnualSubscription,
        memberSubscriptionType: member?.subscriptionType,
        invoiceSubscriptionType: invoice?.subscriptionType,
        isAnnualMember,
        isDonation,
        shouldCheckAnnual,
        shouldCheckDonation: isDonation,
        shouldCheckOthers: !isAnnualMember && !isDonation
      });
      
      drawCheckbox(checkbox1X, checkbox1Y, checkboxSize, shouldCheckAnnual);
      const checkboxTextOffset = checkboxSize + (responsiveUnit * 1.8); // Responsive text offset
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('IMA Annual Membership (Year', checkbox1X + checkboxTextOffset, checkbox1Y - 1.5, { width: getResponsiveWidth(35) });
      
      const yearValue = invoice?.period ? (invoice.period.match(/\d{4}/)?.[0] || '') : '';
      const yearUnderlineX = checkbox1X + checkboxTextOffset + getResponsiveWidth(35) + 2;
      const yearUnderlineY = checkbox1Y + (checkboxSize * 0.8);
      const yearUnderlineWidth = getResponsiveWidth(9);
      drawUnderline(yearUnderlineX, yearUnderlineY, yearUnderlineWidth);
      if (yearValue) {
        doc.fontSize(Math.max(7, responsiveUnit * 1.4))
           .fillColor('#000000')
           .font('Helvetica')
           .text(yearValue, yearUnderlineX + 2, checkbox1Y + 2.5, { width: yearUnderlineWidth - 2 });
      }
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text(')', yearUnderlineX + yearUnderlineWidth + 2, checkbox1Y - 1.5, { width: 10 });
      
      currentY += checkboxSpacing;

      // Donation checkbox
      const checkbox2X = leftMargin;
      const checkbox2Y = currentY;
      drawCheckbox(checkbox2X, checkbox2Y, checkboxSize, isDonation);
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('Donation', checkbox2X + checkboxTextOffset, checkbox2Y - 1.5, { width: getResponsiveWidth(20) });
      
      currentY += checkboxSpacing;

      // Others checkbox
      const checkbox3X = leftMargin;
      const checkbox3Y = currentY;
      const isOther = !isAnnualMember && !isDonation;
      drawCheckbox(checkbox3X, checkbox3Y, checkboxSize, isOther);
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('Others:', checkbox3X + checkboxTextOffset, checkbox3Y - 1.5, { width: getResponsiveWidth(10) });
      
      const othersUnderlineX = checkbox3X + checkboxTextOffset + getResponsiveWidth(10) + 2;
      const othersUnderlineY = checkbox3Y + (checkboxSize * 0.8);
      const othersUnderlineWidth = getResponsiveWidth(40);
      drawUnderline(othersUnderlineX, othersUnderlineY, othersUnderlineWidth);
      if (isOther && invoice?.description) {
        doc.fontSize(Math.max(7, responsiveUnit * 1.4))
           .fillColor('#000000')
           .font('Helvetica')
           .text(invoice.description, othersUnderlineX + 2, checkbox3Y + 2.5, { width: othersUnderlineWidth - 2 });
      }
      
      currentY += checkboxSpacing + (responsiveHeightUnit * 0.95);

      // "Mode of Payment"
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('Mode of Payment', leftMargin, currentY, { width: contentWidth });
      
      currentY += (responsiveHeightUnit * 2.1);

      // Payment method checkboxes - improved detection logic
      const paymentMethod = String(payment?.method || invoice?.method || '').trim();
      const paymentMethodLower = paymentMethod.toLowerCase();
      
      // Cash: Check if method is cash, or paid to admin directly
      const isCash = paymentMethodLower === 'cash' ||
                    paymentMethodLower.includes('cash') ||
                    payment?.paidToAdmin === true ||
                    payment?.paidToAdminName ||
                    invoice?.paidToAdmin === true;
      
      // Cheque: Check if method is cheque/check
      const isCheque = paymentMethodLower === 'cheque' ||
                      paymentMethodLower === 'check' ||
                      paymentMethodLower.includes('cheque') ||
                      paymentMethodLower.includes('check');
      
      // Bank Transfer: Check for bank transfer, FPS, Alipay, PayMe, or any online payment
      // Priority: If it's not cash and not cheque, and has a method, it's likely bank transfer
      const isBankTransfer = !isCash && !isCheque && paymentMethodLower !== '' &&
                            (paymentMethodLower === 'bank transfer' ||
                            paymentMethodLower === 'bank deposit' ||
                            paymentMethodLower === 'fps' ||
                            paymentMethodLower === 'alipay' ||
                            paymentMethodLower === 'payme' ||
                            paymentMethodLower === 'credit card' ||
                            paymentMethodLower.includes('bank') ||
                            paymentMethodLower.includes('transfer') ||
                            paymentMethodLower.includes('fps') ||
                            paymentMethodLower.includes('alipay') ||
                            paymentMethodLower.includes('payme') ||
                            paymentMethodLower.includes('online'));
      
      // Debug logging
      console.log('PDF Receipt - Payment Method Detection:', {
        paymentMethod,
        paymentMethodLower,
        isCash,
        isCheque,
        isBankTransfer,
        paidToAdmin: payment?.paidToAdmin,
        paidToAdminName: payment?.paidToAdminName
      });

      // Cash - responsive positioning
      const cashCheckboxX = leftMargin;
      const cashCheckboxY = currentY;
      drawCheckbox(cashCheckboxX, cashCheckboxY, checkboxSize, isCash);
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('Cash', cashCheckboxX + checkboxTextOffset, cashCheckboxY - 1.5, { width: getResponsiveWidth(10) });

      // Cheque - responsive positioning
      const chequeCheckboxX = leftMargin + getResponsiveWidth(18);
      const chequeCheckboxY = currentY;
      drawCheckbox(chequeCheckboxX, chequeCheckboxY, checkboxSize, isCheque);
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('Cheque', chequeCheckboxX + checkboxTextOffset, chequeCheckboxY - 1.5, { width: getResponsiveWidth(10) });

      // Bank Transfer - responsive positioning
      const transferCheckboxX = leftMargin + getResponsiveWidth(36);
      const transferCheckboxY = currentY;
      drawCheckbox(transferCheckboxX, transferCheckboxY, checkboxSize, isBankTransfer);
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('Bank Transfer', transferCheckboxX + checkboxTextOffset, transferCheckboxY - 1.5, { width: getResponsiveWidth(20) });
      
      currentY += checkboxSpacing + (responsiveHeightUnit * 1.8);

      // Bottom border (red line) - responsive positioning (7% from bottom)
      const bottomBorderY = pageHeight - margin - (responsiveHeightUnit * 7);
      doc.moveTo(leftMargin, bottomBorderY)
         .lineTo(rightMargin, bottomBorderY)
         .strokeColor('#FF0000')
         .lineWidth(2)
         .stroke();

      // "On Behalf of" section - responsive positioning
      const behalfY = bottomBorderY - (responsiveHeightUnit * 5.7);
      const behalfWidth = getResponsiveWidth(46);
      const behalfX = rightMargin - behalfWidth;
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica')
         .text('On Behalf of', behalfX, behalfY, { width: behalfWidth * 0.4, align: 'right' });
      
      doc.fontSize(Math.max(8, responsiveUnit * 1.6))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('Indian Muslim Association Jama-ath Ltd.', behalfX, behalfY + (responsiveHeightUnit * 1.3), { 
           width: behalfWidth,
           align: 'right'
         });

      // Signature line - responsive sizing
      const signatureY = behalfY + (responsiveHeightUnit * 3.8);
      const signatureWidth = getResponsiveWidth(24);
      const signatureX = rightMargin - signatureWidth;
      drawUnderline(signatureX, signatureY, signatureWidth);
      doc.fontSize(Math.max(7, responsiveUnit * 1.4))
         .fillColor('#666666')
         .font('Helvetica-Oblique')
         .text('(Signature)', signatureX, signatureY + 4, { width: signatureWidth, align: 'center' });

      // QR code placeholder (bottom right) - responsive sizing
      const qrSize = responsiveUnit * 3; // ~3% of page width
      const qrX = rightMargin - qrSize - (responsiveUnit * 1.3);
      const qrY = bottomBorderY - qrSize - (responsiveUnit * 1.3);
      // Draw QR code placeholder (bracket shape with horizontal lines)
      doc.moveTo(qrX, qrY)
         .lineTo(qrX + qrSize, qrY)
         .lineTo(qrX + qrSize, qrY + qrSize)
         .lineTo(qrX, qrY + qrSize)
         .lineTo(qrX, qrY)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
      
      // Draw three horizontal lines inside (QR code pattern)
      const lineSpacing = qrSize / 4;
      for (let i = 1; i < 4; i++) {
        doc.moveTo(qrX + 2, qrY + lineSpacing * i)
           .lineTo(qrX + qrSize - 2, qrY + lineSpacing * i)
           .strokeColor('#000000')
           .lineWidth(0.3)
           .stroke();
      }

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
