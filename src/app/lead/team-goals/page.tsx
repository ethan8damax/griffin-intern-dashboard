// src/app/lead/team-goals/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import { requireLeadEngagementId } from "@/lib/auth/ownership";
import { addTeamGoal, updateTeamGoal, deleteTeamGoal } from "../team-goals-actions";
import type { TeamGoalDoc } from "@/lib/auth/types";

export default async function TeamGoalsPage() {
  const lead = await requireRole("engagementLead");
  const engagementId = requireLeadEngagementId(lead);

  const goalsSnapshot = await getAdminDb()
    .collection("engagements")
    .doc(engagementId)
    .collection("goals")
    .get();
  const goals = goalsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as TeamGoalDoc),
  }));

  return (
    <main>
      <p>
        <a href="/lead">← Back</a>
      </p>
      <h1>Team goals</h1>
      <ul>
        {goals.map((goal) => (
          <li key={goal.id}>
            <form action={updateTeamGoal}>
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
            <form action={deleteTeamGoal}>
              <input type="hidden" name="goalId" value={goal.id} />
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Add a team goal</h2>
      <form action={addTeamGoal}>
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
