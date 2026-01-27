import { ensureConnection } from "../config/database.js";
import CounterModel from "../models/Counter.js";

const ALLOWED_SEQUENCES = new Set([
  "memberNo",
  "invoiceNo",
  "paymentNo",
  "memberDisplayAM",
  "memberDisplayLM",
]);

export async function getNextSequence(key, options = {}) {
  if (!ALLOWED_SEQUENCES.has(key)) {
    throw new Error(`Unknown sequence key: ${key}`);
  }

  const { session } = options;
  await ensureConnection();

  const sessionOptions = session ? { session } : {};

  const updatedCounter = await CounterModel.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, ...sessionOptions }
  );

  if (!updatedCounter) {
    throw new Error(`Failed to increment sequence for ${key}`);
  }

  return updatedCounter.seq;
}