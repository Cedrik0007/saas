import process from "process";
import { ensureConnection } from "../config/database.js";
import UserModel from "../models/User.js";

async function backfillMemberIds() {
  await ensureConnection();

  const result = await UserModel.updateMany(
    { id: { $regex: /^\s*not assigned\s*$/i } },
    { $set: { id: null } }
  );

  console.log(`\n✅ Updated ${result.modifiedCount || 0} member(s) with id="Not Assigned" to null.`);
  process.exit(0);
}

backfillMemberIds().catch((error) => {
  console.error("\n❌ Member ID backfill failed:", error);
  process.exit(1);
});
