import type { InviteDoc, UserDoc } from "./types";

/**
 * Caller's contract: `matchingInvite` must already be filtered to
 * `usedAt === null`, and `email` / `allowedAdminEmails` entries must already
 * be lowercased — this function does no normalization itself.
 */
export interface ReconcileInput {
  email: string;
  existingUser: UserDoc | null;
  matchingInvite: (InviteDoc & { id: string }) | null;
  allowedAdminEmails: string[];
}

export type ReconcileResult =
  | { kind: "existing"; user: UserDoc }
  | { kind: "createFromInvite"; user: UserDoc; inviteId: string }
  | { kind: "createFromAdminAllowlist"; user: UserDoc }
  | { kind: "denied" };

export function resolveSignIn(input: ReconcileInput): ReconcileResult {
  const { email, existingUser, matchingInvite, allowedAdminEmails } = input;

  if (existingUser) {
    return { kind: "existing", user: existingUser };
  }

  if (matchingInvite) {
    const user: UserDoc = {
      email,
      name: matchingInvite.name,
      role: matchingInvite.role,
      engagementId: matchingInvite.engagementId,
      createdAt: Date.now(),
      status: "active",
    };
    return { kind: "createFromInvite", user, inviteId: matchingInvite.id };
  }

  if (allowedAdminEmails.includes(email)) {
    const user: UserDoc = {
      email,
      name: email,
      role: "companyAdmin",
      createdAt: Date.now(),
      status: "active",
    };
    return { kind: "createFromAdminAllowlist", user };
  }

  return { kind: "denied" };
}
