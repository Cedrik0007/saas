const normalizeBaseUrl = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/\/+$/, "");
};

const DEFAULT_PUBLIC_API_BASE_URL = "https://saas-cj3b.onrender.com";

export const getPublicApiBaseUrl = () => {
  const envBase = normalizeBaseUrl(process.env.PUBLIC_API_BASE_URL);
  if (envBase) return envBase;
  return DEFAULT_PUBLIC_API_BASE_URL;
};

export const getReceiptViewUrl = (invoiceId) => {
  if (!invoiceId) return null;
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/api/invoices/${invoiceId}/pdf-receipt/view`;
};

export const getReceiptWhatsAppUrl = (invoiceId) => {
  if (!invoiceId) return null;
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/api/invoices/${invoiceId}/pdf-receipt/whatsapp`;
};

export const getReceiptDownloadUrl = (invoiceId) => {
  if (!invoiceId) return null;
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/api/invoices/${invoiceId}/pdf-receipt/download`;
};
