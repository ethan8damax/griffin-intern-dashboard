// src/app/lead/reviews-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireEngagementId, assertOwnedIntern } from "@/lib/auth/ownership";
import type { ReviewDoc } from "@/lib/auth/types";

export async function createReview(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const engagementId = requireEngagementId(lead);
  const subjectUserId = String(formData.get("subjectUserId") ?? "").trim();
  const reviewerName = String(formData.get("reviewerName") ?? "").trim();
  const reviewerRole = String(formData.get("reviewerRole") ?? "").trim();
  if (!subjectUserId || !reviewerName) {
    throw new Error("Missing intern id or reviewer name.");
  }
  await assertOwnedIntern(subjectUserId, engagementId, "Intern not found.");

  const review: ReviewDoc = {
    token: Math.random().toString(36).slice(2, 10),
    subjectUserId,
    reviewerName,
    reviewerRole,
    status: "pending",
    requestedDate: new Date().toISOString().slice(0, 10),
    questions: [],
    createdAt: Date.now(),
  };
  await getAdminDb().collection("engagements").doc(engagementId).collection("reviews").add(review);
  revalidatePath("/lead/reviews");
}
