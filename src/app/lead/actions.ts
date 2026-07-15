"use server";

import { revalidatePath } from "next/cache";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { InviteDoc, UserDoc } from "@/lib/auth/types";

function assertSameEngagement(
  resourceEngagementId: string | undefined,
  leadEngagementId: string,
  notFoundMessage: string
): void {
  if (resourceEngagementId !== leadEngagementId) {
    // Same message as the "doesn't exist" case above — don't let a lead
    // distinguish "wrong engagement" from "no such record" for an id they
    // already hold, matching the collapsed-message convention in
    // src/lib/auth/actions.ts's completeSignIn.
    throw new Error(notFoundMessage);
  }
}

export async function inviteIntern(
  formData: FormData
): Promise<{ link: string }> {
  const lead = await requireRole("engagementLead");
  const engagementId = lead.engagementId;
  if (!engagementId) {
    throw new Error("You are not assigned to an engagement.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email || !name) {
    throw new Error("Name and email are required.");
  }

  const adminDb = getAdminDb();
  const existingInviteQuery = await adminDb
    .collection("invites")
    .where("email", "==", email)
    .where("engagementId", "==", engagementId)
    .where("usedAt", "==", null)
    .limit(1)
    .get();

  if (existingInviteQuery.empty) {
    const invite: InviteDoc = {
      email,
      name,
      role: "intern",
      engagementId,
      createdAt: Date.now(),
      usedAt: null,
    };
    await adminDb.collection("invites").add(invite);
    revalidatePath("/lead");
  }

  const link = await getAdminAuth().generateSignInWithEmailLink(email, {
    url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    handleCodeInApp: true,
  });

  return { link };
}

export async function removeIntern(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) {
    throw new Error("Missing intern id.");
  }

  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new Error("Intern not found.");
  }
  const targetUser = userSnapshot.data() as UserDoc;
  assertSameEngagement(targetUser.engagementId, lead.engagementId ?? "", "Intern not found.");
  if (targetUser.role !== "intern") {
    throw new Error("Intern not found.");
  }

  await userRef.update({ status: "removed" });
  revalidatePath("/lead");
}

export async function reactivateIntern(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) {
    throw new Error("Missing intern id.");
  }

  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new Error("Intern not found.");
  }
  const targetUser = userSnapshot.data() as UserDoc;
  assertSameEngagement(targetUser.engagementId, lead.engagementId ?? "", "Intern not found.");
  if (targetUser.role !== "intern") {
    throw new Error("Intern not found.");
  }

  await userRef.update({ status: "active" });
  revalidatePath("/lead");
}

export async function cancelInvite(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  if (!inviteId) {
    throw new Error("Missing invite id.");
  }

  const adminDb = getAdminDb();
  const inviteRef = adminDb.collection("invites").doc(inviteId);
  const inviteSnapshot = await inviteRef.get();
  if (!inviteSnapshot.exists) {
    throw new Error("Invite not found.");
  }
  const invite = inviteSnapshot.data() as InviteDoc;
  assertSameEngagement(invite.engagementId, lead.engagementId ?? "", "Invite not found.");

  await inviteRef.delete();
  revalidatePath("/lead");
}
