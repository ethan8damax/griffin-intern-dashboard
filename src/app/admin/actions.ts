"use server";

import { revalidatePath } from "next/cache";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { EngagementDoc, InviteDoc } from "@/lib/auth/types";

export async function createEngagement(formData: FormData): Promise<void> {
  await requireRole("companyAdmin");

  const name = String(formData.get("name") ?? "").trim();
  const client = String(formData.get("client") ?? "").trim();
  if (!name || !client) {
    throw new Error("Engagement name and client are required.");
  }

  const engagement: EngagementDoc = {
    name,
    client,
    leadUserId: "",
    status: "active",
    createdAt: Date.now(),
  };
  await getAdminDb().collection("engagements").add(engagement);
  revalidatePath("/admin");
}

export async function createInvite(
  formData: FormData
): Promise<{ link: string }> {
  await requireRole("companyAdmin");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const engagementId = String(formData.get("engagementId") ?? "").trim();
  if (!email || !name || !engagementId) {
    throw new Error("Name, email, and engagement are required.");
  }

  const engagementSnapshot = await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .get();
  if (!engagementSnapshot.exists) {
    throw new Error("That engagement no longer exists.");
  }

  const invite: InviteDoc = {
    email,
    name,
    role: "engagementLead",
    engagementId,
    createdAt: Date.now(),
    usedAt: null,
  };
  await getAdminDb().collection("invites").add(invite);

  const link = await getAdminAuth().generateSignInWithEmailLink(email, {
    url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    handleCodeInApp: true,
  });

  revalidatePath("/admin");
  return { link };
}
