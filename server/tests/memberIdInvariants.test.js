import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("Member ID invariants", () => {
  let mongoServer;
  let ensureConnection;
  let membersRouter;
  let UserModel;
  let app;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60_000,
      },
    });
    process.env.MONGODB_URI = mongoServer.getUri();

    ({ ensureConnection } = await import("../config/database.js"));
    ({ default: UserModel } = await import("../models/User.js"));
    ({ default: membersRouter } = await import("../routes/members.js"));

    await ensureConnection();

    app = express();
    app.use(express.json());
    app.use("/api/members", membersRouter);
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
    await UserModel.deleteMany({});
  });

  test("multiple members with null memberId are allowed", async () => {
    const responseA = await request(app)
      .post("/api/members")
      .send({ name: "Member A", phone: "+85290000000" });

    const responseB = await request(app)
      .post("/api/members")
      .send({ name: "Member B", phone: "+85290000001" });

    expect(responseA.status).toBe(201);
    expect(responseB.status).toBe(201);

    const stored = await UserModel.find({}).lean();
    expect(stored.length).toBe(2);
    expect(stored[0].id).toBeUndefined();
    expect(stored[1].id).toBeUndefined();
  });

  test("updating member from null to valid ID succeeds", async () => {
    const createResponse = await request(app)
      .post("/api/members")
      .send({ name: "Member C", phone: "+85290000002" });

    expect(createResponse.status).toBe(201);

    const memberId = createResponse.body._id;

    const updateResponse = await request(app)
      .put(`/api/members/${memberId}`)
      .send({ id: "AM701" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.id).toBe("AM701");
  });

  test("duplicate non-null member IDs are rejected", async () => {
    const first = await request(app)
      .post("/api/members")
      .send({ name: "Member D", phone: "+85290000003", id: "AM702" });

    const second = await request(app)
      .post("/api/members")
      .send({ name: "Member E", phone: "+85290000004" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const updateResponse = await request(app)
      .put(`/api/members/${second.body._id}`)
      .send({ id: "AM702" });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.message).toMatch(/member id already exists/i);
  });

  test("'Not Assigned' is rejected at the API level", async () => {
    const createResponse = await request(app)
      .post("/api/members")
      .send({ name: "Member F", phone: "+85290000005", id: "Not Assigned" });

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.message).toMatch(/not assigned/i);

    const member = await request(app)
      .post("/api/members")
      .send({ name: "Member G", phone: "+85290000006" });

    const updateResponse = await request(app)
      .put(`/api/members/${member.body._id}`)
      .send({ id: "Not Assigned" });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.message).toMatch(/not assigned/i);
  });
});
