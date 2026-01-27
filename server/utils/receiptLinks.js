const normalizeBaseUrl = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/\/+$/, "");
};

export const getPublicApiBaseUrl = () => {
  const envBase = normalizeBaseUrl(process.env.PUBLIC_API_BASE_URL);
  if (envBase) return envBase;
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4000";
  }
  return "";
};

export const getReceiptDownloadUrl = (invoiceId) => {
  if (!invoiceId) return null;
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/api/invoices/${invoiceId}/pdf-receipt/download`;
};
