import type { MilestoneDoc } from "./types";

export function standardMilestones(createdAt: number): MilestoneDoc[] {
  return [
    { title: "Kickoff", date: createdAt, status: "upcoming", kind: "standard", createdAt },
    { title: "Mid-point check-in", date: null, status: "upcoming", kind: "standard", createdAt },
    { title: "Final review", date: null, status: "upcoming", kind: "standard", createdAt },
  ];
}
