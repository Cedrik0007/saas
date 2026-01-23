import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("Invoice data invariants", () => {
  let mongoServer;
  let ensureConnection;
  let invoicesRouter;
  let UserModel;
  let InvoiceModel;
  let app;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60_000, // give Windows more time to boot the in-memory mongod
      },
    });
    process.env.MONGODB_URI = mongoServer.getUri();

    ({ ensureConnection } = await import("../config/database.js"));
    ({ default: UserModel } = await import("../models/User.js"));
    ({ default: InvoiceModel } = await import("../models/Invoice.js"));
    ({ default: invoicesRouter } = await import("../routes/invoices.js"));

    await ensureConnection();

    app = express();
    app.use(express.json());
    app.use("/api/invoices", invoicesRouter);
  });

  afterAll(async () => {
    await mongoose.connection.close(true);
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop({ doCleanup: true, force: true });
    }
    if (global.mongoose) {
      global.mongoose.conn = null;
      global.mongoose.promise = null;
    }
  });

  beforeEach(async () => {
    await InvoiceModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  test("creating an invoice with Mongo ObjectId memberId returns 400", async () => {
    const objectIdLike = new mongoose.Types.ObjectId().toHexString();

    const response = await request(app)
      .post("/api/invoices")
      .send({
        memberId: objectIdLike,
        period: "2025 Membership",
        amount: "HK$0",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toMatch(/business identifier/i);
  });

  test("creating an invoice with non-existent member id returns 400", async () => {
    const response = await request(app)
      .post("/api/invoices")
      .send({
        memberId: "IMA40400",
        period: "2025 Membership",
        amount: "HK$0",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toMatch(/not found/i);
  });

  test("saving and updating an invoice strips memberName and memberEmail", async () => {
    const member = await UserModel.create({
      id: "IMA2001",
      name: "Test Member",
    });

    await InvoiceModel.create({
      id: "INV-TEST-1",
      memberId: member.id,
      amount: "HK$0",
      period: "2025",
      memberName: "Should Remove",
      memberEmail: "remove@example.com",
    });

    let storedInvoice = await InvoiceModel.findOne({ id: "INV-TEST-1" }).lean();
    expect(storedInvoice.memberName).toBeUndefined();
    expect(storedInvoice.memberEmail).toBeUndefined();

    await InvoiceModel.findOneAndUpdate(
      { id: "INV-TEST-1" },
      {
        $set: {
          memberName: "Another Name",
          memberEmail: "another@example.com",
        },
      },
      { new: true }
    );

    storedInvoice = await InvoiceModel.findOne({ id: "INV-TEST-1" }).lean();
    expect(storedInvoice.memberName).toBeUndefined();
    expect(storedInvoice.memberEmail).toBeUndefined();
  });
});
