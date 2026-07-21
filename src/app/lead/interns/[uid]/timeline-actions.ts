// src/app/lead/interns/[uid]/timeline-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import type { MilestoneDoc } from "@/lib/auth/types";

function parseDateInput(dateInput: string): number | null {
  if (!dateInput) return null;
  // `new Date("YYYY-MM-DD")` parses as UTC midnight per the ECMA-262 spec, which
  // silently shifts a day earlier once rendered back in a timezone behind UTC.
  // This value is a plain calendar date with no time-of-day meaning (matches
  // Kickoff's Date.now()-based seeding, which is "today" in local time) — parse
  // the components as local midnight instead so it round-trips consistently
  // through dateInputValue()/formatDate() in src/components/timeline.tsx.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (!match) {
    throw new Error("Invalid date.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);
  // The multi-arg Date constructor never returns Invalid Date for finite
  // numbers — it rolls an out-of-range day/month over into a different,
  // wrong-but-valid date instead (e.g. month 13 → next January). Comparing
  // its own getters back against the input catches that silent overflow.
  const roundTrips =
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day;
  if (!roundTrips) {
    throw new Error("Invalid date.");
  }
  return parsedDate.getTime();
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
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

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
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

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
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("timeline")
    .doc(milestoneId)
    .delete();
  revalidatePath(`/lead/interns/${uid}`);
}
