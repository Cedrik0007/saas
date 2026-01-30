export const matchesInvoiceToMember = (invoice, member) => {
  if (!invoice || !member) return false;

  const memberNoStr = member?.memberNo != null ? String(member.memberNo).trim() : "";
  const memberBusinessId = member.id ? String(member.id).trim() : "";
  const previousIds = Array.isArray(member.previousDisplayIds)
    ? member.previousDisplayIds.map((entry) => String(entry?.id || "").trim()).filter(Boolean)
    : [];

  const invoiceMemberNo = invoice?.memberNo != null ? String(invoice.memberNo).trim() : "";
  const invoiceMemberId = invoice?.memberId ? String(invoice.memberId).trim() : "";
  const invoiceMemberRef = invoice?.memberRef != null ? String(invoice.memberRef).trim() : "";
  const memberDbId = member?._id != null ? String(member._id).trim() : "";

  const matchesByNo = memberNoStr && invoiceMemberNo && invoiceMemberNo === memberNoStr;
  const matchesByCurrentId = invoiceMemberId && memberBusinessId && invoiceMemberId === memberBusinessId;
  const matchesByPreviousId = invoiceMemberId && previousIds.includes(invoiceMemberId);
  const matchesByRef = invoiceMemberRef && memberDbId && invoiceMemberRef === memberDbId;

  return matchesByNo || matchesByCurrentId || matchesByPreviousId || matchesByRef;
};
