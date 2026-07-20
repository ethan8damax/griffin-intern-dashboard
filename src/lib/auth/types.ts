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
  notes?: string | null;
  createdAt: number;
}

export interface GoalDoc {
  objective: string;
  status: "green" | "yellow" | "red" | "gray";
  targetDate: string; // "YYYY-MM-DD"
  progress: number; // 0-100, manually set — no formula, same as today
  krs: { id: string; text: string }[];
  createdAt: number;
}

export interface JournalEntryDoc {
  date: string; // "YYYY-MM-DD"
  type: "win" | "blocker" | "checkin" | "note";
  text: string;
  createdAt: number;
}

export interface PriorityDoc {
  text: string;
  weekOf: string; // "YYYY-MM-DD", Monday of the week
  status: "Done" | "In Progress" | "Not Started" | "Blocked";
  linkedGoalId: string | null;
  createdAt: number;
}

export interface ProjectDoc {
  name: string;
  assignedBy: string;
  status: "Not Started" | "In Progress" | "Complete" | "Blocked";
  dueDate: string;
  githubRepo: string;
  jiraTicket: string;
  projectLink: string;
  deliverables: string;
  estimatedTime: string;
  priority: "Low" | "Medium" | "High";
  createdAt: number;
}

export interface ProfileDoc {
  role: string;
  manager: string;
  department: string;
  startDate: string;
  bio: string;
  capacity: number; // 0-100, "Current Capacity" — lead-set, no formula
}
