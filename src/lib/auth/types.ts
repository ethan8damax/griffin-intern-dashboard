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

// Shared 0-100 range check for every "percent, manually set, no formula" field
// (GoalDoc.progress, ProfileDoc.capacity) — one hand-kept range instead of one
// per call site.
export function parsePercent(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be a number between 0 and 100.`);
  }
  return value;
}

// Shared "one KR per line" textarea parser for GoalDoc/TeamGoalDoc.krs, so
// lead/intern Server Actions parse against one function instead of two
// hand-kept copies.
export function parseKrs(raw: string): { id: string; text: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: String(index), text }));
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

// ProfileDoc lives at users/{uid}/profile/data — a subcollection with one
// fixed-id document, since Firestore paths can't nest a doc directly under a
// doc. Named here so the id isn't a copy-pasted magic string at each call site.
export const PROFILE_DOC_ID = "data";

export interface TeamGoalDoc {
  objective: string;
  status: GoalDoc["status"];
  targetDate: string; // "YYYY-MM-DD"
  progress: number; // 0-100, manually set — no formula, same as GoalDoc
  krs: { id: string; text: string }[];
  createdAt: number;
}

export interface TeamPriorityDoc {
  text: string;
  weekOf: string; // "YYYY-MM-DD", Monday of the week
  status: PriorityDoc["status"];
  linkedGoalId: string | null;
  createdAt: number;
}

export interface ReflectionDoc {
  category: "self" | "peer" | "work";
  authorUid: string | null; // null only for "work" (team) reflections
  subjectUid: string | null; // set for "peer" (who it's about); null for self/work
  weekOf: string;
  text: string;
  createdAt: number;
}

// Single source of truth for ReflectionDoc["category"]'s valid values, so lead/intern
// Server Actions validate against one array instead of two hand-kept copies.
// See GOAL_STATUSES above for why this is typed readonly string[].
const REFLECTION_CATEGORY_VALUES = ["self", "peer", "work"] satisfies ReflectionDoc["category"][];
export const REFLECTION_CATEGORIES: readonly string[] = REFLECTION_CATEGORY_VALUES;

export interface ReviewDoc {
  token: string; // matches today's ?review=<token> link flow, unchanged
  subjectUserId: string; // must be a real users/{uid} intern
  reviewerName: string; // plain text — a reviewer never needs an account
  reviewerRole: string; // plain text, e.g. "Engagement Lead", "Fellow intern"
  status: "pending" | "submitted";
  requestedDate: string;
  submittedDate?: string;
  questions: {
    id: string;
    text: string;
    type: "score" | "text";
    response: number | string | null;
  }[];
  createdAt: number;
}
