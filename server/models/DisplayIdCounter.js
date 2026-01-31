import mongoose from "mongoose";

const DisplayIdCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const DisplayIdCounterModel = mongoose.model("displayIdCounters", DisplayIdCounterSchema, "counters");

export default DisplayIdCounterModel;
