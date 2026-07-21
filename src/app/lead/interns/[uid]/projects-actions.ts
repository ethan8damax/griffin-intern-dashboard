"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { assertOwnedIntern } from "@/lib/auth/ownership";
import { PROJECT_STATUSES, PROJECT_PRIORITIES, type ProjectDoc } from "@/lib/auth/types";

function readProjectFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    assignedBy: String(formData.get("assignedBy") ?? "").trim(),
    dueDate: String(formData.get("dueDate") ?? "").trim(),
    githubRepo: String(formData.get("githubRepo") ?? "").trim(),
    jiraTicket: String(formData.get("jiraTicket") ?? "").trim(),
    projectLink: String(formData.get("projectLink") ?? "").trim(),
    deliverables: String(formData.get("deliverables") ?? "").trim(),
    estimatedTime: String(formData.get("estimatedTime") ?? "").trim(),
    priority: String(formData.get("priority") ?? "Medium").trim(),
  };
}

export async function addProject(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const fields = readProjectFields(formData);
  if (!uid || !fields.name) {
    throw new Error("Missing intern id or project name.");
  }
  if (!PROJECT_PRIORITIES.includes(fields.priority)) {
    throw new Error("Invalid priority.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  const project: ProjectDoc = {
    ...fields,
    priority: fields.priority as ProjectDoc["priority"],
    status: "Not Started",
    createdAt: Date.now(),
  };
  await getAdminDb().collection("users").doc(uid).collection("projects").add(project);
  revalidatePath(`/lead/interns/${uid}/projects`);
}

export async function updateProject(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const fields = readProjectFields(formData);
  if (!uid || !projectId || !fields.name) {
    throw new Error("Missing intern id, project id, or name.");
  }
  if (!PROJECT_STATUSES.includes(status)) {
    throw new Error("Invalid status.");
  }
  if (!PROJECT_PRIORITIES.includes(fields.priority)) {
    throw new Error("Invalid priority.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("projects")
    .doc(projectId)
    .update({ ...fields, priority: fields.priority as ProjectDoc["priority"], status: status as ProjectDoc["status"] });
  revalidatePath(`/lead/interns/${uid}/projects`);
}

export async function deleteProject(formData: FormData): Promise<void> {
  const lead = await requireRole("engagementLead");
  const uid = String(formData.get("uid") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!uid || !projectId) {
    throw new Error("Missing intern id or project id.");
  }
  await assertOwnedIntern(uid, lead.engagementId ?? "", "Intern not found.");

  await getAdminDb().collection("users").doc(uid).collection("projects").doc(projectId).delete();
  revalidatePath(`/lead/interns/${uid}/projects`);
}
