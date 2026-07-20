export interface ResolvedGoal {
  objective: string;
  scope: "individual" | "team";
}

export async function resolveLinkedGoal(
  linkedGoalId: string | null,
  fetchIndividualGoal: (id: string) => Promise<{ objective: string } | null>,
  fetchTeamGoal: (id: string) => Promise<{ objective: string } | null>
): Promise<ResolvedGoal | null> {
  if (!linkedGoalId) return null;

  const individual = await fetchIndividualGoal(linkedGoalId);
  if (individual) {
    return { objective: individual.objective, scope: "individual" };
  }

  const team = await fetchTeamGoal(linkedGoalId);
  if (team) {
    return { objective: team.objective, scope: "team" };
  }

  return null;
}
