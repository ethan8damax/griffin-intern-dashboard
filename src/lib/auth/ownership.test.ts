import { describe, expect, it } from "vitest";
import { isOwnedIntern, requireLeadEngagementId } from "./ownership";
import type { UserDoc } from "./types";

function makeUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    email: "intern@example.com",
    name: "Test Intern",
    role: "intern",
    engagementId: "eng-1",
    createdAt: 0,
    status: "active",
    ...overrides,
  };
}

describe("isOwnedIntern", () => {
  it("returns true for an intern in the lead's own engagement", () => {
    expect(isOwnedIntern(makeUser(), "eng-1")).toBe(true);
  });

  it("returns false for a user in a different engagement", () => {
    expect(isOwnedIntern(makeUser({ engagementId: "eng-2" }), "eng-1")).toBe(false);
  });

  it("returns false for a non-intern role, even in the same engagement", () => {
    expect(isOwnedIntern(makeUser({ role: "engagementLead" }), "eng-1")).toBe(false);
  });

  it("returns false when the lead has no engagement assigned", () => {
    expect(isOwnedIntern(makeUser(), "")).toBe(false);
  });
});

describe("requireLeadEngagementId", () => {
  it("throws when the lead has no engagementId", () => {
    expect(() => requireLeadEngagementId({ engagementId: undefined })).toThrow(
      "You are not assigned to an engagement."
    );
  });

  it("returns the engagementId when present", () => {
    expect(requireLeadEngagementId({ engagementId: "eng-1" })).toBe("eng-1");
  });
});
