// src/app/lead/team-priorities-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireLeadEngagementId } from "@/lib/auth/ownership";
import { PRIORITY_STATUSES, type TeamPriorityDoc } from "@/lib/auth/types";

export async function addTeamPriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const text = String(formData.get("text") ?? "").trim();
  const weekOf = String(formData.get("weekOf") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!text || !weekOf) {
    throw new Error("Missing text or week.");
  }

  const priority: TeamPriorityDoc = {
    text,
    weekOf,
    status: "Not Started",
    linkedGoalId,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("engagements").doc(engagementId).collection("priorities").add(priority);
  revalidatePath("/lead/team-priorities");
}

export async function updateTeamPriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const linkedGoalId = String(formData.get("linkedGoalId") ?? "").trim() || null;
  if (!priorityId || !text) {
    throw new Error("Missing priority id or text.");
  }
  if (!PRIORITY_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }

  await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("priorities")
    .doc(priorityId)
    .update({ text, status, linkedGoalId });
  revalidatePath("/lead/team-priorities");
}

export async function deleteTeamPriority(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const priorityId = String(formData.get("priorityId") ?? "").trim();
  if (!priorityId) {
    throw new Error("Missing priority id.");
  }

  await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("priorities")
    .doc(priorityId)
    .delete();
  revalidatePath("/lead/team-priorities");
}
