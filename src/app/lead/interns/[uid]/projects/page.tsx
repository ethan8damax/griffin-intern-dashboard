import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { addProject, updateProject, deleteProject } from "../projects-actions";
import type { ProjectDoc, UserDoc } from "@/lib/auth/types";

export default async function InternProjectsPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const lead = await requireRole("engagementLead");

  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    notFound();
  }
  const targetUser = userSnapshot.data() as UserDoc;
  if (!isOwnedIntern(targetUser, lead.engagementId ?? "")) {
    notFound();
  }

  const projectsSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("projects")
    .get();
  const projects = projectsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ProjectDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <form action={updateProject}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="projectId" value={project.id} />
              <label>
                Name
                <input name="name" defaultValue={project.name} required />
              </label>
              <label>
                Assigned by
                <input name="assignedBy" defaultValue={project.assignedBy} />
              </label>
              <label>
                Status
                <select name="status" defaultValue={project.status}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <label>
                Due date
                <input type="date" name="dueDate" defaultValue={project.dueDate} />
              </label>
              <label>
                GitHub repo
                <input name="githubRepo" defaultValue={project.githubRepo} />
              </label>
              <label>
                Jira ticket
                <input name="jiraTicket" defaultValue={project.jiraTicket} />
              </label>
              <label>
                Project link
                <input name="projectLink" defaultValue={project.projectLink} />
              </label>
              <label>
                Deliverables
                <textarea name="deliverables" defaultValue={project.deliverables} />
              </label>
              <label>
                Estimated time
                <input name="estimatedTime" defaultValue={project.estimatedTime} />
              </label>
              <label>
                Priority
                <select name="priority" defaultValue={project.priority}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </label>
              <button type="submit">Save</button>
            </form>
            <form action={deleteProject}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="projectId" value={project.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a project</h2>
      <form action={addProject}>
        <input type="hidden" name="uid" value={uid} />
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Assigned by
          <input name="assignedBy" />
        </label>
        <label>
          Due date
          <input type="date" name="dueDate" />
        </label>
        <label>
          GitHub repo
          <input name="githubRepo" />
        </label>
        <label>
          Jira ticket
          <input name="jiraTicket" />
        </label>
        <label>
          Project link
          <input name="projectLink" />
        </label>
        <label>
          Deliverables
          <textarea name="deliverables" />
        </label>
        <label>
          Estimated time
          <input name="estimatedTime" />
        </label>
        <label>
          Priority
          <select name="priority" defaultValue="Medium">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
