import PDFDocument from 'pdfkit';
import { ensureConnection } from '../config/database.js';
import UserModel from '../models/User.js';
import InvoiceModel from '../models/Invoice.js';
import https from 'https';
import http from 'http';
import { getNextReceiptNumber } from './receiptCounter.js';

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
         .text('Payment Receipt', leftMargin, currentY, { 
           width: contentWidth,
           align: 'center'
         });

      currentY += (responsiveHeightUnit * 4);

      // Receipt No
      const receiptNoValue = await getNextReceiptNumber();
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text(`Receipt No: ${receiptNoValue}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Date
      const receiptDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .fillColor('#000000')
         .font('Helvetica')
         .text(`Date: ${receiptDate}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Member Name
      const memberName = member?.name || invoice?.memberName || 'N/A';
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Member Name: ${memberName}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Member ID
      const memberId = member?.id || invoice?.memberId || 'N/A';
      if (memberId !== 'N/A') {
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Member ID: IMA/${memberId}`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Invoice ID
      const invoiceId = invoice?.id || payment?.invoiceId || 'N/A';
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Invoice No: ${invoiceId}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Renewal Confirmation Year (extract year from invoice period if available)
      const periodStr = String(invoice?.period || '').trim();
      const yearMatch = periodStr.match(/\d{4}/);
      if (yearMatch) {
        const renewalYear = yearMatch[0];
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(`Renewal Confirmation Year: ${renewalYear}`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Amount
      const amountStr = invoice?.amount || payment?.amount || 'HK$0';
      const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
      const formattedAmount = amountNum.toFixed(2);
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica-Bold')
         .text(`Amount: HK$${formattedAmount}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Payment Method
      const paymentMethod = String(payment?.method || invoice?.method || '').trim();
      const paymentMethodDisplay = paymentMethod || 'N/A';
      doc.fontSize(Math.max(9, responsiveUnit * 1.8))
         .font('Helvetica')
         .text(`Payment Method: ${paymentMethodDisplay}`, leftMargin, currentY, { width: contentWidth });

      currentY += (responsiveHeightUnit * 2.5);

      // Receiver Name (if available)
      if (payment?.receiver_name || invoice?.receiver_name) {
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Receiver Name: ${payment?.receiver_name || invoice?.receiver_name}`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Payment Screenshot (indicate if available)
      if (payment?.screenshot || invoice?.screenshot || invoice?.payment_proof) {
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Payment Proof: Available`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      // Member Subscription Type
      if (member?.subscriptionType) {
        doc.fontSize(Math.max(9, responsiveUnit * 1.8))
           .font('Helvetica')
           .text(`Membership Type: ${member.subscriptionType}`, leftMargin, currentY, { width: contentWidth });
        currentY += (responsiveHeightUnit * 2.5);
      }

      currentY += (responsiveHeightUnit * 4);

      // Thank you message
      doc.fontSize(Math.max(10, responsiveUnit * 1.9))
         .font('Helvetica-Bold')
         .fillColor('#2e7d32')
         .text('Thank you for your payment!', leftMargin, currentY, { 
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
