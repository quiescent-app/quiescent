import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { HttpStatus } from "../../errors/appError.js";

describe("CORS middleware", () => {
  it("allows credentialed requests from the configured web origin", async () => {
    const response = await request(createApp())
      .options("/auth/refresh")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    expect(response.status).toBe(HttpStatus.NO_CONTENT);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("rejects preflight requests from other origins", async () => {
    const response = await request(createApp())
      .options("/auth/refresh")
      .set("Origin", "https://attacker.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
