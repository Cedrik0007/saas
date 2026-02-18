import express from "express";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import DonationModel from "../models/Donation.js";
import PaymentModel from "../models/Payment.js";
import UserModel from "../models/User.js";
import { resolveMember } from "../utils/resolveRefs.js";
import { generatePaymentReceiptPDF, generateDonationReceiptPDF } from "../utils/pdfReceipt.js";

const router = express.Router();

const shortTokenRegex = /^[a-f0-9]{8}$/i;

const isTokenExpired = (tokenExpiresAt) => tokenExpiresAt instanceof Date && tokenExpiresAt.getTime() < Date.now();

const sendPdf = (res, filename, pdfBuffer, disposition = "inline") => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Length", pdfBuffer.length);
  return res.send(pdfBuffer);
};

const resolveDonationMember = async (donationDoc) => {
  if (!donationDoc?.isMember || !donationDoc?.memberId) return null;
  return UserModel.findOne({
    $or: [
      { id: donationDoc.memberId },
      { "previousDisplayIds.id": donationDoc.memberId },
    ],
  }).lean();
};

const resolveReceiptByToken = async (token) => {
  const normalizedToken = String(token || "").trim().toLowerCase();
  if (!shortTokenRegex.test(normalizedToken)) {
    return null;
  }

  const invoice = await InvoiceModel.findOne({ shortToken: normalizedToken });
  if (invoice) {
    if (invoice.tokenExpiresAt && isTokenExpired(invoice.tokenExpiresAt)) {
      const error = new Error("Receipt link has expired");
      error.status = 410;
      throw error;
    }

    const isPaid = invoice.status === "Paid" || invoice.status === "Completed";
    const receiptNo = String(invoice.receiptNumber || "").trim();
    if (!isPaid || !receiptNo || !/^\d+$/.test(receiptNo)) {
      return null;
    }

    return {
      type: "invoice",
      token: normalizedToken,
      record: invoice,
      title: `Invoice #${invoice.id || invoice._id}`,
      amount: invoice.amount || "N/A",
    };
  }

  const donation = await DonationModel.findOne({ shortToken: normalizedToken });
  if (donation) {
    if (donation.tokenExpiresAt && isTokenExpired(donation.tokenExpiresAt)) {
      const error = new Error("Receipt link has expired");
      error.status = 410;
      throw error;
    }

    return {
      type: "donation",
      token: normalizedToken,
      record: donation,
      title: `Donation Receipt`,
      amount: donation.amount || "N/A",
      donorName: donation.donorName || "N/A",
    };
  }

  return null;
};

const generateReceiptPdfByResolvedRecord = async (resolvedRecord) => {
  if (!resolvedRecord) return null;

  if (resolvedRecord.type === "invoice") {
    const invoice = resolvedRecord.record;
    const member = await resolveMember(invoice.memberRef || invoice.memberNo || invoice.memberId);
    if (!member) return null;

    const payment = await PaymentModel.findOne({
      invoiceId: { $in: [invoice.id, invoice._id?.toString()] },
    }).sort({ createdAt: -1 });

    const paymentData = payment
      ? {
        ...payment.toObject(),
        screenshot: payment.screenshot || invoice.screenshot || invoice.payment_proof || null,
      }
      : {
        invoiceId: invoice.id,
        amount: invoice.amount,
        method: invoice.method || "Payment",
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        reference: invoice.reference || invoice.id,
        screenshot: invoice.screenshot || invoice.payment_proof || null,
      };

    const memberPayload = {
      ...(typeof member?.toObject === "function" ? member.toObject() : member),
      id: typeof member?.get === "function" ? member.get("id") : member?.id,
      subscriptionType: member?.subscriptionType,
    };
    const invoicePayload = {
      ...(typeof invoice?.toObject === "function" ? invoice.toObject() : invoice),
    };

    const pdfBuffer = await generatePaymentReceiptPDF(memberPayload, invoicePayload, paymentData, invoice.receiptNumber);
    return {
      filename: `Receipt_${invoice.id || invoice._id}.pdf`,
      pdfBuffer,
    };
  }

  if (resolvedRecord.type === "donation") {
    const donation = resolvedRecord.record;
    const donationData = donation.toObject ? donation.toObject() : donation;
    const member = await resolveDonationMember(donationData);
    const pdfBuffer = await generateDonationReceiptPDF(donationData, member);
    return {
      filename: `Donation_Receipt_${donationData._id || donationData.id}.pdf`,
      pdfBuffer,
    };
  }

  return null;
};

const renderOptionsPage = (resolvedRecord, requestBaseUrl) => {
  const viewUrl = `${requestBaseUrl}/r/${resolvedRecord.token}/view`;
  const downloadUrl = `${requestBaseUrl}/r/${resolvedRecord.token}/download`;
  const secondaryInfo = resolvedRecord.type === "invoice"
    ? `<strong>Invoice:</strong> ${resolvedRecord.title}<br><strong>Amount:</strong> ${resolvedRecord.amount}`
    : `<strong>Donor:</strong> ${resolvedRecord.donorName}<br><strong>Amount:</strong> ${resolvedRecord.amount}`;

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Receipt</title>
    
      <style>
        .receipt-body {
          margin: 0;
          padding: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #eef2ff, #f8fafc);
          font-family: "Segoe UI", Arial, sans-serif;
        }
    
        .receipt-wrapper {
          width: 100%;
          max-width: 460px;
          padding: 24px;
        }
    
        .receipt-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          border-radius: 18px;
          padding: 32px;
          text-align: center;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.6);
        }
    
        .receipt-title {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 6px;
        }
    
        .receipt-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 28px;
        }
    
        .receipt-actions {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
    
        .receipt-btn {
          text-decoration: none;
          padding: 14px 18px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.25s ease;
          display: inline-block;
        }
    
        .receipt-btn-view {
          background: #10b981;
          color: #ffffff;
        }
    
        .receipt-btn-view:hover {
          background: #059669;
          transform: translateY(-2px);
        }
    
        .receipt-btn-download {
          background: #2563eb;
          color: #ffffff;
        }
    
        .receipt-btn-download:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
        }
    
        .receipt-meta {
          margin-top: 24px;
          padding: 14px;
          border-radius: 10px;
          background: #f3f4f6;
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
        }
    
        @media (max-width: 480px) {
          .receipt-card {
            padding: 24px;
          }
        }
      </style>
    </head>
    
    <body class="receipt-body">
      <div class="receipt-wrapper">
        <div class="receipt-card">
          <div class="receipt-title">Receipt</div>
          <div class="receipt-subtitle">
            Choose how you would like to access your receipt
          </div>
    
          <div class="receipt-actions">
            <a class="receipt-btn receipt-btn-view"
               href="${viewUrl}"
               target="_blank"
               rel="noopener noreferrer">
               View PDF
            </a>
    
            <a class="receipt-btn receipt-btn-download"
               href="${downloadUrl}">
               Download PDF
            </a>
          </div>
    
          <div class="receipt-meta">
            ${secondaryInfo}
          </div>
        </div>
      </div>
    </body>
    </html>`;
    
    
};

router.get("/r/:token", async (req, res) => {
  try {
    await ensureConnection();
    const resolvedRecord = await resolveReceiptByToken(req.params.token);
    if (!resolvedRecord) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const protocol = req.get("X-Forwarded-Proto") || req.protocol || "https";
    const host = req.get("host");
    const requestBaseUrl = `${protocol}://${host}`;
    return res.send(renderOptionsPage(resolvedRecord, requestBaseUrl));
  } catch (error) {
    console.error("Error resolving short receipt link:", error);
    const status = error.status || 500;
    const message = status === 410 ? "Receipt link has expired" : "Failed to load receipt";
    return res.status(status).json({ error: message });
  }
});

router.get("/r/:token/view", async (req, res) => {
  try {
    await ensureConnection();
    const resolvedRecord = await resolveReceiptByToken(req.params.token);
    if (!resolvedRecord) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const generated = await generateReceiptPdfByResolvedRecord(resolvedRecord);
    if (!generated?.pdfBuffer) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    return sendPdf(res, generated.filename, generated.pdfBuffer, "inline");
  } catch (error) {
    console.error("Error viewing short receipt link:", error);
    const status = error.status || 500;
    const message = status === 410 ? "Receipt link has expired" : "Failed to load receipt";
    return res.status(status).json({ error: message });
  }
});

router.get("/r/:token/download", async (req, res) => {
  try {
    await ensureConnection();
    const resolvedRecord = await resolveReceiptByToken(req.params.token);
    if (!resolvedRecord) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const generated = await generateReceiptPdfByResolvedRecord(resolvedRecord);
    if (!generated?.pdfBuffer) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    return sendPdf(res, generated.filename, generated.pdfBuffer, "attachment");
  } catch (error) {
    console.error("Error downloading short receipt link:", error);
    const status = error.status || 500;
    const message = status === 410 ? "Receipt link has expired" : "Failed to load receipt";
    return res.status(status).json({ error: message });
  }
});

export default router;

