// src/app/lead/interns/[uid]/goals/page.tsx
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { isOwnedIntern } from "@/lib/auth/ownership";
import { addGoal, updateGoal, deleteGoal } from "../goals-actions";
import type { GoalDoc, UserDoc } from "@/lib/auth/types";

export default async function InternGoalsPage({
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

  const goalsSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("goals")
    .get();
  const goals = goalsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as GoalDoc),
  }));

  return (
    <main>
      <p>
        <a href={`/lead/interns/${uid}`}>← Back to {targetUser.name}&apos;s timeline</a>
      </p>
      <h1>{targetUser.name}&apos;s goals</h1>
      <ul>
        {goals.map((goal) => (
          <li key={goal.id}>
            <form action={updateGoal}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="goalId" value={goal.id} />
              <label>
                Objective
                <input name="objective" defaultValue={goal.objective} required />
              </label>
              <label>
                Status
                <select name="status" defaultValue={goal.status}>
                  <option value="gray">Gray</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
              </label>
              <label>
                Target date
                <input type="date" name="targetDate" defaultValue={goal.targetDate} />
              </label>
              <label>
                Progress
                <input
                  type="number"
                  name="progress"
                  min={0}
                  max={100}
                  defaultValue={goal.progress}
                />
              </label>
              <label>
                Key results (one per line)
                <textarea
                  name="krs"
                  defaultValue={goal.krs.map((kr) => kr.text).join("\n")}
                />
              </label>
              <button type="submit">Save</button>
            </form>
            <form action={deleteGoal}>
              <input type="hidden" name="uid" value={uid} />
              <input type="hidden" name="goalId" value={goal.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a goal</h2>
      <form action={addGoal}>
        <input type="hidden" name="uid" value={uid} />
        <label>
          Objective
          <input name="objective" required />
        </label>
        <label>
          Target date
          <input type="date" name="targetDate" />
        </label>
        <label>
          Key results (one per line)
          <textarea name="krs" />
        </label>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
