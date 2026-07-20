import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { addPriority, updatePriority, deletePriority } from "../priorities-actions";
import type { PriorityDoc, UserDoc } from "@/lib/auth/types";

export default async function InternPrioritiesPage({
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

  const prioritiesSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("priorities")
    .get();
  const priorities = prioritiesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as PriorityDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s priorities</h1>
      <ul>
        {priorities.map((priority) => (
          <li key={priority.id}>
            <form action={updatePriority}>
              <input type="hidden" name="uid" value={uid} />
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
            <form action={deletePriority}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="priorityId" value={priority.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a priority</h2>
      <form action={addPriority}>
        <input type="hidden" name="uid" value={uid} />
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
