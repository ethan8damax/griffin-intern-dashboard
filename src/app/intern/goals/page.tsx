// src/app/intern/goals/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { updateGoalStatus } from "../goals-actions";
import type { GoalDoc } from "@/lib/auth/types";

export default async function InternGoalsPage() {
  const user = await requireRole("intern");

  const goalsSnapshot = await getAdminDb()
    .collection("users")
    .doc(user.uid)
    .collection("goals")
    .get();
  const goals = goalsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as GoalDoc),
  }));

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Your goals</h1>
      <ul>
        {goals.map((goal) => (
          <li key={goal.id}>
            <p>{goal.objective}</p>
            <p>Target: {goal.targetDate || "TBD"}</p>
            <ul>
              {goal.krs.map((kr) => (
                <li key={kr.id}>{kr.text}</li>
              ))}
            </ul>
            <form action={updateGoalStatus}>
              <input type="hidden" name="goalId" value={goal.id} />
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
                Progress
                <input
                  type="number"
                  name="progress"
                  min={0}
                  max={100}
                  defaultValue={goal.progress}
                />
              </label>
              <button type="submit">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
