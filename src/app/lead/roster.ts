import type { InviteDoc, UserDoc } from "@/lib/auth/types";

type RosterRowState = "invited" | "active" | "removed";

interface RosterRow {
  key: string;
  name: string;
  email: string;
  state: RosterRowState;
  uid?: string;
  inviteId?: string;
}

export function buildRosterRows(
  interns: (UserDoc & { uid: string })[],
  invites: (InviteDoc & { id: string })[]
): RosterRow[] {
  const rows: RosterRow[] = [];

  for (const intern of interns) {
    rows.push({
      key: intern.uid,
      name: intern.name,
      email: intern.email,
      state: intern.status === "removed" ? "removed" : "active",
      uid: intern.uid,
    });
  }

  for (const invite of invites) {
    rows.push({
      key: invite.id,
      name: invite.name,
      email: invite.email,
      state: "invited",
      inviteId: invite.id,
    });
  }

  return rows;
}
