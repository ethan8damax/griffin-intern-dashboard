import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { updateProjectStatus } from "../projects-actions";
import type { ProjectDoc } from "@/lib/auth/types";

export default async function InternProjectsPage() {
  const user = await requireRole("intern");

  const projectsSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("projects")
    .get();
  const projects = projectsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ProjectDoc),
  }));

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <p>
              {project.name} — assigned by {project.assignedBy || "unknown"}, due{" "}
              {project.dueDate || "TBD"}, priority {project.priority}
            </p>
            <form action={updateProjectStatus}>
              <input type="hidden" name="projectId" value={project.id} />
              <label>
                Status
                <select name="status" defaultValue={project.status}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <button type="submit">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
