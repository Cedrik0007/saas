import UserModel from "../models/User.js";
import InvoiceModel from "../models/Invoice.js";

const objectIdRegex = /^[a-f\d]{24}$/i;

const normalizeRef = (ref) => {
  if (ref === null || ref === undefined) return "";
  if (typeof ref === "string") return ref.trim();
  return String(ref).trim();
};

const buildResolutionError = (entityLabel, refValue, message) => {
  const error = new Error(message || `${entityLabel} not found for reference "${refValue}".`);
  error.status = 400;
  return error;
};

const withSession = (query, session) => (session ? query.session(session) : query);

export const isObjectIdRef = (value) => objectIdRegex.test(normalizeRef(value));

export async function resolveMember(ref, options = {}) {
  const normalized = normalizeRef(ref);
  if (!normalized) {
    throw buildResolutionError("Member", normalized, "Member reference is required.");
  }

  const query = isObjectIdRef(normalized)
    ? UserModel.findById(normalized)
    : UserModel.findOne({ id: normalized });

  const member = await withSession(query, options.session);
  if (!member) {
    throw buildResolutionError("Member", normalized, `Member not found for reference "${normalized}".`);
  }
  return member;
}

export async function resolveInvoice(ref, options = {}) {
  const normalized = normalizeRef(ref);
  if (!normalized) {
    throw buildResolutionError("Invoice", normalized, "Invoice reference is required.");
  }

  const query = isObjectIdRef(normalized)
    ? InvoiceModel.findById(normalized)
    : InvoiceModel.findOne({ id: normalized });

  const invoice = await withSession(query, options.session);
  if (!invoice) {
    throw buildResolutionError("Invoice", normalized, `Invoice not found for reference "${normalized}".`);
  }
  return invoice;
}
