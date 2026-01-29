import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  memberNo: {
    type: Number,
    immutable: true,
    required: function () {
      return this.isNew;
    },
  },
  id: {
    type: String,
    unique: true,
    sparse: true,
    validate: {
      validator: (value) => {
        if (value === null || value === undefined) return true;
        const normalized = String(value).trim();
        if (!normalized) return false;
        if (normalized.toUpperCase() === "NOT ASSIGNED") return false;
        return true;
      },
      message: "Member ID must be a valid business identifier or null.",
    },
  },
  previousDisplayIds: {
    type: [
      {
        id: { type: String },
        subscriptionType: { type: String },
        changedAt: { type: Date },
      },
    ],
    default: [],
  },
  name: String,
  email: String,
  phone: String,
  native: String,
  password: String,  // Add password field for member login
  status: String,
  balance: String,
  nextDue: String,
  lastPayment: String,
  subscriptionType: { type: String, default: "Lifetime" }, // "Annual Member", "Lifetime Janaza Fund Member", "Lifetime Membership"
  // Subscription fee fields
  membershipFee: { type: Number, default: 0 }, // Annual membership fee (HK$)
  janazaFee: { type: Number, default: 250 }, // Annual Janaza fund fee (HK$)
  lifetimeMembershipPaid: { type: Boolean, default: false }, // Whether lifetime membership fee has been paid
  // Legacy-only: Janaza-only members pay HK$250/year without the HK$5,000 lifetime fee.
  // We keep a single official lifetime subscriptionType and use this flag to differentiate.
  janazaOnly: { type: Boolean, default: false },
  // Payment management fields
  start_date: { type: Date, default: null },
  payment_status: { type: String, default: "unpaid" }, // unpaid, paid
  payment_mode: { type: String, default: null }, // online, cash
  last_payment_date: { type: Date, default: null },
  next_due_date: { type: Date, default: null },
  payment_proof: { type: String, default: null }, // URL to payment proof image
  // Account lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt fields
});

UserSchema.index({ memberNo: 1 }, { unique: true, sparse: true });

const isUpdatingField = (update, field) => {
  if (!update) return false;
  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, field)) return true;
  if (update.$unset && Object.prototype.hasOwnProperty.call(update.$unset, field)) return true;
  if (update.$inc && Object.prototype.hasOwnProperty.call(update.$inc, field)) return true;
  if (update.$setOnInsert && Object.prototype.hasOwnProperty.call(update.$setOnInsert, field)) return true;
  return Object.prototype.hasOwnProperty.call(update, field);
};

const rejectMemberNoUpdate = function (next) {
  try {
    const update = this.getUpdate ? this.getUpdate() : null;
    if (isUpdatingField(update, "memberNo")) {
      const error = new Error("memberNo is immutable and cannot be updated.");
      error.statusCode = 400;
      throw error;
    }
    const options = this.getOptions ? this.getOptions() : {};
    if (isUpdatingField(update, "id") && !options?.allowDisplayIdUpdate) {
      const error = new Error("Member display ID is immutable and cannot be updated manually.");
      error.statusCode = 400;
      throw error;
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

UserSchema.pre("findOneAndUpdate", rejectMemberNoUpdate);
UserSchema.pre("updateOne", rejectMemberNoUpdate);
UserSchema.pre("updateMany", rejectMemberNoUpdate);

const UserModel = mongoose.model("members", UserSchema);

export default UserModel;

