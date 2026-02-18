import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const allowedRoles = ["Owner", "Finance Admin", "Viewer"];
const BCRYPT_SALT_ROUNDS = 10;

const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const AdminSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  phone: String,
  password: String,
  role: {
    type: String,
    enum: allowedRoles,
    default: "Viewer",
  },
  status: { type: String, default: "Active" },
  // Account lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
});

AdminSchema.pre("save", async function hashPasswordBeforeSave(next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    if (typeof this.password !== "string" || !this.password.trim()) {
      return next(new Error("Password is required"));
    }

    // Skip if already a bcrypt hash (e.g., migration scripts).
    if (isBcryptHash(this.password)) {
      return next();
    }

    this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error);
  }
});

AdminSchema.pre("findOneAndUpdate", async function hashPasswordBeforeUpdate(next) {
  try {
    const update = this.getUpdate() || {};
    const hasTopLevelPassword = Object.prototype.hasOwnProperty.call(update, "password");
    const hasSetPassword = update.$set && Object.prototype.hasOwnProperty.call(update.$set, "password");
    const nextPassword = hasSetPassword ? update.$set.password : (hasTopLevelPassword ? update.password : undefined);

    if (typeof nextPassword === "undefined") {
      return next();
    }

    if (typeof nextPassword !== "string" || !nextPassword.trim()) {
      return next(new Error("Password cannot be empty"));
    }

    // If already hashed, avoid hashing again.
    if (isBcryptHash(nextPassword)) {
      return next();
    }

    const hashedPassword = await bcrypt.hash(nextPassword, BCRYPT_SALT_ROUNDS);
    if (hasSetPassword) {
      update.$set.password = hashedPassword;
    } else {
      update.password = hashedPassword;
    }

    this.setUpdate(update);
    return next();
  } catch (error) {
    return next(error);
  }
});

const AdminModel = mongoose.model("admins", AdminSchema);

export default AdminModel;

