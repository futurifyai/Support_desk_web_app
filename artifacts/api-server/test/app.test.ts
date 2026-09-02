import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app";

describe("API application safeguards", () => {
  it("serves the health check with security headers", async () => {
    const response = await request(app).get("/api/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("protects customer ticket and satisfaction routes", async () => {
    const [tickets, satisfaction] = await Promise.all([
      request(app).get("/api/tickets"),
      request(app).get("/api/tickets/satisfaction"),
    ]);

    expect(tickets.status).toBe(401);
    expect(satisfaction.status).toBe(401);
    expect(tickets.body).toMatchObject({ success: false });
    expect(satisfaction.body).toMatchObject({ success: false });
  });

  it("blocks public account signup", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ name: "New User", email: "new@example.com", password: "password123" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Account creation is admin-only. Contact your administrator.",
    });
  });

  it("returns the standard response envelope for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, message: "Invalid request body" });
  });
});