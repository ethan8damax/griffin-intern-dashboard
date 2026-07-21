import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { resolveLinkedGoal } from "@/lib/goals";
import { addPriority, updatePriority, deletePriority } from "../priorities-actions";
import type { GoalDoc, PriorityDoc } from "@/lib/auth/types";

export default async function InternPrioritiesPage() {
  const user = await requireRole("intern");
  const db = getAdminDb();

  const prioritiesSnapshot = await db
    .collection("users")
    .doc(user.uid)
    .collection("priorities")
    .get();
  const priorities = prioritiesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as PriorityDoc),
  }));

  const resolvedGoals = await Promise.all(
    priorities.map((priority) =>
      resolveLinkedGoal(
        priority.linkedGoalId,
        async (id) => {
          const snapshot = await db.collection("users").doc(user.uid).collection("goals").doc(id).get();
          return snapshot.exists ? (snapshot.data() as GoalDoc) : null;
        },
        async () => null // team goals arrive in Sprint 3.1b
      )
    )
  );

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your priorities</h1>
      <ul>
        {priorities.map((priority, index) => (
          <li key={priority.id}>
            <form action={updatePriority}>
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
            {resolvedGoals[index] && (
              <p>
                Linked to {resolvedGoals[index]!.scope} goal: {resolvedGoals[index]!.objective}
              </p>
            )}
            <form action={deletePriority}>
              <input type="hidden" name="priorityId" value={priority.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a priority</h2>
      <form action={addPriority}>
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
