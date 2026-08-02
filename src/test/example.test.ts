import { describe, expect, it } from "vitest";
import { apiUrl } from "@/lib/api";

describe("api client", () => {
  it("builds relative worker URLs", () => {
    expect(apiUrl("/api/auth/get-session")).toContain("/api/auth/get-session");
  });
});
