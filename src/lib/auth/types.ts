export type UserRole = "companyAdmin" | "engagementLead" | "intern";

export interface UserDoc {
  email: string;
  name: string;
  role: UserRole;
  engagementId?: string;
  createdAt: number;
}

export interface EngagementDoc {
  name: string;
  client: string;
  leadUserId: string;
  status: "active" | "archived";
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
