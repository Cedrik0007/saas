import mongoose from "mongoose";

const objectIdRegex = /^[a-f\d]{24}$/i;

function sanitizeMemberIdValue(memberId) {
  if (typeof memberId !== "string") {
    throw new Error("invoice.memberId must be a string");
  }
  const trimmed = memberId.trim();
  if (!trimmed) {
    throw new Error("invoice.memberId is required and cannot be empty");
  }
  if (objectIdRegex.test(trimmed)) {
    throw new Error("invoice.memberId must be the business identifier (e.g., IMA1234), not the Mongo _id");
  }
  return trimmed;
}

function stripMemberIdentityFields(target) {
  if (!target) return;
  if (Object.prototype.hasOwnProperty.call(target, "memberName")) {
    delete target.memberName;
  }
  if (Object.prototype.hasOwnProperty.call(target, "memberEmail")) {
    delete target.memberEmail;
  }
}

const PAID_STATUSES = new Set(["Paid", "Completed"]);

const isPaidStatus = (status = "") => typeof status === "string" && PAID_STATUSES.has(status);

const hasReceiptValue = (value) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized || normalized === "-") return false;
  return /^\d+$/.test(normalized);
};

const buildValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const isPaidStatusUpdateAllowed = (options = {}) => options?.allowPaidStatusUpdate === true;

async function ensureReceiptNumberForDocument(invoiceDoc) {
  if (!invoiceDoc) {
    return;
  }

  if (isPaidStatus(invoiceDoc.status) && !hasReceiptValue(invoiceDoc.receiptNumber)) {
    throw buildValidationError("Paid invoices require a receiptNumber.");
  }
}

const extractUpdateValue = (update, field) => {
  if (!update) return undefined;
  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, field)) {
    return update.$set[field];
  }
  if (Object.prototype.hasOwnProperty.call(update, field)) {
    return update[field];
  }
  return undefined;
};

const isReceiptUnset = (update) =>
  Boolean(update?.$unset && Object.prototype.hasOwnProperty.call(update.$unset, "receiptNumber"));

const isRemovingReceiptValue = (value) =>
  value === null || (typeof value === "string" && value.trim().length === 0);

const isPaidStatusUpdate = (update) => isPaidStatus(extractUpdateValue(update, "status"));

const hasInvalidReceiptUpdate = (update) => {
  if (!update) return false;
  const receiptUpdateValue = extractUpdateValue(update, "receiptNumber");
  if (isReceiptUnset(update)) return true;
  if (receiptUpdateValue === undefined) return false;
  return !hasReceiptValue(receiptUpdateValue);
};

const isReceiptUpdateAttempt = (update) =>
  isReceiptUnset(update) || isUpdatingField(update, "receiptNumber");

const requiresReceiptForPaidUpdate = (update) => {
  if (!isPaidStatusUpdate(update)) return false;
  const receiptUpdateValue = extractUpdateValue(update, "receiptNumber");
  return !hasReceiptValue(receiptUpdateValue || "");
};

async function ensureReceiptNumberForUpdate(update, existingInvoice) {
  if (!update) {
    return;
  }

  const existingStatus = existingInvoice?.status;
  const statusUpdate = extractUpdateValue(update, "status");
  const finalStatus = statusUpdate !== undefined ? statusUpdate : existingStatus;
  const willBePaid = isPaidStatus(finalStatus);
  const receiptUpdateValue = extractUpdateValue(update, "receiptNumber");
  const explicitUnset = isReceiptUnset(update);
  const removingReceipt = explicitUnset || (receiptUpdateValue !== undefined && isRemovingReceiptValue(receiptUpdateValue));

  if (willBePaid) {
    if (removingReceipt) {
      throw buildValidationError("Paid invoices require a receiptNumber.");
    }

    if (receiptUpdateValue !== undefined) {
      if (!hasReceiptValue(receiptUpdateValue)) {
        throw buildValidationError("Paid invoices require a receiptNumber.");
      }
      return;
    }

    if (existingInvoice && hasReceiptValue(existingInvoice.receiptNumber)) {
      return;
    }

    throw buildValidationError("Paid invoices require a receiptNumber.");
  }

  if (!willBePaid && !statusUpdate && isPaidStatus(existingStatus) && removingReceipt) {
    throw buildValidationError("Paid invoices require a receiptNumber.");
  }
}

const InvoiceSchema = new mongoose.Schema({
  invoiceNo: {
    type: Number,
    immutable: true,
  },
  id: { type: String },
  memberRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: function () {
      return this.isNew;
    },
  },
  memberNo: {
    type: Number,
    required: function () {
      return this.isNew;
    },
  },
  memberId: String,
  memberName: String,
  memberEmail: String,
  period: String,
  amount: String,
  membershipFee: { type: Number, default: 0 }, // Membership fee amount (HK$)
  janazaFee: { type: Number, default: 0 }, // Janaza fund fee amount (HK$)
  subscriptionType: { type: String, default: null },
  invoiceType: { type: String, default: "combined" }, // "membership", "janaza", "combined", "lifetime_membership"
  status: { type: String, default: "Unpaid" },
  due: String,
  method: String,
  reference: String,
  screenshot: String,
  paidToAdmin: String,
  paidToAdminName: String,
  // Payment confirmation fields
  payment_mode: { type: String, default: null }, // online, cash
  payment_proof: { type: String, default: null }, // URL to payment proof image
  last_payment_date: { type: Date, default: null },
  receiver_name: { type: String, default: null },
  receiptNumber: { type: String, default: null }, // Receipt number assigned when payment is approved
}, {
  timestamps: true
});

// Ensure invoice ID uniqueness when possible. Use sparse index to avoid conflicts with legacy rows missing `id`.
InvoiceSchema.index({ id: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ invoiceNo: 1 }, { unique: true, sparse: true });

const isUpdatingField = (update, field) => {
  if (!update) return false;
  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, field)) return true;
  if (update.$unset && Object.prototype.hasOwnProperty.call(update.$unset, field)) return true;
  if (update.$inc && Object.prototype.hasOwnProperty.call(update.$inc, field)) return true;
  if (update.$setOnInsert && Object.prototype.hasOwnProperty.call(update.$setOnInsert, field)) return true;
  return Object.prototype.hasOwnProperty.call(update, field);
};

InvoiceSchema.pre('validate', function (next) {
  try {
    if (this.memberName !== undefined) this.memberName = undefined;
    if (this.memberEmail !== undefined) this.memberEmail = undefined;
    this.memberId = sanitizeMemberIdValue(this.memberId || "");
    next();
  } catch (err) {
    next(err);
  }
});

// Prevent changing memberId once invoice is Paid or Completed
InvoiceSchema.pre('save', async function (next) {
  try {
    if (this.memberName !== undefined) this.memberName = undefined;
    if (this.memberEmail !== undefined) this.memberEmail = undefined;

    const existing = !this.isNew
      ? await this.constructor.findOne({ _id: this._id }).lean()
      : null;

    if (this.isModified('memberId')) {
      this.memberId = sanitizeMemberIdValue(this.memberId || "");

      if (!this.isNew) {
        if (existing && (existing.status === 'Paid' || existing.status === 'Completed')) {
          return next(new Error('Cannot change memberId on an invoice that is already Paid/Completed'));
        }
      }
    }

    if (this.isModified('receiptNumber') && existing && hasReceiptValue(existing.receiptNumber)) {
      const existingReceipt = String(existing.receiptNumber).trim();
      const nextReceipt = String(this.receiptNumber || "").trim();
      if (!nextReceipt || existingReceipt !== nextReceipt) {
        throw buildValidationError("receiptNumber is immutable and cannot be changed.");
      }
    }

    if (this.isModified('status') && isPaidStatus(this.status) && !isPaidStatusUpdateAllowed(this.$locals || {})) {
      throw buildValidationError("Paid status can only be set via the payment approval service.");
    }

    await ensureReceiptNumberForDocument(this);
    return next();
  } catch (err) {
    return next(err);
  }
});

InvoiceSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) return next();

    if (isUpdatingField(update, "invoiceNo")) {
      throw buildValidationError("invoiceNo is immutable and cannot be updated.");
    }

    stripMemberIdentityFields(update);
    if (update.$set) {
      stripMemberIdentityFields(update.$set);
    }

    const getTargetObject = () => {
      if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, 'memberId')) {
        return update.$set;
      }
      if (Object.prototype.hasOwnProperty.call(update, 'memberId')) {
        return update;
      }
      return null;
    };

    const options = this.getOptions ? this.getOptions() : {};
    const query = this.getQuery();
    const existing = await this.model.findOne(query).lean();
    const target = getTargetObject();

    if (existing && hasReceiptValue(existing.receiptNumber) && isReceiptUpdateAttempt(update)) {
      const receiptUpdateValue = extractUpdateValue(update, "receiptNumber");
      const nextReceipt = receiptUpdateValue !== undefined ? String(receiptUpdateValue || "").trim() : "";
      if (!nextReceipt || String(existing.receiptNumber).trim() !== nextReceipt) {
        throw buildValidationError("receiptNumber is immutable and cannot be changed.");
      }
    }

    if (target) {
      target.memberId = sanitizeMemberIdValue(target.memberId || "");

      if (existing && (existing.status === 'Paid' || existing.status === 'Completed')) {
        return next(new Error('Cannot change memberId on an invoice that is already Paid/Completed'));
      }
    }

    if (isPaidStatusUpdate(update) && !isPaidStatusUpdateAllowed(options)) {
      throw buildValidationError("Paid status can only be set via the payment approval service.");
    }

    if (isReceiptUpdateAttempt(update)) {
      const query = this.getQuery();
      const hasReceiptMatch = await this.model.exists({
        $and: [query, { receiptNumber: { $nin: [null, "", "-"] } }],
      });
      if (hasReceiptMatch) {
        throw buildValidationError("receiptNumber is immutable and cannot be changed.");
      }
    }

    await ensureReceiptNumberForUpdate(update, existing);
    return next();
  } catch (err) {
    return next(err);
  }
});

InvoiceSchema.pre('updateOne', async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) return next();

    if (isUpdatingField(update, "invoiceNo")) {
      throw buildValidationError("invoiceNo is immutable and cannot be updated.");
    }

    const options = this.getOptions ? this.getOptions() : {};
    if (isPaidStatusUpdate(update) && !isPaidStatusUpdateAllowed(options)) {
      throw buildValidationError("Paid status can only be set via the payment approval service.");
    }

    if (isReceiptUpdateAttempt(update)) {
      const query = this.getQuery();
      const hasReceiptMatch = await this.model.exists({
        $and: [query, { receiptNumber: { $nin: [null, "", "-"] } }],
      });
      if (hasReceiptMatch) {
        throw buildValidationError("receiptNumber is immutable and cannot be changed.");
      }
    }

    if (requiresReceiptForPaidUpdate(update)) {
      throw buildValidationError("Paid invoices require a receiptNumber.");
    }

    if (hasInvalidReceiptUpdate(update)) {
      const query = this.getQuery();
      const hasPaidMatch = await this.model.exists({
        $and: [query, { status: { $in: Array.from(PAID_STATUSES) } }],
      });
      if (hasPaidMatch) {
        throw buildValidationError("Paid invoices require a receiptNumber.");
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
});

InvoiceSchema.pre('updateMany', async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) return next();

    if (isUpdatingField(update, "invoiceNo")) {
      throw buildValidationError("invoiceNo is immutable and cannot be updated.");
    }

    const options = this.getOptions ? this.getOptions() : {};
    if (isPaidStatusUpdate(update) && !isPaidStatusUpdateAllowed(options)) {
      throw buildValidationError("Paid status can only be set via the payment approval service.");
    }

    if (requiresReceiptForPaidUpdate(update)) {
      throw buildValidationError("Paid invoices require a receiptNumber.");
    }

    if (hasInvalidReceiptUpdate(update)) {
      const query = this.getQuery();
      const hasPaidMatch = await this.model.exists({
        $and: [query, { status: { $in: Array.from(PAID_STATUSES) } }],
      });
      if (hasPaidMatch) {
        throw buildValidationError("Paid invoices require a receiptNumber.");
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
});

const InvoiceModel = mongoose.model("invoices", InvoiceSchema);

export default InvoiceModel;

