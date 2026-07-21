import { describe, expect, it } from "vitest";
import { resolveLinkedGoal } from "./goals";

describe("resolveLinkedGoal", () => {
  it("returns null when linkedGoalId is null", async () => {
    const result = await resolveLinkedGoal(
      null,
      async () => ({ objective: "unused" }),
      async () => ({ objective: "unused" })
    );
    expect(result).toBeNull();
  });

  it("resolves an individual goal when the individual fetcher finds one", async () => {
    const result = await resolveLinkedGoal(
      "goal-1",
      async () => ({ objective: "Ship the migration" }),
      async () => null
    );
    expect(result).toEqual({ objective: "Ship the migration", scope: "individual" });
  });

  it("falls back to the team fetcher when no individual goal is found", async () => {
    const result = await resolveLinkedGoal(
      "goal-2",
      async () => null,
      async () => ({ objective: "Team-wide onboarding" })
    );
    expect(result).toEqual({ objective: "Team-wide onboarding", scope: "team" });
  });

  it("returns null when neither fetcher finds the goal", async () => {
    const result = await resolveLinkedGoal(
      "goal-missing",
      async () => null,
      async () => null
    );
    expect(result).toBeNull();
  });
});
