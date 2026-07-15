import { describe, expect, it } from "vitest";
import { resolveSignIn } from "./reconcile";

describe("resolveSignIn", () => {
  it("returns the existing user when a users/{uid} doc already exists", () => {
    const existingUser = {
      email: "grace@example.com",
      name: "Grace",
      role: "engagementLead" as const,
      createdAt: 1,
    };

    const result = resolveSignIn({
      email: "grace@example.com",
      existingUser,
      matchingInvite: null,
      allowedAdminEmails: [],
    });

    expect(result).toEqual({ kind: "existing", user: existingUser });
  });

  it("creates a user from a matching invite on first sign-in", () => {
    const result = resolveSignIn({
      email: "intern@example.com",
      existingUser: null,
      matchingInvite: {
        id: "invite-1",
        email: "intern@example.com",
        name: "New Intern",
        role: "intern",
        engagementId: "eng-1",
        createdAt: 1,
        usedAt: null,
      },
      allowedAdminEmails: [],
    });

    expect(result.kind).toBe("createFromInvite");
    if (result.kind !== "createFromInvite") throw new Error("unreachable");
    expect(result.user.role).toBe("intern");
    expect(result.user.engagementId).toBe("eng-1");
    expect(result.inviteId).toBe("invite-1");
  });

  it("creates a companyAdmin user for an allowlisted email with no invite", () => {
    const result = resolveSignIn({
      email: "ethan@example.com",
      existingUser: null,
      matchingInvite: null,
      allowedAdminEmails: ["ethan@example.com"],
    });

    expect(result.kind).toBe("createFromAdminAllowlist");
    if (result.kind !== "createFromAdminAllowlist") throw new Error("unreachable");
    expect(result.user.role).toBe("companyAdmin");
    expect(result.user.email).toBe("ethan@example.com");
  });

  it("denies sign-in when there is no existing user, invite, or allowlist match", () => {
    const result = resolveSignIn({
      email: "stranger@example.com",
      existingUser: null,
      matchingInvite: null,
      allowedAdminEmails: [],
    });

    expect(result).toEqual({ kind: "denied" });
  });

  it("prefers the existing user doc even if the email also matches an invite", () => {
    const existingUser = {
      email: "already@example.com",
      name: "Already Signed In Before",
      role: "intern" as const,
      createdAt: 1,
    };

    const result = resolveSignIn({
      email: "already@example.com",
      existingUser,
      matchingInvite: {
        id: "invite-2",
        email: "already@example.com",
        name: "Stale Invite",
        role: "engagementLead",
        createdAt: 1,
        usedAt: null,
      },
      allowedAdminEmails: [],
    });

    expect(result).toEqual({ kind: "existing", user: existingUser });
  });
});
