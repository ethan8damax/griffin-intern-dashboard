// src/app/intern/goals-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { GOAL_STATUSES, parsePercent } from "@/lib/auth/types";

export async function updateGoalStatus(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const goalId = String(formData.get("goalId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!goalId) {
    throw new Error("Missing goal id.");
  }
  if (!GOAL_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  const progress = parsePercent(String(formData.get("progress") ?? "0"), "Progress");

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("goals")
    .doc(goalId)
    .update({ status, progress });
  revalidatePath("/intern/goals");
}
