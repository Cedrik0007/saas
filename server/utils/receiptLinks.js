import crypto from "crypto";
import { ensureConnection } from "../config/database.js";
import InvoiceModel from "../models/Invoice.js";
import DonationModel from "../models/Donation.js";

const normalizeBaseUrl = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/\/+$/, "");
};

const DEFAULT_PUBLIC_API_BASE_URL = "https://saas-cj3b.onrender.com";
// const DEFAULT_PUBLIC_API_BASE_URL = "http://localhost:4000";

export const getPublicApiBaseUrl = () => {
  const envBase = normalizeBaseUrl(process.env.PUBLIC_API_BASE_URL);
  if (envBase) return envBase;
  return DEFAULT_PUBLIC_API_BASE_URL;
};

const generateShortToken = () => crypto.randomBytes(4).toString("hex");

const buildShortReceiptUrl = (token) => {
  if (!token) return null;
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/r/${token}`;
};

const getDocumentIdValue = (docOrId) => {
  if (!docOrId) return null;
  if (typeof docOrId === "string") return docOrId;
  if (docOrId._id) return String(docOrId._id);
  return null;
};

const upsertShortToken = async (Model, documentId) => {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = generateShortToken();
    const updated = await Model.findOneAndUpdate(
      { _id: documentId, $or: [{ shortToken: null }, { shortToken: { $exists: false } }, { shortToken: "" }] },
      { $set: { shortToken: token } },
      { new: true }
    ).lean();

    if (updated?.shortToken) return updated.shortToken;

    const current = await Model.findById(documentId).select("shortToken").lean();
    if (current?.shortToken) return current.shortToken;
  }

  throw new Error("Failed to generate a unique short receipt token.");
};

export const ensureInvoiceShortToken = async (invoiceDocOrId) => {
  const idValue = getDocumentIdValue(invoiceDocOrId);
  if (!idValue) return null;

  if (typeof invoiceDocOrId === "object" && invoiceDocOrId?.shortToken) {
    return invoiceDocOrId.shortToken;
  }

  await ensureConnection();
  const existing = await InvoiceModel.findById(idValue).select("shortToken").lean();
  if (!existing) return null;
  if (existing.shortToken) return existing.shortToken;
  return upsertShortToken(InvoiceModel, idValue);
};

export const ensureDonationShortToken = async (donationDocOrId) => {
  const idValue = getDocumentIdValue(donationDocOrId);
  if (!idValue) return null;

  if (typeof donationDocOrId === "object" && donationDocOrId?.shortToken) {
    return donationDocOrId.shortToken;
  }

  await ensureConnection();
  const existing = await DonationModel.findById(idValue).select("shortToken").lean();
  if (!existing) return null;
  if (existing.shortToken) return existing.shortToken;
  return upsertShortToken(DonationModel, idValue);
};

export const getReceiptViewUrl = async (invoiceDocOrId) => {
  const token = await ensureInvoiceShortToken(invoiceDocOrId);
  return buildShortReceiptUrl(token);
};

export const getReceiptWhatsAppUrl = async (invoiceDocOrId) => {
  const token = await ensureInvoiceShortToken(invoiceDocOrId);
  return buildShortReceiptUrl(token);
};

export const getReceiptDownloadUrl = async (invoiceDocOrId) => {
  const token = await ensureInvoiceShortToken(invoiceDocOrId);
  return buildShortReceiptUrl(token);
};

export const getDonationReceiptWhatsAppUrl = async (donationDocOrId) => {
  const token = await ensureDonationShortToken(donationDocOrId);
  return buildShortReceiptUrl(token);
};
