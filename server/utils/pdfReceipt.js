import PDFDocument from 'pdfkit';
import { ensureConnection } from '../config/database.js';
import UserModel from '../models/User.js';
import InvoiceModel from '../models/Invoice.js';
import https from 'https';
import http from 'http';

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
          Title: 'Payment Receipt',
          Author: 'Subscription Manager HK',
          Subject: `Payment Receipt - ${invoice?.id || payment?.invoiceId || 'N/A'}`,
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
      // With 50pt margins: available width = 495.28, available height = 741.89
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2); // 495.28
      const contentHeight = pageHeight - (margin * 2); // 741.89
      const leftMargin = margin;
      const rightMargin = pageWidth - margin;

      // Helper function to check if we need a new page
      const checkPageBreak = (requiredHeight) => {
        if (doc.y + requiredHeight > pageHeight - margin) {
          doc.addPage();
          return true;
        }
        return false;
      };

      // Header
      doc.fontSize(24)
         .fillColor('#000000')
         .text('PAYMENT RECEIPT', { align: 'center', width: contentWidth });
      
      doc.moveDown(0.5);
      doc.fontSize(10)
         .fillColor('#666666')
         .text('Subscription Manager HK', { align: 'center', width: contentWidth });
      
      doc.moveDown(1);

      // Receipt Details Box - responsive to content width
      const receiptBoxY = doc.y;
      const receiptBoxHeight = 120;
      checkPageBreak(receiptBoxHeight + 20);
      
      doc.rect(leftMargin, doc.y, contentWidth, receiptBoxHeight)
         .strokeColor('#000000')
         .lineWidth(2)
         .stroke();

      // Calculate column positions (responsive to content width)
      const receiptBoxCurrentY = doc.y;
      const col1X = leftMargin + 10;
      const col2X = leftMargin + (contentWidth / 2) + 10;
      const colWidth = (contentWidth / 2) - 20;

      // Left Column - Receipt Info
      doc.fontSize(12)
         .fillColor('#000000')
         .text('Receipt Number:', col1X, receiptBoxCurrentY + 15, { width: colWidth });
      doc.fontSize(10)
         .fillColor('#333333')
         .text(payment?.id || payment?.reference || `REC-${Date.now()}`, col1X, receiptBoxCurrentY + 30, { width: colWidth });
      
      doc.fontSize(12)
         .fillColor('#000000')
         .text('Date:', col1X, receiptBoxCurrentY + 50, { width: colWidth });
      doc.fontSize(10)
         .fillColor('#333333')
         .text(new Date().toLocaleDateString('en-GB', {
           day: '2-digit',
           month: 'short',
           year: 'numeric'
         }), col1X, receiptBoxCurrentY + 65, { width: colWidth });

      doc.fontSize(12)
         .fillColor('#000000')
         .text('Payment Method:', col1X, receiptBoxCurrentY + 85, { width: colWidth });
      doc.fontSize(10)
         .fillColor('#333333')
         .text(payment?.method || invoice?.method || 'N/A', col1X, receiptBoxCurrentY + 100, { width: colWidth });

      // Right Column - Member Info
      doc.fontSize(12)
         .fillColor('#000000')
         .text('Member ID:', col2X, receiptBoxCurrentY + 15, { width: colWidth });
      doc.fontSize(10)
         .fillColor('#333333')
         .text(member?.id || 'N/A', col2X, receiptBoxCurrentY + 30, { width: colWidth });

      doc.fontSize(12)
         .fillColor('#000000')
         .text('Member Name:', col2X, receiptBoxCurrentY + 50, { width: colWidth });
      doc.fontSize(10)
         .fillColor('#333333')
         .text(member?.name || invoice?.memberName || 'N/A', col2X, receiptBoxCurrentY + 65, { width: colWidth });

      doc.fontSize(12)
         .fillColor('#000000')
         .text('Email:', col2X, receiptBoxCurrentY + 85, { width: colWidth });
      doc.fontSize(10)
         .fillColor('#333333')
         .text(member?.email || invoice?.memberEmail || 'N/A', col2X, receiptBoxCurrentY + 100, { width: colWidth });
      
      // Move cursor to after the receipt box
      doc.y = receiptBoxCurrentY + receiptBoxHeight + 10;

      doc.moveDown(1.5);

      // Invoice Details Section
      checkPageBreak(100);
      doc.fontSize(16)
         .fillColor('#000000')
         .text('Invoice Details', { underline: true, width: contentWidth });
      
      doc.moveDown(0.5);

      const invoiceTableY = doc.y;
      const tableRowHeight = 25;
      const tableCol1X = leftMargin + 10;
      const tableCol2X = leftMargin + (contentWidth * 0.4);
      const tableCol3X = leftMargin + (contentWidth * 0.75);
      const tableWidth = contentWidth;

      // Table Header
      doc.rect(leftMargin, invoiceTableY, tableWidth, tableRowHeight)
         .fillColor('#f5f5f5')
         .fill();
      
      doc.fontSize(10)
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('Description', tableCol1X, invoiceTableY + 8, { width: tableCol2X - tableCol1X - 5 });
      doc.text('Invoice ID', tableCol2X, invoiceTableY + 8, { width: tableCol3X - tableCol2X - 5 });
      doc.text('Amount', tableCol3X, invoiceTableY + 8, { width: rightMargin - tableCol3X - 5, align: 'right' });

      // Table Border
      doc.rect(leftMargin, invoiceTableY, tableWidth, tableRowHeight)
         .fillColor('#000000')
         .stroke();

      // Table Row
      const rowY = invoiceTableY + tableRowHeight;
      doc.rect(leftMargin, rowY, tableWidth, tableRowHeight)
         .fillColor('#ffffff')
         .fill();
      
      doc.fontSize(10)
         .fillColor('#333333')
         .font('Helvetica')
         .text(invoice?.period || payment?.period || 'Subscription Payment', tableCol1X, rowY + 8, { width: tableCol2X - tableCol1X - 5 });
      doc.text(invoice?.id || payment?.invoiceId || 'N/A', tableCol2X, rowY + 8, { width: tableCol3X - tableCol2X - 5 });
      doc.text(invoice?.amount || payment?.amount || '$0', tableCol3X, rowY + 8, { width: rightMargin - tableCol3X - 5, align: 'right' });

      // Table Border
      doc.rect(leftMargin, rowY, tableWidth, tableRowHeight)
         .fillColor('#000000')
         .stroke();
      
      doc.y = rowY + tableRowHeight + 10;

      doc.moveDown(1);

      // Payment Summary
      const summaryBoxHeight = 80;
      checkPageBreak(summaryBoxHeight + 20);
      
      const summaryY = doc.y;
      doc.fontSize(16)
         .fillColor('#000000')
         .text('Payment Summary', { underline: true, width: contentWidth });
      
      doc.moveDown(0.5);

      const summaryBoxY = doc.y;
      doc.rect(leftMargin, summaryBoxY, contentWidth, summaryBoxHeight)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();

      const summaryLeftX = leftMargin + 10;
      const summaryRightX = rightMargin - 10;
      const summaryRightWidth = 150;

      doc.fontSize(12)
         .fillColor('#000000')
         .text('Subtotal:', summaryLeftX, summaryBoxY + 15, { width: contentWidth - summaryRightWidth - 20 });
      doc.fontSize(10)
         .fillColor('#333333')
         .text(invoice?.amount || payment?.amount || '$0', summaryRightX - summaryRightWidth, summaryBoxY + 15, { width: summaryRightWidth, align: 'right' });

      doc.fontSize(12)
         .fillColor('#000000')
         .text('Payment Status:', summaryLeftX, summaryBoxY + 40, { width: contentWidth - summaryRightWidth - 20 });
      doc.fontSize(10)
         .fillColor('#4caf50')
         .font('Helvetica-Bold')
         .text('PAID', summaryRightX - summaryRightWidth, summaryBoxY + 40, { width: summaryRightWidth, align: 'right' });

      doc.fontSize(14)
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('Total Paid:', summaryLeftX, summaryBoxY + 60, { width: contentWidth - summaryRightWidth - 20 });
      doc.fontSize(14)
         .fillColor('#4caf50')
         .font('Helvetica-Bold')
         .text(invoice?.amount || payment?.amount || '$0', summaryRightX - summaryRightWidth, summaryBoxY + 60, { width: summaryRightWidth, align: 'right' });
      
      doc.y = summaryBoxY + summaryBoxHeight + 10;

      doc.moveDown(1.5);

      // Reference/Notes if available
      if (payment?.reference) {
        checkPageBreak(30);
        doc.fontSize(9)
           .fillColor('#666666')
           .text(`Reference: ${payment.reference}`, { align: 'center', width: contentWidth });
        doc.moveDown(0.5);
      }

      // Payment Proof/Screenshot Section
      const screenshotUrl = payment?.screenshot || invoice?.screenshot || invoice?.payment_proof;
      if (screenshotUrl) {
        // Fetch image asynchronously before adding to PDF
        try {
          const imageBuffer = await fetchImageFromUrl(screenshotUrl);
          
          if (imageBuffer) {
            // Calculate responsive image dimensions
            const maxImageWidth = contentWidth;
            const maxImageHeight = 300;
            
            checkPageBreak(maxImageHeight + 50);
            
            doc.moveDown(1.5);
            doc.fontSize(16)
               .fillColor('#000000')
               .text('Payment Proof', { underline: true, width: contentWidth });
            
            doc.moveDown(0.5);
            
            const imageY = doc.y;
            
            // Add image to PDF - centered and responsive
            // PDFKit will automatically scale the image to fit within the specified dimensions
            doc.image(imageBuffer, leftMargin, imageY, {
              fit: [maxImageWidth, maxImageHeight],
              align: 'center',
            });
            
            // Move down after image (PDFKit handles the positioning automatically)
            // We'll use a safe estimate based on max height
            doc.y = imageY + maxImageHeight + 20;
          } else {
            checkPageBreak(50);
            doc.moveDown(1.5);
            doc.fontSize(16)
               .fillColor('#000000')
               .text('Payment Proof', { underline: true, width: contentWidth });
            doc.moveDown(0.5);
            doc.fontSize(10)
               .fillColor('#999999')
               .text('Payment proof image could not be loaded', { align: 'center', width: contentWidth });
            doc.moveDown(0.5);
          }
        } catch (imageError) {
          console.error('Error adding payment proof image to PDF:', imageError);
          checkPageBreak(50);
          doc.moveDown(1.5);
          doc.fontSize(16)
             .fillColor('#000000')
             .text('Payment Proof', { underline: true, width: contentWidth });
          doc.moveDown(0.5);
          doc.fontSize(10)
             .fillColor('#999999')
             .text('Payment proof image unavailable', { align: 'center', width: contentWidth });
          doc.moveDown(0.5);
        }
      }

      // Footer - always at bottom of last page
      const footerY = Math.max(doc.y + 30, pageHeight - margin - 50);
      doc.y = footerY;
      
      doc.fontSize(9)
         .fillColor('#666666')
         .text('Thank you for your payment!', { align: 'center', width: contentWidth });
      
      doc.moveDown(0.5);
      doc.fontSize(8)
         .fillColor('#999999')
         .text('This is an automated receipt. Please keep this for your records.', { align: 'center', width: contentWidth });
      
      doc.moveDown(0.5);
      doc.fontSize(8)
         .fillColor('#999999')
         .text('For any queries, please contact: finance@subscriptionhk.org', { align: 'center', width: contentWidth });

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

