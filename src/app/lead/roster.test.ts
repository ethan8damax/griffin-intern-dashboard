import { describe, expect, it } from "vitest";
import { buildRosterRows } from "./roster";

describe("buildRosterRows", () => {
  it("marks an active intern as active", () => {
    const rows = buildRosterRows(
      [
        {
          uid: "u1",
          email: "intern@example.com",
          name: "Intern One",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          status: "active",
        },
      ],
      []
    );
    expect(rows).toEqual([
      {
        key: "u1",
        name: "Intern One",
        email: "intern@example.com",
        state: "active",
        uid: "u1",
      },
    ]);
  });

  it("marks a removed intern as removed, not hidden", () => {
    const rows = buildRosterRows(
      [
        {
          uid: "u2",
          email: "removed@example.com",
          name: "Removed Intern",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          status: "removed",
        },
      ],
      []
    );
    expect(rows).toEqual([
      {
        key: "u2",
        name: "Removed Intern",
        email: "removed@example.com",
        state: "removed",
        uid: "u2",
      },
    ]);
  });

  it("marks a pending invite as invited", () => {
    const rows = buildRosterRows(
      [],
      [
        {
          id: "inv-1",
          email: "pending@example.com",
          name: "Pending Intern",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          usedAt: null,
        },
      ]
    );
    expect(rows).toEqual([
      {
        key: "inv-1",
        name: "Pending Intern",
        email: "pending@example.com",
        state: "invited",
        inviteId: "inv-1",
      },
    ]);
  });

  it("combines interns and invites into one roster, interns first", () => {
    const rows = buildRosterRows(
      [
        {
          uid: "u1",
          email: "a@example.com",
          name: "A",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          status: "active",
        },
      ],
      [
        {
          id: "inv-1",
          email: "b@example.com",
          name: "B",
          role: "intern",
          engagementId: "eng-1",
          createdAt: 1,
          usedAt: null,
        },
      ]
    );
    expect(rows.map((r) => r.key)).toEqual(["u1", "inv-1"]);
  });
});
