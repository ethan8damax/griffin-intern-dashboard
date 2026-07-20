// src/app/intern/goals-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { GOAL_STATUSES } from "@/lib/auth/types";

export async function updateGoalStatus(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const goalId = String(formData.get("goalId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const progress = Number(formData.get("progress") ?? 0);
  if (!goalId) {
    throw new Error("Missing goal id.");
  }
  if (!GOAL_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error("Progress must be a number between 0 and 100.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("goals")
    .doc(goalId)
    .update({ status, progress });
  revalidatePath("/intern/goals");
}
