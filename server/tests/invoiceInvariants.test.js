import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

describe("Invoice data invariants", () => {
  let mongoServer;
  let ensureConnection;
  let invoicesRouter;
  let paymentsRouter;
  let UserModel;
  let InvoiceModel;
  let PaymentModel;
  let app;

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instance: { launchTimeout: 60_000 },
    });
    process.env.MONGODB_URI = mongoServer.getUri();

    ({ ensureConnection } = await import("../config/database.js"));
    ({ default: UserModel } = await import("../models/User.js"));
    ({ default: InvoiceModel } = await import("../models/Invoice.js"));
    ({ default: PaymentModel } = await import("../models/Payment.js"));
    ({ default: invoicesRouter } = await import("../routes/invoices.js"));
    ({ default: paymentsRouter } = await import("../routes/payments.js"));

    await ensureConnection();

    app = express();
    app.use(express.json());
    app.use("/api/invoices", invoicesRouter);
    app.use("/api/payments", paymentsRouter);
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
    await PaymentModel.deleteMany({});
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

  test("marking an invoice as paid directly is rejected", async () => {
    const member = await UserModel.create({
      id: "IMA2002",
      name: "Receipt Test",
    });

    await InvoiceModel.create({
      id: "INV-TEST-2",
      memberId: member.id,
      amount: "HK$100",
      period: "2025 Membership",
    });

    const response = await request(app)
      .put("/api/invoices/INV-TEST-2")
      .send({ status: "Paid" });

    const stored = await InvoiceModel.findOne({ id: "INV-TEST-2" }).lean();
    expect(response.status).toBe(400);
    expect(stored.status).toBe("Unpaid");
  });

  test("payment approval marks invoice paid and assigns receipt number", async () => {
    const member = await UserModel.create({
      id: "IMA2004",
      name: "Approval Test",
      subscriptionType: "Annual Member",
    });

    await InvoiceModel.create({
      id: "INV-TEST-4",
      memberId: member.id,
      amount: "HK$100",
      period: "2025 Membership",
      status: "Unpaid",
    });

    const payment = await PaymentModel.create({
      invoiceId: "INV-TEST-4",
      memberId: member.id,
      amount: "HK$100",
      status: "Pending",
      method: "Cash",
    });

    const response = await request(app)
      .put(`/api/payments/${payment._id}/approve`)
      .send({ adminName: "Test Admin" });

    expect(response.status).toBe(200);

    const updatedInvoice = await InvoiceModel.findOne({ id: "INV-TEST-4" }).lean();
    expect(updatedInvoice.status).toBe("Paid");
    expect(updatedInvoice.receiptNumber).toEqual(expect.any(String));
    expect(updatedInvoice.receiptNumber.trim().length).toBeGreaterThan(0);
  });

  test("attempting to clear a paid invoice receipt is rejected", async () => {
    const member = await UserModel.create({
      id: "IMA2003",
      name: "Receipt Guard",
    });

    await InvoiceModel.create({
      id: "INV-TEST-3",
      memberId: member.id,
      amount: "HK$120",
      period: "2025 Membership",
      status: "Unpaid",
    });

    const payment = await PaymentModel.create({
      invoiceId: "INV-TEST-3",
      memberId: member.id,
      amount: "HK$120",
      status: "Pending",
      method: "Cash",
    });

    const approvalResponse = await request(app)
      .put(`/api/payments/${payment._id}/approve`)
      .send({ adminName: "Test Admin" });

    expect(approvalResponse.status).toBe(200);

    const response = await request(app)
      .put("/api/invoices/INV-TEST-3")
      .send({ receiptNumber: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");

    const stored = await InvoiceModel.findOne({ id: "INV-TEST-3" }).lean();
    expect(stored.receiptNumber).toBeTruthy();
  });
});
