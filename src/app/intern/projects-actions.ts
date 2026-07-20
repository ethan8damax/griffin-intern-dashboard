"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { PROJECT_STATUSES } from "@/lib/auth/types";

export async function updateProjectStatus(formData: FormData): Promise<void> {
  const user = await requireRole("intern");
  const projectId = String(formData.get("projectId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!projectId) {
    throw new Error("Missing project id.");
  }
  if (!PROJECT_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }

  await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("projects")
    .doc(projectId)
    .update({ status });
  revalidatePath("/intern/projects");
}
