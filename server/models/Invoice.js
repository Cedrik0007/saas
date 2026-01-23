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

const InvoiceSchema = new mongoose.Schema({
  id: { type: String },
  memberId: String,
  memberName: String,
  memberEmail: String,
  period: String,
  amount: String,
  membershipFee: { type: Number, default: 0 }, // Membership fee amount (HK$)
  janazaFee: { type: Number, default: 0 }, // Janaza fund fee amount (HK$)
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
  receiptNumber: { type: String, default: null }, // Receipt number assigned when payment is approved
}, {
  timestamps: true
});

// Ensure invoice ID uniqueness when possible. Use sparse index to avoid conflicts with legacy rows missing `id`.
InvoiceSchema.index({ id: 1 }, { unique: true, sparse: true });

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

    if (this.isModified('memberId')) {
      this.memberId = sanitizeMemberIdValue(this.memberId || "");

      if (!this.isNew) {
        const existing = await this.constructor.findOne({ _id: this._id }).lean();
        if (existing && (existing.status === 'Paid' || existing.status === 'Completed')) {
          return next(new Error('Cannot change memberId on an invoice that is already Paid/Completed'));
        }
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
});

InvoiceSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) return next();

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

    const target = getTargetObject();
    if (!target) return next();

    target.memberId = sanitizeMemberIdValue(target.memberId || "");

    const query = this.getQuery();
    const existing = await this.model.findOne(query).lean();
    if (existing && (existing.status === 'Paid' || existing.status === 'Completed')) {
      return next(new Error('Cannot change memberId on an invoice that is already Paid/Completed'));
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

const InvoiceModel = mongoose.model("invoices", InvoiceSchema);

export default InvoiceModel;

