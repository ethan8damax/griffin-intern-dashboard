"use server";

import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase-admin";
import { createSession, clearSession } from "@/lib/auth/session";
import { resolveSignIn } from "@/lib/auth/reconcile";
import type { InviteDoc, UserDoc, UserRole } from "@/lib/auth/types";

function allowedAdminEmails(): string[] {
  return (process.env.ALLOWED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function roleHomePath(role: UserRole): string {
  if (role === "companyAdmin") return "/admin";
  if (role === "engagementLead") return "/lead";
  return "/intern";
}

export async function completeSignIn(
  idToken: string,
  uid: string,
  email: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const userRef = adminDb.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  const existingUser = userSnapshot.exists
    ? (userSnapshot.data() as UserDoc)
    : null;

  const inviteQuery = await adminDb
    .collection("invites")
    .where("email", "==", normalizedEmail)
    .where("usedAt", "==", null)
    .limit(1)
    .get();
  const matchingInvite = inviteQuery.empty
    ? null
    : {
        id: inviteQuery.docs[0].id,
        ...(inviteQuery.docs[0].data() as InviteDoc),
      };

  const result = resolveSignIn({
    email: normalizedEmail,
    existingUser,
    matchingInvite,
    allowedAdminEmails: allowedAdminEmails(),
  });

  if (result.kind === "denied") {
    throw new Error("No account found for this email. Contact your admin.");
  }

  if (result.kind === "createFromInvite") {
    await userRef.set(result.user);
    await adminDb
      .collection("invites")
      .doc(result.inviteId)
      .update({ usedAt: Date.now() });

    if (result.user.role === "engagementLead" && result.user.engagementId) {
      await adminDb
        .collection("engagements")
        .doc(result.user.engagementId)
        .update({ leadUserId: uid });
    }
  } else if (result.kind === "createFromAdminAllowlist") {
    await userRef.set(result.user);
  }

  await createSession(idToken);
  redirect(roleHomePath(result.user.role));
}

export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
