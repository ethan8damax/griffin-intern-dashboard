export type Status = "green" | "yellow" | "red" | "gray";
export type QuestionType = "score" | "text";
export type JournalType = "win" | "blocker" | "checkin" | "note";
export type WorkStatus = "Done" | "In Progress" | "Not Started" | "Blocked";
export type JiraStatus = "Done" | "In Review" | "In Progress" | "To Do";
export type GoalOwner = "team" | "individual";
export type PriorityStatus = "Done" | "In Progress" | "Not Started" | "Blocked";
export type ReflectionCategory = "self" | "peer" | "work";

export interface ScoreRow {
  id: string;
  category: string;
  metric: string;
  target: string;
  actual: string;
  status: Status;
  notes: string;
}

export interface WorkItem {
  id: string;
  item: string;
  type: string;
  category: string;
  status: WorkStatus;
  evidence: string;
}

export interface Period {
  id: string;
  month: number;
  year: number;
  scorecard: ScoreRow[];
  workItems: WorkItem[];
}

export interface JournalEntry {
  id: string;
  date: string;
  author: string;
  type: JournalType;
  text: string;
}

export interface KeyResult {
  id: string;
  text: string;
}

export interface Objective {
  id: string;
  objective: string;
  owner: GoalOwner;
  assignee: string;
  status: Status;
  targetDate: string;
  krs: KeyResult[];
}

export interface PriorityItem {
  id: string;
  text: string;
  owner: string;
  status: PriorityStatus;
  linkedGoalId: string | null;
}

export interface PriorityWeek {
  id: string;
  weekOf: string;
  priorities: PriorityItem[];
}

export interface ReflectionEntry {
  id: string;
  category: ReflectionCategory;
  author: string;
  subject: string;
  text: string;
}

export interface ReflectionWeek {
  id: string;
  weekOf: string;
  entries: ReflectionEntry[];
}

export interface KpiItem {
  id: string;
  name: string;
  measures: string;
  target: string;
  formula: string;
  source: string;
}

export interface KpiCategory {
  id: string;
  title: string;
  items: KpiItem[];
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  status: JiraStatus;
  assignee: string;
  updated: string;
}

export interface JiraMapping {
  id: string;
  from: string;
  to: string;
}

export interface ReviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  response: number | string | null;
}

export interface Review {
  id: string;
  token: string;
  subjectName: string;
  reviewerName: string;
  reviewerRole: string;
  status: "pending" | "submitted";
  requestedDate: string;
  submittedDate?: string;
  questions: ReviewQuestion[];
}

export interface ReviewDraftQuestion {
  id: string;
  text: string;
  type: QuestionType;
}

export interface ReviewDraft {
  subjectName: string;
  reviewerName: string;
  reviewerRole: string;
  questions: ReviewDraftQuestion[];
}

export interface DraftJournalEntry {
  date: string;
  author: string;
  type: JournalType;
  text: string;
}

export type TabId = "dashboard" | "profile" | "scorecard" | "journal" | "okrs" | "priorities" | "reflections" | "feedback" | "reviews" | "reference" | "saved";

export interface AppState {
  activeTab: TabId;
  activeProfileName: string;
  internProfiles: Record<string, InternProfileInfo>;
  activePeriodId: string;
  periods: Period[];
  journal: JournalEntry[];
  draft: DraftJournalEntry;
  okrs: Objective[];
  priorityWeeks: PriorityWeek[];
  activePriorityWeekId: string;
  reflectionWeeks: ReflectionWeek[];
  activeReflectionWeekId: string;
  jiraPreview: boolean;
  kpiDefs: KpiCategory[];
  statusLegend: Record<Status, string>;
  mockJiraIssues: JiraIssue[];
  jiraMapping: JiraMapping[];
  reviews: Review[];
  reviewDraft: ReviewDraft;
  activeReviewId: string | null;
}

export interface InternProfileInfo {
  name: string;
  initials: string;
  role: string;
  manager: string;
  department: string;
  startDate: string;
  bio: string;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const STATUS_META: Record<Status, { emoji: string; label: string; color: string; bg: string }> = {
  green: { emoji: "🟢", label: "On Track", color: "oklch(0.6 0.14 150)", bg: "oklch(0.94 0.06 150)" },
  yellow: { emoji: "🟡", label: "At Risk", color: "oklch(0.75 0.15 85)", bg: "oklch(0.95 0.06 85)" },
  red: { emoji: "🔴", label: "Off Track", color: "oklch(0.58 0.19 25)", bg: "oklch(0.94 0.06 25)" },
  gray: { emoji: "⚪", label: "Not Yet Measured", color: "oklch(0.6 0.012 50)", bg: "oklch(0.94 0.008 55)" },
};

export const JOURNAL_TAG_META: Record<JournalType, { label: string; bg: string; color: string }> = {
  win: { label: "WIN", bg: "oklch(0.94 0.06 150)", color: "oklch(0.4 0.1 150)" },
  blocker: { label: "BLOCKER", bg: "oklch(0.94 0.06 25)", color: "oklch(0.45 0.14 25)" },
  checkin: { label: "CHECK-IN", bg: "oklch(0.93 0.045 20)", color: "oklch(0.38 0.11 20)" },
  note: { label: "NOTE", bg: "oklch(0.94 0.008 55)", color: "oklch(0.45 0.012 50)" },
};

export const REFLECTION_CATEGORY_META: Record<ReflectionCategory, { label: string; sectionTitle: string; sectionSub: string; bg: string; color: string }> = {
  self: { label: "SELF", sectionTitle: "Self-Reflections", sectionSub: "How did I do this week — what am I proud of, what would I do differently?", bg: "oklch(0.93 0.045 20)", color: "oklch(0.38 0.11 20)" },
  peer: { label: "PEER", sectionTitle: "Reflections on Each Other", sectionSub: "Feedback for a teammate — specific, kind, and useful for next week", bg: "oklch(0.94 0.06 150)", color: "oklch(0.4 0.1 150)" },
  work: { label: "TEAM / WORK", sectionTitle: "Reflections on the Work", sectionSub: "How the engagement/process went — what to keep, what to change", bg: "oklch(0.95 0.06 85)", color: "oklch(0.5 0.12 85)" },
};

export const JIRA_ISSUE_STATUS_META: Record<JiraStatus, { bg: string; color: string }> = {
  Done: { bg: "oklch(0.94 0.06 150)", color: "oklch(0.4 0.1 150)" },
  "In Review": { bg: "oklch(0.95 0.06 85)", color: "oklch(0.5 0.12 85)" },
  "In Progress": { bg: "oklch(0.93 0.045 20)", color: "oklch(0.38 0.11 20)" },
  "To Do": { bg: "oklch(0.94 0.008 55)", color: "oklch(0.5 0.012 50)" },
};

export interface NavItem {
  id: TabId;
  label: string;
  disabled?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_STANDALONE_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "profile", label: "Intern Profile" },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "planning", label: "Planning",
    items: [
      { id: "okrs", label: "Goals" },
      { id: "priorities", label: "Weekly Priorities" },
      { id: "journal", label: "Journal" },
    ],
  },
  {
    id: "performance", label: "Performance",
    items: [
      { id: "scorecard", label: "Scorecard" },
      { id: "reviews", label: "Review Summaries" },
      { id: "feedback", label: "360 Feedback" },
      { id: "reflections", label: "Weekly Reflections" },
    ],
  },
  {
    id: "resources", label: "Resources",
    items: [
      { id: "reference", label: "Reference" },
      { id: "saved", label: "Saved", disabled: true },
    ],
  },
];

export const TAB_LABELS: Record<TabId, string> = {
  dashboard: "Dashboard",
  profile: "Intern Profile",
  scorecard: "Scorecard",
  journal: "Journal",
  okrs: "Goals",
  priorities: "Weekly Priorities",
  reflections: "Weekly Reflections",
  feedback: "360 Feedback",
  reviews: "Review Summaries",
  reference: "Reference",
  saved: "Saved",
};

export const TEAM_MEMBERS = ["Grace Soegiarto", "Ethan Maxey"];

export const CORE_QUESTIONS: { text: string; type: QuestionType }[] = [
  { text: "Overall performance this period", type: "score" },
  { text: "Quality of work delivered", type: "score" },
  { text: "Communication & responsiveness", type: "score" },
  { text: "What's one thing they did well this period?", type: "text" },
  { text: "What is one area they could improve?", type: "text" },
];

export function freshDraftQuestions(subjectName?: string): ReviewDraft {
  const stamp = Date.now();
  return {
    subjectName: subjectName || "Ethan Maxey",
    reviewerName: "",
    reviewerRole: "",
    questions: CORE_QUESTIONS.map((q, i) => ({ id: "dq" + i + "_" + stamp, text: q.text, type: q.type })),
  };
}

export function initialState(): AppState {
  return {
    activeTab: "dashboard",
    activeProfileName: "Grace Soegiarto",
    internProfiles: {
      "Grace Soegiarto": {
        name: "Grace Soegiarto", initials: "GS", role: "Analyst Intern",
        manager: "Jordan Patel, Engagement Lead", department: "Griffin Global / Doeren Mayhew Engagement",
        startDate: "2026-06-01",
        bio: "Focused on ATS vendor landscape research and operational support for the Doeren Mayhew engagement.",
      },
      "Ethan Maxey": {
        name: "Ethan Maxey", initials: "EM", role: "Analyst Intern",
        manager: "Jordan Patel, Engagement Lead", department: "Griffin Global / Doeren Mayhew Engagement",
        startDate: "2026-06-01",
        bio: "Focused on ClearCompany performance-management evaluation and onboarding runbook development.",
      },
    },
    activePeriodId: "p1",
    periods: [
      {
        id: "p1", month: 5, year: 2026,
        scorecard: [
          { id: "r1", category: "Delivery", metric: "On-time delivery rate", target: "≥ 90%", actual: "100%", status: "green", notes: "both research items delivered — confirm vs. due dates" },
          { id: "r2", category: "Delivery", metric: "Deliverables shipped", target: "≥ 2", actual: "2", status: "green", notes: "ATS discovery research, ClearCo performance management research" },
          { id: "r3", category: "Delivery", metric: "Avg. cycle time per deliverable", target: "≤ [ ] days", actual: "", status: "gray", notes: "log start→accept dates" },
          { id: "r4", category: "Quality", metric: "First-pass acceptance", target: "≥ 80%", actual: "", status: "gray", notes: "from lead sign-off" },
          { id: "r5", category: "Quality", metric: "Avg. revisions per deliverable", target: "≤ 2", actual: "", status: "gray", notes: "from review history" },
          { id: "r6", category: "Quality", metric: "Data accuracy", target: "≥ 98%", actual: "", status: "gray", notes: "from our QA checks" },
          { id: "r7", category: "Capability", metric: "New tool / system ramped", target: "≥ 1 / month", actual: "2", status: "green", notes: "ATS vendor landscape, ClearCompany perf-mgmt" },
          { id: "r8", category: "Capability", metric: "Reusable assets built", target: "≥ 1 / month", actual: "", status: "gray", notes: "can the research become a reusable template?" },
          { id: "r9", category: "Relationship", metric: "Response SLA to lead/client", target: "Same business day", actual: "", status: "gray", notes: "" },
          { id: "r10", category: "Relationship", metric: "Scope expansion", target: "Trending up", actual: "Yes", status: "green", notes: "took on office/facilities work beyond analyst scope" },
          { id: "r11", category: "Relationship", metric: "Lead / client feedback", target: "≥ 4 / 5", actual: "", status: "gray", notes: "capture at next check-in" },
        ],
        workItems: [
          { id: "w1", item: "ATS discovery research", type: "Analyst deliverable", category: "Delivery", status: "Done", evidence: "[ Embed ]" },
          { id: "w2", item: "ClearCo performance management research", type: "Analyst deliverable", category: "Delivery", status: "Done", evidence: "[ Embed ]" },
          { id: "w3", item: "Fixed conference room TV", type: "Operational", category: "Relationship / initiative", status: "Done", evidence: "—" },
          { id: "w4", item: "Cleaned & organized cubicles, monitors, cables", type: "Operational", category: "Relationship / initiative", status: "Done", evidence: "—" },
        ],
      },
    ],
    journal: [
      { id: "j1", date: "2026-06-30", author: "Grace Soegiarto", type: "note", text: "Initial dashboard created; logged ATS discovery, ClearCo perf-mgmt research, and operational work." },
    ],
    draft: { date: new Date().toISOString().slice(0, 10), author: "Grace Soegiarto", type: "checkin", text: "" },
    okrs: [
      { id: "o1", objective: "Own a recurring client deliverable end-to-end with no oversight", owner: "team", assignee: "", status: "yellow", targetDate: "2026-08-31", krs: [{ id: "k1", text: "[measurable result]" }, { id: "k2", text: "[measurable result]" }] },
      { id: "o2", objective: "Convert reliable delivery into expanded / additional billable scope", owner: "team", assignee: "", status: "gray", targetDate: "2026-09-30", krs: [{ id: "k3", text: "[measurable result]" }, { id: "k4", text: "[measurable result]" }] },
      { id: "o3", objective: "Build a reusable toolchain that cuts our cycle time on a deliverable type", owner: "team", assignee: "", status: "gray", targetDate: "2026-09-30", krs: [{ id: "k5", text: "[measurable result]" }] },
      { id: "o4", objective: "Get fully ramped on the ATS vendor landscape research workflow", owner: "individual", assignee: "Grace Soegiarto", status: "green", targetDate: "2026-07-31", krs: [{ id: "k6", text: "Deliver ATS discovery research independently" }] },
      { id: "o5", objective: "Take full ownership of the ClearCompany performance-management evaluation", owner: "individual", assignee: "Ethan Maxey", status: "green", targetDate: "2026-07-31", krs: [{ id: "k7", text: "Ship ClearCo perf-mgmt research with no rework" }] },
    ],
    priorityWeeks: [
      {
        id: "pw1", weekOf: "2026-07-13",
        priorities: [
          { id: "pi1", text: "Reconcile Q2 headcount data pull", owner: "Grace Soegiarto", status: "In Progress", linkedGoalId: "o2" },
          { id: "pi2", text: "Draft onboarding runbook template v1", owner: "Ethan Maxey", status: "In Progress", linkedGoalId: "o3" },
          { id: "pi3", text: "Prep review summary for engagement lead", owner: "Team", status: "Not Started", linkedGoalId: null },
        ],
      },
    ],
    activePriorityWeekId: "pw1",
    reflectionWeeks: [
      {
        id: "rw1", weekOf: "2026-07-13",
        entries: [
          { id: "re1", category: "self", author: "Grace Soegiarto", subject: "", text: "Felt confident driving the ATS research independently — next week I want to flag blockers earlier instead of sitting on them." },
          { id: "re2", category: "self", author: "Ethan Maxey", subject: "", text: "Ramped fast on ClearCompany but spent too long polishing before sharing a draft." },
          { id: "re3", category: "peer", author: "Grace Soegiarto", subject: "Ethan Maxey", text: "Great instincts on the perf-mgmt evaluation — would love more early drafts so I can react sooner." },
          { id: "re4", category: "work", author: "Team", subject: "", text: "Weekly check-ins are catching risks early; still need a cleaner handoff process for evidence links on deliverables." },
        ],
      },
    ],
    activeReflectionWeekId: "rw1",
    jiraPreview: false,
    kpiDefs: [
      { id: "c1", title: "1. Delivery & Productivity", items: [
        { id: "i1", name: "On-time delivery rate", measures: "our reliability against committed dates.", target: "≥ 90% of deliverables shipped by the agreed deadline.", formula: "(deliverables on or before due date) ÷ (total deliverables due) × 100", source: "task tracker / our own deliverable log." },
        { id: "i2", name: "Deliverables shipped", measures: "throughput — finished, accepted work (decks, reports, data pulls, analyses).", target: "set per cycle; comparable to recent cycles.", formula: "count of items delivered and accepted in the period.", source: "deliverable log." },
        { id: "i3", name: "Average cycle time per deliverable", measures: "efficiency — calendar time from start to acceptance.", target: "trending down; set a ceiling per deliverable type.", formula: "Σ (acceptance date − start date) ÷ number of deliverables", source: "our timestamps." },
      ]},
      { id: "c2", title: "2. Quality & Accuracy", items: [
        { id: "i4", name: "First-pass acceptance", measures: "how often work is accepted without a round of major rework.", target: "≥ 80%.", formula: "(deliverables accepted on first submission) ÷ (total) × 100", source: "lead/client sign-off, review notes." },
        { id: "i5", name: "Average revisions per deliverable", measures: "polish and attention to detail.", target: "≤ 2 revision rounds.", formula: "total revision rounds ÷ number of deliverables", source: "review/comment history." },
        { id: "i6", name: "Data accuracy", measures: "correctness of figures, joins, and outputs in our analytical work.", target: "≥ 98%.", formula: "1 − (errors found ÷ data points or cells checked)", source: "our QA spot-checks, reconciliation against source-of-truth." },
      ]},
      { id: "c3", title: "3. Capability & Assets", items: [
        { id: "i7", name: "New tool / system ramped", measures: "how fast we get productive in the client's stack.", target: "≥ 1 per month.", formula: "a shipped piece of work using the new system, or a short writeup.", source: "our work log." },
        { id: "i8", name: "Reusable assets built", measures: "leverage — process turned into something we (and the client) reuse.", target: "≥ 1 per month (a template, runbook, script, or documented workflow).", formula: "count of new reusable assets created.", source: "our asset library / this space's page history." },
      ]},
      { id: "c4", title: "4. Relationship & Growth", items: [
        { id: "i9", name: "Response SLA to lead / client", measures: "responsiveness on asks from the engagement lead or client contact.", target: "acknowledge same business day; scope or resolve within the agreed window.", formula: "—", source: "Slack / email / ticket timestamps." },
        { id: "i10", name: "Scope expansion", measures: "whether we're being trusted with bigger or new types of work over time.", target: "trending up.", formula: "—", source: "new deliverable types, larger asks, areas owned end-to-end." },
        { id: "i11", name: "Lead / client feedback", measures: "how the engagement lead or client contact rates the work.", target: "≥ 4 / 5, with a written note each cycle.", formula: "—", source: "check-ins, direct feedback." },
      ]},
    ],
    statusLegend: {
      green: "meeting or exceeding target.",
      yellow: "within ~10% of target or a known issue; note + fix required.",
      red: "below target; documented plan to recover.",
      gray: "metric not yet applicable this cycle.",
    },
    mockJiraIssues: [
      { id: "ji1", key: "GG-142", summary: "ATS vendor landscape research", status: "Done", assignee: "Grace Soegiarto", updated: "2026-06-24" },
      { id: "ji2", key: "GG-146", summary: "ClearCompany perf-mgmt evaluation", status: "Done", assignee: "Ethan Maxey", updated: "2026-06-27" },
      { id: "ji3", key: "GG-151", summary: "Reconcile Q2 headcount data pull", status: "In Review", assignee: "Grace Soegiarto", updated: "2026-06-29" },
      { id: "ji4", key: "GG-153", summary: "Draft onboarding runbook template", status: "In Progress", assignee: "Ethan Maxey", updated: "2026-06-30" },
      { id: "ji5", key: "GG-155", summary: "Client SLA response audit", status: "To Do", assignee: "Unassigned", updated: "2026-06-30" },
    ],
    jiraMapping: [
      { id: "jm1", from: "Issue: Done", to: "Counts toward Deliverables shipped + On-time delivery rate" },
      { id: "jm2", from: "Issue: In Review → Done (no reopen)", to: "Counts toward First-pass acceptance" },
      { id: "jm3", from: "Reopened / reworked issue", to: "Counts toward Avg. revisions per deliverable" },
      { id: "jm4", from: "New epic / component touched", to: "Counts toward New tool / system ramped" },
    ],
    reviews: [
      {
        id: "rv1", token: "demo1234", subjectName: "Ethan Maxey", reviewerName: "Jordan Patel", reviewerRole: "Engagement Lead",
        status: "submitted", requestedDate: "2026-06-20", submittedDate: "2026-06-28",
        questions: [
          { id: "q1", text: "Overall performance this period", type: "score", response: 5 },
          { id: "q2", text: "Quality of work delivered", type: "score", response: 4 },
          { id: "q3", text: "Communication & responsiveness", type: "score", response: 5 },
          { id: "q4", text: "What's one thing they did well this period?", type: "text", response: "Took full ownership of the ATS research with zero hand-holding and asked sharp follow-up questions." },
          { id: "q5", text: "What is one area they could improve?", type: "text", response: "Could flag blockers a day earlier instead of trying to solve them solo first." },
        ],
      },
      {
        id: "rv2", token: "demo5678", subjectName: "Grace Soegiarto", reviewerName: "Ethan Maxey", reviewerRole: "Fellow intern",
        status: "pending", requestedDate: "2026-06-30",
        questions: [
          { id: "q6", text: "Overall performance this period", type: "score", response: null },
          { id: "q7", text: "Quality of work delivered", type: "score", response: null },
          { id: "q8", text: "Communication & responsiveness", type: "score", response: null },
          { id: "q9", text: "What's one thing they did well this period?", type: "text", response: "" },
          { id: "q10", text: "What is one area they could improve?", type: "text", response: "" },
        ],
      },
    ],
    reviewDraft: freshDraftQuestions("Ethan Maxey"),
    activeReviewId: null,
  };
}

export const DASHBOARD_DOC_ID = "main";

export function normalizeState(raw: Partial<AppState>): AppState {
  const base = initialState();
  return {
    ...base,
    ...raw,
    okrs: (raw.okrs ?? base.okrs).map((o) => ({
      id: o.id,
      objective: o.objective,
      krs: o.krs,
      owner: (o.owner as GoalOwner | undefined) ?? "team",
      assignee: o.assignee ?? "",
      status: (o.status as Status | undefined) ?? "gray",
      targetDate: o.targetDate ?? "",
    })),
    priorityWeeks: raw.priorityWeeks ?? base.priorityWeeks,
    activePriorityWeekId: raw.activePriorityWeekId ?? base.activePriorityWeekId,
    reflectionWeeks: raw.reflectionWeeks ?? base.reflectionWeeks,
    activeReflectionWeekId: raw.activeReflectionWeekId ?? base.activeReflectionWeekId,
    activeProfileName: raw.activeProfileName ?? base.activeProfileName,
    internProfiles: raw.internProfiles ?? base.internProfiles,
  };
}
