// src/app/intern/team-goals/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { TeamGoalDoc } from "@/lib/auth/types";

export default async function InternTeamGoalsPage() {
  const user = await requireRole("intern");

  let goals: (TeamGoalDoc & { id: string })[] = [];
  if (user.engagementId) {
    const goalsSnapshot = await getAdminDb()
      .collection("engagements")
      .doc(user.engagementId)
      .collection("goals")
      .get();
    goals = goalsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as TeamGoalDoc),
    }));
  }

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Team goals</h1>
      <ul>
        {goals.map((goal) => (
          <li key={goal.id}>
            <p>
              {goal.objective} — {goal.status}, {goal.progress}%, target{" "}
              {goal.targetDate || "TBD"}
            </p>
            <ul>
              {goal.krs.map((kr) => (
                <li key={kr.id}>{kr.text}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
