// src/app/lead/team-goals-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireLeadEngagementId } from "@/lib/auth/ownership";
import { GOAL_STATUSES, parsePercent, type TeamGoalDoc } from "@/lib/auth/types";

function parseKrs(raw: string): { id: string; text: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: String(index), text }));
}

export async function addTeamGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const objective = String(formData.get("objective") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const krs = parseKrs(String(formData.get("krs") ?? ""));
  if (!objective) {
    throw new Error("Missing objective.");
  }

  const goal: TeamGoalDoc = {
    objective,
    status: "gray",
    targetDate,
    progress: 0,
    krs,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("engagements").doc(engagementId).collection("goals").add(goal);
  revalidatePath("/lead/team-goals");
}

export async function updateTeamGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const goalId = String(formData.get("goalId") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const progress = parsePercent(String(formData.get("progress") ?? "0"), "Progress");
  const krs = parseKrs(String(formData.get("krs") ?? ""));
  if (!goalId || !objective) {
    throw new Error("Missing goal id or objective.");
  }
  if (!GOAL_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }

  await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("goals")
    .doc(goalId)
    .update({ objective, status, targetDate, progress, krs });
  revalidatePath("/lead/team-goals");
}

export async function deleteTeamGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);
  const goalId = String(formData.get("goalId") ?? "").trim();
  if (!goalId) {
    throw new Error("Missing goal id.");
  }

  await getAdminDb().collection("engagements").doc(engagementId).collection("goals").doc(goalId).delete();
  revalidatePath("/lead/team-goals");
}
