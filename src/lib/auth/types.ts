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

// Single source of truth for GoalDoc["status"]'s valid values, so lead/intern
// Server Actions validate against one array instead of two hand-kept copies.
// Typed as readonly string[] (not the literal union) so callers can pass a
// plain FormData string straight to .includes() without a cast; the
// `satisfies` check below still catches drift from GoalDoc at compile time.
const GOAL_STATUS_VALUES = ["green", "yellow", "red", "gray"] satisfies GoalDoc["status"][];
export const GOAL_STATUSES: readonly string[] = GOAL_STATUS_VALUES;

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

// Single source of truth for PriorityDoc["status"]'s valid values, so lead/intern
// Server Actions validate against one array instead of two hand-kept copies.
// See GOAL_STATUSES above for why this is typed readonly string[].
const PRIORITY_STATUS_VALUES = ["Done", "In Progress", "Not Started", "Blocked"] satisfies PriorityDoc["status"][];
export const PRIORITY_STATUSES: readonly string[] = PRIORITY_STATUS_VALUES;

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

// Single source of truth for ProjectDoc["status"]'s valid values, so lead/intern
// Server Actions validate against one array instead of two hand-kept copies.
// See GOAL_STATUSES above for why this is typed readonly string[].
const PROJECT_STATUS_VALUES = ["Not Started", "In Progress", "Complete", "Blocked"] satisfies ProjectDoc["status"][];
export const PROJECT_STATUSES: readonly string[] = PROJECT_STATUS_VALUES;

// Single source of truth for ProjectDoc["priority"]'s valid values.
const PROJECT_PRIORITY_VALUES = ["Low", "Medium", "High"] satisfies ProjectDoc["priority"][];
export const PROJECT_PRIORITIES: readonly string[] = PROJECT_PRIORITY_VALUES;

export interface ProfileDoc {
  role: string;
  manager: string;
  department: string;
  startDate: string;
  bio: string;
  capacity: number; // 0-100, "Current Capacity" — lead-set, no formula
}
