export type UserRole = "companyAdmin" | "engagementLead" | "intern";

export interface UserDoc {
  email: string;
  name: string;
  role: UserRole;
  engagementId?: string;
  createdAt: number;
  status: "active" | "removed";
}

export interface EngagementDoc {
  name: string;
  client: string;
  leadUserId: string;
  status: "active"; // ponytail: no archival flow reads/writes anything else yet, widen when one exists
  createdAt: number;
}

export interface InviteDoc {
  email: string;
  name: string;
  role: UserRole;
  engagementId?: string;
  createdAt: number;
  usedAt: number | null;
}

export interface MilestoneDoc {
  title: string;
  date: number | null; // epoch ms; null = not yet dated ("TBD")
  status: "upcoming" | "complete";
  kind: "standard" | "custom";
  notes?: string;
  createdAt: number;
}
