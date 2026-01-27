import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 1000 },
  },
  {
    timestamps: true,
  }
);

const CounterModel = mongoose.model("counters", CounterSchema);

export default CounterModel;