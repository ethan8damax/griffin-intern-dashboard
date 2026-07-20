import { describe, expect, it } from "vitest";
import { standardMilestones } from "./timeline-seed";

describe("standardMilestones", () => {
  it("seeds kickoff dated today, mid-point and final review as TBD", () => {
    const milestones = standardMilestones(1000);

    expect(milestones).toEqual([
      { title: "Kickoff", date: 1000, status: "upcoming", kind: "standard", createdAt: 1000 },
      { title: "Mid-point check-in", date: null, status: "upcoming", kind: "standard", createdAt: 1000 },
      { title: "Final review", date: null, status: "upcoming", kind: "standard", createdAt: 1000 },
    ]);
  });

  it("always seeds exactly 3 milestones, all standard kind and upcoming status", () => {
    const milestones = standardMilestones(2000);

    expect(milestones).toHaveLength(3);
    for (const milestone of milestones) {
      expect(milestone.kind).toBe("standard");
      expect(milestone.status).toBe("upcoming");
    }
  });
});
