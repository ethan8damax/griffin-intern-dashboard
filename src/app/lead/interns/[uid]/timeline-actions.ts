// src/app/lead/interns/[uid]/timeline-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { MilestoneDoc, UserDoc } from "@/lib/auth/types";

async function assertOwnedIntern(
  uid: string,
  leadEngagementId: string
): Promise<void> {
  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    throw new Error("Intern not found.");
  }
  const targetUser = userSnapshot.data() as UserDoc;
  if (targetUser.role !== "intern" || targetUser.engagementId !== leadEngagementId) {
    // Same message as the "doesn't exist" case above — don't let a lead
    // distinguish "wrong engagement" from "no such record" for a uid they
    // already hold, matching the collapsed-message convention in
    // src/app/lead/actions.ts.
    throw new Error("Intern not found.");
  }
}

function parseDateInput(dateInput: string): number | null {
  if (!dateInput) return null;
  const parsed = new Date(dateInput).getTime();
  if (Number.isNaN(parsed)) {
    throw new Error("Invalid date.");
  }
  return parsed;
}

export async function addMilestone(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const date = parseDateInput(String(formData.get("date") ?? "").trim());
  if (!uid || !title) {
    throw new Error("Missing intern id or title.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "");

  const milestone: MilestoneDoc = {
    title,
    date,
    status: "upcoming",
    kind: "custom",
    createdAt: Date.now(),
    notes: notes || null,
  };
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .add(milestone);
  revalidatePath(`/lead/interns/${uid}`);
}

export async function updateMilestone(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const milestoneId = String(formData.get("milestoneId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const date = parseDateInput(String(formData.get("date") ?? "").trim());
  if (!uid || !milestoneId || !title) {
    throw new Error("Missing intern id, milestone id, or title.");
  }
  if (status !== "upcoming" && status !== "complete") {
    throw new Error("Invalid status.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .doc(milestoneId)
    .update({ title, date, status, notes: notes || null });
  revalidatePath(`/lead/interns/${uid}`);
}

export async function deleteMilestone(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const milestoneId = String(formData.get("milestoneId") ?? "").trim();
  if (!uid || !milestoneId) {
    throw new Error("Missing intern id or milestone id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .doc(milestoneId)
    .delete();
  revalidatePath(`/lead/interns/${uid}`);
}
