// src/app/lead/team-priorities/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireEngagementId } from "@/lib/auth/ownership";
import { addTeamPriority, updateTeamPriority, deleteTeamPriority } from "../team-priorities-actions";
import type { TeamPriorityDoc } from "@/lib/auth/types";

export default async function TeamPrioritiesPage() {
  const lead = await requireRole("engagementLead");
  const engagementId = requireEngagementId(lead);

  const prioritiesSnapshot = await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("priorities")
    .get();
  const priorities = prioritiesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as TeamPriorityDoc),
  }));

  return (
    <main>
      <p>
        <a href="/lead">← Back</a>
      </p>
      <h1>Team priorities</h1>
      <ul>
        {priorities.map((priority) => (
          <li key={priority.id}>
            <form action={updateTeamPriority}>
              <input type="hidden" name="priorityId" value={priority.id} />
              <label>
                Text
                <input name="text" defaultValue={priority.text} required />
              </label>
              <label>
                Status
                <select name="status" defaultValue={priority.status}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <label>
                Linked goal id
                <input name="linkedGoalId" defaultValue={priority.linkedGoalId ?? ""} />
              </label>
              <button type="submit">Save</button>
            </form>
            <form action={deleteTeamPriority}>
              <input type="hidden" name="priorityId" value={priority.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a team priority</h2>
      <form action={addTeamPriority}>
        <label>
          Text
          <input name="text" required />
        </label>
        <label>
          Week of
          <input type="date" name="weekOf" required />
        </label>
        <label>
          Linked goal id
          <input name="linkedGoalId" />
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
