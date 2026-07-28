// src/app/intern/team-priorities/page.tsx
import { getAdminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth/dal";
import type { TeamPriorityDoc } from "@/lib/auth/types";

export default async function InternTeamPrioritiesPage() {
  const user = await requireRole("intern");

  let priorities: (TeamPriorityDoc & { id: string })[] = [];
  if (user.engagementId) {
    const prioritiesSnapshot = await getAdminDb()
      .collection("engagements")
      .doc(user.engagementId)
      .collection("priorities")
      .get();
    priorities = prioritiesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as TeamPriorityDoc),
    }));
  }

  return (
    <main>
      <p>
        <a href="/intern">← Back</a>
      </p>
      <h1>Team priorities</h1>
      <ul>
        {priorities.map((priority) => (
          <li key={priority.id}>
            {priority.weekOf} — {priority.text} ({priority.status})
          </li>
        ))}
      </ul>
    </main>
  );
}
