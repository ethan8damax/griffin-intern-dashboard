// src/app/lead/interns/[uid]/goals-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import { GOAL_STATUSES, type GoalDoc } from "@/lib/auth/types";

function parseKrs(raw: string): { id: string; text: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: String(index), text }));
}

function parseProgress(raw: string): number {
  const progress = Number(raw);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error("Progress must be a number between 0 and 100.");
  }
  return progress;
}

export async function addGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const krs = parseKrs(String(formData.get("krs") ?? ""));
  if (!uid || !objective) {
    throw new Error("Missing intern id or objective.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const goal: GoalDoc = {
    objective,
    status: "gray",
    targetDate,
    progress: 0,
    krs,
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(uid).collection("goals").add(goal);
  revalidatePath(`/lead/interns/${uid}/goals`);
}

export async function updateGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const goalId = String(formData.get("goalId") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const progress = parseProgress(String(formData.get("progress") ?? "0"));
  const krs = parseKrs(String(formData.get("krs") ?? ""));
  if (!uid || !goalId || !objective) {
    throw new Error("Missing intern id, goal id, or objective.");
  }
  if (!GOAL_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("goals")
    .doc(goalId)
    .update({ objective, status, targetDate, progress, krs });
  revalidatePath(`/lead/interns/${uid}/goals`);
}

export async function deleteGoal(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const goalId = String(formData.get("goalId") ?? "").trim();
  if (!uid || !goalId) {
    throw new Error("Missing intern id or goal id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb().collection("users").doc(uid).collection("goals").doc(goalId).delete();
  revalidatePath(`/lead/interns/${uid}/goals`);
}
