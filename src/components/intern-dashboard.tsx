"use client";

import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
import {
  type AppState,
  type Period,
  type Status,
  type QuestionType,
  type JournalType,
  type WorkStatus,
  type JiraStatus,
  type Review,
  type GoalOwner,
  type PriorityStatus,
  type ReflectionCategory,
  MONTH_NAMES,
  STATUS_META,
  JOURNAL_TAG_META,
  JIRA_ISSUE_STATUS_META,
  REFLECTION_CATEGORY_META,
  NAV_TABS,
  TEAM_MEMBERS,
  freshDraftQuestions,
  initialState,
  normalizeState,
  STORAGE_KEY,
} from "@/lib/dashboard-data";

type SetAppState = Dispatch<SetStateAction<AppState>>;

const INK = "oklch(0.24 0.045 258)";
const BORDER = "oklch(0.9 0.006 258)";
const MUTED = "oklch(0.55 0.01 258)";

const CARD: CSSProperties = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 22px" };
const LABEL: CSSProperties = { fontSize: 11, fontWeight: 600, color: "oklch(0.5 0.01 258)", textTransform: "uppercase", letterSpacing: "0.04em" };
const FIELD: CSSProperties = { padding: "8px 10px", border: "1px solid oklch(0.88 0.006 258)", borderRadius: 7, fontSize: 13 };
const TH: CSSProperties = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "oklch(0.5 0.01 258)", padding: "8px 10px", borderBottom: `2px solid ${BORDER}` };
const TD: CSSProperties = { padding: "9px 10px", fontSize: 13 };
const SECTION_TITLE: CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 2 };
const SECTION_SUB: CSSProperties = { fontSize: 12, color: MUTED, marginBottom: 14 };
const LINK_BTN: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer" };
const PRIMARY_BTN: CSSProperties = { padding: "10px 18px", background: INK, color: "white", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" };
const REMOVE_X: CSSProperties = { cursor: "pointer", color: "oklch(0.7 0.01 258)", fontSize: 15 };
const DASHED_ADD: CSSProperties = { fontSize: 13, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer", padding: 10, border: "1px dashed oklch(0.75 0.03 258)", borderRadius: 10, textAlign: "center", background: "white" };

function formatWeekLabel(weekOf: string): string {
  const start = new Date(weekOf + "T00:00:00");
  if (Number.isNaN(start.getTime())) return weekOf;
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week of ${fmt(start)}–${fmt(end)}, ${start.getFullYear()}`;
}

function nextMonday(fromIso: string): string {
  const d = new Date(fromIso + "T00:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function editable(value: string, onCommit: (v: string) => void) {
  return {
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) => onCommit(e.currentTarget.textContent ?? ""),
    children: value,
  } as const;
}

function escapeHtml(str: string | null | undefined): string {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function openPrintWindow(bodyHtml: string, title: string) {
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Please allow popups to export the PDF.");
    return;
  }
  win.document.write(
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + escapeHtml(title) + "</title>" +
      "<style>@page{size:letter;margin:0.75in;} body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0;}</style>" +
      "</head><body>" + bodyHtml + "</body></html>"
  );
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

function buildHeaderHtml(subtitle: string): string {
  return `<div style="margin-bottom:22px;border-bottom:2px solid #1c2b47;padding-bottom:14px;">
    <div style="font-size:21px;font-weight:800;color:#1c2b47;">Intern Analyst — KPI &amp; Metrics Dashboard</div>
    <div style="font-size:12.5px;color:#555;margin-top:4px;">Grace Soegiarto + Ethan Maxey · Griffin Global / Doeren Mayhew</div>
    <div style="font-size:11.5px;color:#888;margin-top:2px;">${escapeHtml(subtitle)} · Generated ${new Date().toLocaleDateString()}</div>
  </div>`;
}

function renderPeriodSectionHtml(period: Period): string {
  const label = MONTH_NAMES[period.month] + " " + period.year;
  const th = "text-align:left;padding:8px 10px;border-bottom:2px solid #1c2b47;font-size:10.5px;text-transform:uppercase;letter-spacing:0.03em;color:#666;";
  const td = "padding:8px 10px;border-bottom:1px solid #e5e5e5;font-size:12.5px;";
  const rows = period.scorecard.map((r) => {
    const meta = STATUS_META[r.status] ?? STATUS_META.gray;
    return `<tr>
      <td style="${td}font-weight:600;">${escapeHtml(r.category)}</td>
      <td style="${td}">${escapeHtml(r.metric)}</td>
      <td style="${td}color:#555;">${escapeHtml(r.target)}</td>
      <td style="${td}font-weight:700;">${escapeHtml(r.actual)}</td>
      <td style="${td}">${meta.emoji} ${meta.label}</td>
      <td style="${td}color:#555;font-size:11.5px;">${escapeHtml(r.notes)}</td>
    </tr>`;
  }).join("");
  const workRows = period.workItems.map((w) => `<tr>
    <td style="${td}font-weight:600;">${escapeHtml(w.item)}</td>
    <td style="${td}color:#555;">${escapeHtml(w.type)}</td>
    <td style="${td}color:#555;">${escapeHtml(w.category)}</td>
    <td style="${td}">${escapeHtml(w.status)}</td>
    <td style="${td}color:#2a5fa8;">${escapeHtml(w.evidence)}</td>
  </tr>`).join("");
  return `<div style="margin-bottom:32px;">
    <h2 style="font-size:19px;margin:0 0 4px;color:#1c2b47;">Period: ${label}</h2>
    <div style="font-size:11.5px;color:#666;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.03em;">Current Period Scorecard</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      <thead><tr><th style="${th}">Category</th><th style="${th}">Metric</th><th style="${th}">Target</th><th style="${th}">Actual</th><th style="${th}">Status</th><th style="${th}">Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="font-size:11.5px;color:#666;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.03em;">Work Completed This Period</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr><th style="${th}">Item</th><th style="${th}">Type</th><th style="${th}">Category</th><th style="${th}">Status</th><th style="${th}">Evidence</th></tr></thead>
      <tbody>${workRows}</tbody>
    </table>
  </div>`;
}

export default function InternDashboard() {
  const [state, setState] = useState<AppState>(() => initialState());
  const [loaded, setLoaded] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(normalizeState(JSON.parse(raw) as Partial<AppState>));
    } catch {
      // ponytail: corrupt/missing local storage just falls back to seed data
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ponytail: storage full/unavailable — edits still work in-memory for the session
    }
  }, [state, loaded]);

  const reviewToken = searchParams.get("review");
  const standaloneReview = reviewToken ? state.reviews.find((r) => r.token === reviewToken) ?? null : null;

  function submitReview(reviewId: string) {
    setState((s) => ({
      ...s,
      reviews: s.reviews.map((r) => (r.id !== reviewId ? r : { ...r, status: "submitted", submittedDate: new Date().toISOString().slice(0, 10) })),
    }));
  }

  function updateReviewResponse(reviewId: string, qid: string, value: number | string | null) {
    setState((s) => ({
      ...s,
      reviews: s.reviews.map((r) => (r.id !== reviewId ? r : { ...r, questions: r.questions.map((q) => (q.id !== qid ? q : { ...q, response: value })) })),
    }));
  }

  if (standaloneReview) {
    return (
      <div style={{ minHeight: "100vh", background: "oklch(0.97 0.004 258)", color: "oklch(0.2 0.01 258)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.4 0.1 258)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Intern Analyst Review Request</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>You&apos;re reviewing {standaloneReview.subjectName}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
              Requested of {standaloneReview.reviewerName}{standaloneReview.reviewerRole ? ` (${standaloneReview.reviewerRole})` : ""} · Griffin Global / Doeren Mayhew engagement
            </div>
          </div>
          {standaloneReview.status === "submitted" ? (
            <div style={{ ...CARD, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "oklch(0.4 0.13 150)" }}>Thanks — your response was recorded.</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>You can close this tab.</div>
            </div>
          ) : (
            <>
              {standaloneReview.questions.map((q) => (
                <div key={q.id} style={CARD}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{q.text}</div>
                  {q.type === "score" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <div
                          key={n}
                          onClick={() => updateReviewResponse(standaloneReview.id, q.id, n)}
                          style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${q.response === n ? INK : "oklch(0.88 0.006 258)"}`, background: q.response === n ? INK : "white", color: q.response === n ? "white" : "oklch(0.4 0.01 258)" }}
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={(q.response as string) ?? ""}
                      onChange={(e) => updateReviewResponse(standaloneReview.id, q.id, e.target.value)}
                      placeholder="Write your answer…"
                      style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: "1px solid oklch(0.88 0.006 258)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                    />
                  )}
                </div>
              ))}
              <div onClick={() => submitReview(standaloneReview.id)} style={{ padding: 12, background: INK, color: "white", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                Submit review
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const activePeriod = state.periods.find((p) => p.id === state.activePeriodId) ?? state.periods[state.periods.length - 1];

  function exportPeriodPdf(periodId: string) {
    const period = state.periods.find((p) => p.id === periodId);
    if (!period) return;
    const label = MONTH_NAMES[period.month] + " " + period.year;
    openPrintWindow(buildHeaderHtml("Period report") + renderPeriodSectionHtml(period), "KPI Dashboard — " + label);
  }

  function exportFullPdf() {
    const periodsHtml = state.periods.map((p, i) => renderPeriodSectionHtml(p) + (i < state.periods.length - 1 ? '<div style="page-break-after:always;"></div>' : "")).join("");
    const journalHtml = `<div style="margin-top:8px;page-break-before:always;">
      <h2 style="font-size:18px;color:#1c2b47;margin-bottom:12px;">Intern Journal</h2>
      ${state.journal.map((j) => {
        const tag = JOURNAL_TAG_META[j.type] ?? JOURNAL_TAG_META.note;
        return `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #eee;">
          <div style="font-size:10.5px;font-weight:700;color:#555;">${tag.label} · ${escapeHtml(j.date)} · ${escapeHtml(j.author)}</div>
          <div style="font-size:13px;margin-top:3px;">${escapeHtml(j.text)}</div>
        </div>`;
      }).join("")}
    </div>`;
    const goalSection = (title: string, goals: AppState["okrs"]) => `<div style="margin-bottom:18px;">
      <div style="font-size:13px;font-weight:700;color:#1c2b47;margin-bottom:8px;">${escapeHtml(title)}</div>
      ${goals.map((o) => `<div style="margin-bottom:14px;">
        <div style="font-weight:700;font-size:14px;">${escapeHtml(o.objective)}${o.assignee ? ` <span style="font-weight:500;color:#666;">(${escapeHtml(o.assignee)})</span>` : ""}</div>
        <div style="font-size:11px;color:#777;margin-top:2px;">${STATUS_META[o.status].emoji} ${STATUS_META[o.status].label}${o.targetDate ? ` · target ${escapeHtml(o.targetDate)}` : ""}</div>
        <ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;color:#444;">${o.krs.map((k) => `<li>${escapeHtml(k.text)}</li>`).join("")}</ul>
      </div>`).join("")}
    </div>`;
    const okrHtml = `<div style="margin-top:24px;">
      <h2 style="font-size:18px;color:#1c2b47;margin-bottom:12px;">Goals</h2>
      ${goalSection("Team Goals", state.okrs.filter((o) => o.owner === "team"))}
      ${goalSection("Individual Goals", state.okrs.filter((o) => o.owner === "individual"))}
    </div>`;
    const prioritiesHtml = `<div style="margin-top:24px;page-break-before:always;">
      <h2 style="font-size:18px;color:#1c2b47;margin-bottom:12px;">Weekly Priorities</h2>
      ${state.priorityWeeks.map((w) => `<div style="margin-bottom:16px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${escapeHtml(formatWeekLabel(w.weekOf))}</div>
        <ul style="margin:0 0 0 18px;padding:0;font-size:12.5px;color:#444;">${w.priorities.map((p) => `<li>${escapeHtml(p.text)} — <span style="color:#777;">${escapeHtml(p.owner)}, ${escapeHtml(p.status)}</span></li>`).join("")}</ul>
      </div>`).join("")}
    </div>`;
    const reflectionsHtml = `<div style="margin-top:24px;">
      <h2 style="font-size:18px;color:#1c2b47;margin-bottom:12px;">Weekly Reflections</h2>
      ${state.reflectionWeeks.map((w) => `<div style="margin-bottom:16px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${escapeHtml(formatWeekLabel(w.weekOf))}</div>
        ${w.entries.map((e) => `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #eee;">
          <div style="font-size:10.5px;font-weight:700;color:#555;">${REFLECTION_CATEGORY_META[e.category].label} · ${escapeHtml(e.author)}${e.subject ? ` about ${escapeHtml(e.subject)}` : ""}</div>
          <div style="font-size:12.5px;margin-top:3px;">${escapeHtml(e.text)}</div>
        </div>`).join("")}
      </div>`).join("")}
    </div>`;
    openPrintWindow(buildHeaderHtml("Full internship summary") + periodsHtml + journalHtml + okrHtml + prioritiesHtml + reflectionsHtml, "KPI Dashboard — Full Internship Summary");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "oklch(0.97 0.004 258)", color: "oklch(0.2 0.01 258)" }}>
      <div style={{ background: INK, color: "white", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 220 }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>Intern Analyst Dashboard</div>
          <div style={{ fontSize: 12.5, color: "oklch(0.78 0.02 258)", fontWeight: 500 }}>Grace Soegiarto + Ethan Maxey · Griffin Global / Doeren Mayhew</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", background: "oklch(0.21 0.04 258)", padding: 4, borderRadius: 10 }}>
            {NAV_TABS.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setState((s) => ({ ...s, activeTab: tab.id }))}
                style={{ padding: "8px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: state.activeTab === tab.id ? "white" : "transparent", color: state.activeTab === tab.id ? INK : "oklch(0.85 0.02 258)" }}
              >
                {tab.label}
              </div>
            ))}
          </div>
          <div onClick={exportFullPdf} style={{ padding: "8px 14px", border: "1px solid oklch(0.4 0.03 258)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "white", cursor: "pointer", whiteSpace: "nowrap" }}>
            Export full internship PDF
          </div>
        </div>
      </div>

      <div style={{ flex: 1, width: "100%", maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
        {state.activeTab === "scorecard" && (
          <ScorecardTab state={state} setState={setState} activePeriod={activePeriod} onExportPeriod={() => exportPeriodPdf(activePeriod.id)} />
        )}
        {state.activeTab === "journal" && <JournalTab state={state} setState={setState} />}
        {state.activeTab === "okrs" && <GoalsTab state={state} setState={setState} />}
        {state.activeTab === "priorities" && <PrioritiesTab state={state} setState={setState} />}
        {state.activeTab === "reflections" && <ReflectionsTab state={state} setState={setState} />}
        {state.activeTab === "reviews" && <ReviewsTab state={state} setState={setState} />}
        {state.activeTab === "reference" && <ReferenceTab state={state} setState={setState} />}
      </div>
    </div>
  );
}

function ScorecardTab({ state, setState, activePeriod, onExportPeriod }: { state: AppState; setState: SetAppState; activePeriod: Period; onExportPeriod: () => void }) {
  function updateScoreField(rowId: string, field: keyof Period["scorecard"][number], value: string) {
    setState((s) => ({ ...s, periods: s.periods.map((p) => (p.id !== activePeriod.id ? p : { ...p, scorecard: p.scorecard.map((r) => (r.id !== rowId ? r : { ...r, [field]: value })) })) }));
  }
  function addScoreRow() {
    setState((s) => ({ ...s, periods: s.periods.map((p) => (p.id !== activePeriod.id ? p : { ...p, scorecard: [...p.scorecard, { id: "r" + Date.now(), category: "New", metric: "New metric", target: "", actual: "", status: "gray" as Status, notes: "" }] })) }));
  }
  function removeScoreRow(rowId: string) {
    if (!window.confirm("Delete this metric row? This cannot be undone.")) return;
    setState((s) => ({ ...s, periods: s.periods.map((p) => (p.id !== activePeriod.id ? p : { ...p, scorecard: p.scorecard.filter((r) => r.id !== rowId) })) }));
  }
  function updateWorkField(rowId: string, field: keyof Period["workItems"][number], value: string) {
    setState((s) => ({ ...s, periods: s.periods.map((p) => (p.id !== activePeriod.id ? p : { ...p, workItems: p.workItems.map((w) => (w.id !== rowId ? w : { ...w, [field]: value })) })) }));
  }
  function addWorkRow() {
    setState((s) => ({ ...s, periods: s.periods.map((p) => (p.id !== activePeriod.id ? p : { ...p, workItems: [...p.workItems, { id: "w" + Date.now(), item: "New item", type: "", category: "", status: "Not Started" as WorkStatus, evidence: "" }] })) }));
  }
  function removeWorkRow(rowId: string) {
    if (!window.confirm("Delete this work item? This cannot be undone.")) return;
    setState((s) => ({ ...s, periods: s.periods.map((p) => (p.id !== activePeriod.id ? p : { ...p, workItems: p.workItems.filter((w) => w.id !== rowId) })) }));
  }
  function addPeriod() {
    setState((s) => {
      const last = s.periods[s.periods.length - 1];
      let month = last.month + 1;
      let year = last.year;
      if (month > 11) { month = 0; year += 1; }
      const stamp = Date.now();
      const scorecard = last.scorecard.map((r, i) => ({ id: "r" + stamp + "_" + i, category: r.category, metric: r.metric, target: r.target, actual: "", status: "gray" as Status, notes: "" }));
      const newPeriod: Period = { id: "p" + stamp, month, year, scorecard, workItems: [] };
      return { ...s, periods: [...s.periods, newPeriod], activePeriodId: newPeriod.id, activeTab: "scorecard" };
    });
  }
  function removePeriod(periodId: string) {
    if (state.periods.length <= 1) { window.alert("At least one period must remain."); return; }
    const period = state.periods.find((p) => p.id === periodId);
    const label = period ? MONTH_NAMES[period.month] + " " + period.year : "this period";
    if (!window.confirm(`Delete the entire ${label} period, including its scorecard and work log? This cannot be undone.`)) return;
    setState((s) => {
      const remaining = s.periods.filter((p) => p.id !== periodId);
      const activePeriodId = s.activePeriodId === periodId ? remaining[remaining.length - 1].id : s.activePeriodId;
      return { ...s, periods: remaining, activePeriodId };
    });
  }

  const riskRows = activePeriod.scorecard.filter((r) => r.status === "yellow" || r.status === "red");
  const statusOptions = (Object.keys(STATUS_META) as Status[]).map((k) => ({ value: k, label: `${STATUS_META[k].emoji} ${STATUS_META[k].label}` }));
  const workStatusOptions: WorkStatus[] = ["Done", "In Progress", "Not Started", "Blocked"];

  const findRow = (name: string) => activePeriod.scorecard.find((r) => r.metric === name);
  const onTime = findRow("On-time delivery rate");
  const shipped = findRow("Deliverables shipped");
  const accuracy = findRow("Data accuracy");
  const feedback = findRow("Lead / client feedback");
  const statCards = [
    { label: "On-time delivery", value: onTime?.actual || "—", target: onTime?.target || "—", color: STATUS_META[onTime?.status ?? "gray"].color },
    { label: "Deliverables shipped", value: shipped?.actual || "—", target: shipped?.target || "—", color: STATUS_META[shipped?.status ?? "gray"].color },
    { label: "Data accuracy", value: accuracy?.actual || "Pending", target: accuracy?.target || "—", color: STATUS_META[accuracy?.status ?? "gray"].color },
    { label: "Client feedback", value: feedback?.actual || "Pending", target: feedback?.target || "—", color: STATUS_META[feedback?.status ?? "gray"].color },
  ];

  const counts: Record<Status, number> = { green: 0, yellow: 0, red: 0, gray: 0 };
  activePeriod.scorecard.forEach((r) => { counts[r.status] += 1; });
  const statusTotal = activePeriod.scorecard.length;
  const order: Status[] = ["green", "yellow", "red", "gray"];
  let acc = 0;
  const segments: string[] = [];
  order.forEach((k) => {
    const pct = statusTotal ? (counts[k] / statusTotal) * 100 : 0;
    if (pct > 0) segments.push(`${STATUS_META[k].color} ${acc}% ${acc + pct}%`);
    acc += pct;
  });
  const donutGradient = segments.length ? `conic-gradient(${segments.join(", ")})` : "oklch(0.9 0.006 258)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {riskRows.length > 0 && (
        <div style={{ background: "oklch(0.97 0.03 40)", border: "1px solid oklch(0.82 0.08 40)", borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "oklch(0.4 0.13 40)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Needs attention this period</div>
          {riskRows.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13 }}>
              <span>{STATUS_META[r.status].emoji}</span>
              <span style={{ fontWeight: 700, color: "oklch(0.3 0.02 258)" }}>{r.metric}</span>
              <span style={{ color: "oklch(0.45 0.02 40)" }}>{r.notes ? `— ${r.notes}` : "(no note added yet)"}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ flex: 1, minWidth: 170, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 1px 2px oklch(0.2 0 0 / 0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={LABEL}>{card.label}</div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: card.color }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "oklch(0.22 0.02 258)", letterSpacing: "-0.01em" }}>{card.value}</div>
            <div style={{ fontSize: 11, color: MUTED }}>Target {card.target}</div>
          </div>
        ))}
        <div style={{ minWidth: 180, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: donutGradient, flex: "none", position: "relative" }}>
            <div style={{ position: "absolute", inset: 9, background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{statusTotal}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {order.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_META[k].color }} />
                <span style={{ color: MUTED }}>{STATUS_META[k].label}</span>
                <span style={{ fontWeight: 700, color: "oklch(0.22 0.02 258)" }}>{counts[k]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {state.periods.map((p) => {
          const active = p.id === activePeriod.id;
          return (
            <div
              key={p.id}
              onClick={() => setState((s) => ({ ...s, activePeriodId: p.id }))}
              style={{ padding: "7px 8px 7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${active ? INK : "oklch(0.88 0.006 258)"}`, background: active ? INK : "white", color: active ? "white" : "oklch(0.35 0.01 258)" }}
            >
              <span>{MONTH_NAMES[p.month]} {p.year}</span>
              <span
                title="Delete this period"
                onClick={(e) => { e.stopPropagation(); removePeriod(p.id); }}
                style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 5px", borderRadius: 5, color: active ? "oklch(0.85 0.02 258)" : "oklch(0.6 0.01 258)" }}
              >
                ×
              </span>
            </div>
          );
        })}
        <div onClick={addPeriod} style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer", padding: "7px 12px", border: "1px dashed oklch(0.7 0.03 258)", borderRadius: 8 }}>+ New period</div>
        <div onClick={onExportPeriod} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "white", cursor: "pointer", padding: "7px 14px", borderRadius: 8, background: INK }}>Export this period as PDF</div>
      </div>

      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={SECTION_TITLE}>Current Period Scorecard</div>
            <div style={SECTION_SUB}>Period: {MONTH_NAMES[activePeriod.month]} {activePeriod.year} — fill in the Actual column and set Status each cycle</div>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={TH}>Category</th><th style={TH}>Metric</th><th style={TH}>Target</th><th style={TH}>Actual</th><th style={TH}>Status</th><th style={TH}>Notes</th><th style={{ width: 28, borderBottom: `2px solid ${BORDER}` }} />
              </tr>
            </thead>
            <tbody>
              {activePeriod.scorecard.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid oklch(0.94 0.006 258)" }}>
                  <td style={{ ...TD, fontWeight: 600, color: "oklch(0.35 0.02 258)", minWidth: 100 }} {...editable(row.category, (v) => updateScoreField(row.id, "category", v))} />
                  <td style={{ ...TD, minWidth: 150 }} {...editable(row.metric, (v) => updateScoreField(row.id, "metric", v))} />
                  <td style={{ ...TD, color: MUTED, minWidth: 90 }} {...editable(row.target, (v) => updateScoreField(row.id, "target", v))} />
                  <td style={{ ...TD, fontWeight: 700, minWidth: 80 }} {...editable(row.actual, (v) => updateScoreField(row.id, "actual", v))} />
                  <td style={{ padding: "6px 10px" }}>
                    <select value={row.status} onChange={(e) => updateScoreField(row.id, "status", e.target.value)} style={{ fontSize: 12.5, padding: "5px 8px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
                      {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...TD, fontSize: 12.5, color: "oklch(0.4 0.01 258)", minWidth: 200 }} {...editable(row.notes, (v) => updateScoreField(row.id, "notes", v))} />
                  <td style={{ textAlign: "center" }}><span onClick={() => removeScoreRow(row.id)} style={REMOVE_X}>×</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div onClick={addScoreRow} style={{ marginTop: 12, ...LINK_BTN }}>+ Add metric row</div>
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>Work Completed This Period</div>
        <div style={SECTION_SUB}>Link evidence where a metric points to a deliverable</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr>
                <th style={TH}>Item</th><th style={TH}>Type</th><th style={TH}>Category</th><th style={TH}>Status</th><th style={TH}>Evidence</th><th style={{ width: 28, borderBottom: `2px solid ${BORDER}` }} />
              </tr>
            </thead>
            <tbody>
              {activePeriod.workItems.map((w) => (
                <tr key={w.id} style={{ borderBottom: "1px solid oklch(0.94 0.006 258)" }}>
                  <td style={{ ...TD, fontWeight: 600, minWidth: 200 }} {...editable(w.item, (v) => updateWorkField(w.id, "item", v))} />
                  <td style={{ ...TD, fontSize: 12.5, color: MUTED, minWidth: 130 }} {...editable(w.type, (v) => updateWorkField(w.id, "type", v))} />
                  <td style={{ ...TD, fontSize: 12.5, color: MUTED, minWidth: 130 }} {...editable(w.category, (v) => updateWorkField(w.id, "category", v))} />
                  <td style={{ padding: "6px 10px" }}>
                    <select value={w.status} onChange={(e) => updateWorkField(w.id, "status", e.target.value)} style={{ fontSize: 12.5, padding: "5px 8px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
                      {workStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>
                  <td style={{ ...TD, fontSize: 12.5, color: "oklch(0.4 0.1 258)", minWidth: 160 }} {...editable(w.evidence, (v) => updateWorkField(w.id, "evidence", v))} />
                  <td style={{ textAlign: "center" }}><span onClick={() => removeWorkRow(w.id)} style={REMOVE_X}>×</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div onClick={addWorkRow} style={{ marginTop: 12, ...LINK_BTN }}>+ Add work item</div>
      </div>
    </div>
  );
}

function JournalTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const authorOptions = ["Grace Soegiarto", "Ethan Maxey"];

  function submitJournal() {
    const d = state.draft;
    if (!d.text.trim()) return;
    const entry = { id: "j" + Date.now(), date: d.date, author: d.author, type: d.type, text: d.text.trim() };
    setState((s) => ({ ...s, journal: [entry, ...s.journal], draft: { ...s.draft, text: "" } }));
  }
  function removeJournalEntry(id: string) {
    if (!window.confirm("Delete this journal entry? This cannot be undone.")) return;
    setState((s) => ({ ...s, journal: s.journal.filter((j) => j.id !== id) }));
  }
  function updateJournalField(id: string, field: "type" | "date" | "author" | "text", value: string) {
    setState((s) => ({ ...s, journal: s.journal.map((j) => (j.id !== id ? j : { ...j, [field]: value })) }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={CARD}>
        <div style={SECTION_TITLE}>Intern Journal</div>
        <div style={SECTION_SUB}>Weekly check-ins, wins, blockers — the record of how the cycle actually went</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={LABEL}>Date</label>
            <input type="date" value={state.draft.date} onChange={(e) => setState((s) => ({ ...s, draft: { ...s.draft, date: e.target.value } }))} style={FIELD} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={LABEL}>Author</label>
            <select value={state.draft.author} onChange={(e) => setState((s) => ({ ...s, draft: { ...s.draft, author: e.target.value } }))} style={FIELD}>
              {authorOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={LABEL}>Type</label>
            <select value={state.draft.type} onChange={(e) => setState((s) => ({ ...s, draft: { ...s.draft, type: e.target.value as JournalType } }))} style={FIELD}>
              <option value="win">Win</option>
              <option value="blocker">Blocker</option>
              <option value="checkin">Weekly check-in</option>
              <option value="note">Note</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={LABEL}>Entry</label>
            <input type="text" value={state.draft.text} onChange={(e) => setState((s) => ({ ...s, draft: { ...s.draft, text: e.target.value } }))} placeholder="What happened this week?" style={FIELD} />
          </div>
          <div onClick={submitJournal} style={{ padding: "9px 16px", background: INK, color: "white", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add entry</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {state.journal.map((entry) => {
          const tag = JOURNAL_TAG_META[entry.type] ?? JOURNAL_TAG_META.note;
          return (
            <div key={entry.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <select
                value={entry.type}
                onChange={(e) => updateJournalField(entry.id, "type", e.target.value)}
                style={{ fontSize: 11, fontWeight: 700, padding: "3px 6px", borderRadius: 6, background: tag.bg, color: tag.color, border: "none", flex: "none", marginTop: 1, cursor: "pointer" }}
              >
                <option value="win">WIN</option>
                <option value="blocker">BLOCKER</option>
                <option value="checkin">CHECK-IN</option>
                <option value="note">NOTE</option>
              </select>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 13.5, color: "oklch(0.25 0.01 258)", lineHeight: 1.5 }} {...editable(entry.text, (v) => updateJournalField(entry.id, "text", v))} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="date" value={entry.date} onChange={(e) => updateJournalField(entry.id, "date", e.target.value)} style={{ fontSize: 11.5, color: MUTED, fontFamily: "var(--font-jetbrains-mono)", border: "none", background: "transparent", padding: 0, cursor: "pointer" }} />
                  <span style={{ fontSize: 11.5, color: MUTED }}>·</span>
                  <select value={entry.author} onChange={(e) => updateJournalField(entry.id, "author", e.target.value)} style={{ fontSize: 11.5, color: MUTED, fontFamily: "var(--font-jetbrains-mono)", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
                    {authorOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <span onClick={() => removeJournalEntry(entry.id)} style={REMOVE_X}>×</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  function addObjective(owner: GoalOwner) {
    setState((s) => ({
      ...s,
      okrs: [...s.okrs, { id: "o" + Date.now(), objective: owner === "team" ? "New team goal" : "New individual goal", owner, assignee: owner === "individual" ? TEAM_MEMBERS[0] : "", status: "gray" as Status, targetDate: "", krs: [] }],
    }));
  }
  function removeObjective(id: string) {
    if (!window.confirm("Delete this goal and all its key results? This cannot be undone.")) return;
    setState((s) => ({ ...s, okrs: s.okrs.filter((o) => o.id !== id) }));
  }
  function updateObjectiveText(id: string, value: string) {
    setState((s) => ({ ...s, okrs: s.okrs.map((o) => (o.id !== id ? o : { ...o, objective: value })) }));
  }
  function updateObjectiveField(id: string, field: "assignee" | "status" | "targetDate", value: string) {
    setState((s) => ({ ...s, okrs: s.okrs.map((o) => (o.id !== id ? o : { ...o, [field]: value })) }));
  }
  function addKr(objId: string) {
    setState((s) => ({ ...s, okrs: s.okrs.map((o) => (o.id !== objId ? o : { ...o, krs: [...o.krs, { id: "k" + Date.now(), text: "[measurable result]" }] })) }));
  }
  function removeKr(objId: string, krId: string) {
    if (!window.confirm("Delete this key result? This cannot be undone.")) return;
    setState((s) => ({ ...s, okrs: s.okrs.map((o) => (o.id !== objId ? o : { ...o, krs: o.krs.filter((k) => k.id !== krId) })) }));
  }
  function updateKrText(objId: string, krId: string, value: string) {
    setState((s) => ({ ...s, okrs: s.okrs.map((o) => (o.id !== objId ? o : { ...o, krs: o.krs.map((k) => (k.id !== krId ? k : { ...k, text: value })) })) }));
  }

  const statusOptions = (Object.keys(STATUS_META) as Status[]).map((k) => ({ value: k, label: `${STATUS_META[k].emoji} ${STATUS_META[k].label}` }));
  const teamGoals = state.okrs.filter((o) => o.owner === "team");
  const individualGoals = state.okrs.filter((o) => o.owner === "individual");

  function renderGoalCard(obj: AppState["okrs"][number], index: number) {
    return (
      <div key={obj.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.4 0.1 258)", flex: "none", marginTop: 2 }}>Goal {index + 1}</span>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "oklch(0.22 0.02 258)" }} {...editable(obj.objective, (v) => updateObjectiveText(obj.id, v))} />
          <span onClick={() => removeObjective(obj.id)} style={REMOVE_X}>×</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12, paddingLeft: 22 }}>
          {obj.owner === "individual" && (
            <select value={obj.assignee} onChange={(e) => updateObjectiveField(obj.id, "assignee", e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
              {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select value={obj.status} onChange={(e) => updateObjectiveField(obj.id, "status", e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
            {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11.5, color: MUTED }}>Target date</span>
            <input type="date" value={obj.targetDate} onChange={(e) => updateObjectiveField(obj.id, "targetDate", e.target.value)} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 22 }}>
          {obj.krs.map((kr) => (
            <div key={kr.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.7 0.02 258)", flex: "none" }} />
              <div style={{ flex: 1, fontSize: 13, color: "oklch(0.35 0.01 258)" }} {...editable(kr.text, (v) => updateKrText(obj.id, kr.id, v))} />
              <span onClick={() => removeKr(obj.id, kr.id)} style={{ ...REMOVE_X, fontSize: 13, color: "oklch(0.75 0.01 258)" }}>×</span>
            </div>
          ))}
          <div onClick={() => addKr(obj.id)} style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer", marginTop: 2 }}>+ Add key result</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}>
        Set 2–4 goals per cycle in each section. Keep them outcome-focused — team goals grow the engagement, individual goals grow the person.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={SECTION_TITLE}>Team Goals</div>
        {teamGoals.map((obj, i) => renderGoalCard(obj, i))}
        <div onClick={() => addObjective("team")} style={DASHED_ADD}>+ Add team goal</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={SECTION_TITLE}>Individual Goals</div>
        {individualGoals.map((obj, i) => renderGoalCard(obj, i))}
        <div onClick={() => addObjective("individual")} style={DASHED_ADD}>+ Add individual goal</div>
      </div>
    </div>
  );
}

function WeekPicker({ weeks, activeWeekId, onSelect, onAdd, onRemove }: { weeks: { id: string; weekOf: string }[]; activeWeekId: string; onSelect: (id: string) => void; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {weeks.map((w) => {
        const active = w.id === activeWeekId;
        return (
          <div
            key={w.id}
            onClick={() => onSelect(w.id)}
            style={{ padding: "7px 8px 7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${active ? INK : "oklch(0.88 0.006 258)"}`, background: active ? INK : "white", color: active ? "white" : "oklch(0.35 0.01 258)" }}
          >
            <span>{formatWeekLabel(w.weekOf)}</span>
            <span
              title="Delete this week"
              onClick={(e) => { e.stopPropagation(); onRemove(w.id); }}
              style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 5px", borderRadius: 5, color: active ? "oklch(0.85 0.02 258)" : "oklch(0.6 0.01 258)" }}
            >
              ×
            </span>
          </div>
        );
      })}
      <div onClick={onAdd} style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer", padding: "7px 12px", border: "1px dashed oklch(0.7 0.03 258)", borderRadius: 8 }}>+ New week</div>
    </div>
  );
}

function PrioritiesTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const activeWeek = state.priorityWeeks.find((w) => w.id === state.activePriorityWeekId) ?? state.priorityWeeks[state.priorityWeeks.length - 1];
  const priorityOwners = [...TEAM_MEMBERS, "Team"];
  const priorityStatusOptions: PriorityStatus[] = ["Not Started", "In Progress", "Done", "Blocked"];

  function addWeek() {
    setState((s) => {
      const last = s.priorityWeeks[s.priorityWeeks.length - 1];
      const id = "pw" + Date.now();
      return { ...s, priorityWeeks: [...s.priorityWeeks, { id, weekOf: last ? nextMonday(last.weekOf) : new Date().toISOString().slice(0, 10), priorities: [] }], activePriorityWeekId: id };
    });
  }
  function removeWeek(weekId: string) {
    if (state.priorityWeeks.length <= 1) { window.alert("At least one week must remain."); return; }
    if (!window.confirm("Delete this entire week's priorities? This cannot be undone.")) return;
    setState((s) => {
      const remaining = s.priorityWeeks.filter((w) => w.id !== weekId);
      const activePriorityWeekId = s.activePriorityWeekId === weekId ? remaining[remaining.length - 1].id : s.activePriorityWeekId;
      return { ...s, priorityWeeks: remaining, activePriorityWeekId };
    });
  }
  function updateField(itemId: string, field: "text" | "owner" | "status" | "linkedGoalId", value: string) {
    setState((s) => ({ ...s, priorityWeeks: s.priorityWeeks.map((w) => (w.id !== activeWeek.id ? w : { ...w, priorities: w.priorities.map((p) => (p.id !== itemId ? p : { ...p, [field]: field === "linkedGoalId" && value === "" ? null : value })) })) }));
  }
  function addPriority() {
    setState((s) => ({ ...s, priorityWeeks: s.priorityWeeks.map((w) => (w.id !== activeWeek.id ? w : { ...w, priorities: [...w.priorities, { id: "pi" + Date.now(), text: "New priority", owner: "Team", status: "Not Started" as PriorityStatus, linkedGoalId: null }] })) }));
  }
  function removePriority(itemId: string) {
    if (!window.confirm("Delete this priority? This cannot be undone.")) return;
    setState((s) => ({ ...s, priorityWeeks: s.priorityWeeks.map((w) => (w.id !== activeWeek.id ? w : { ...w, priorities: w.priorities.filter((p) => p.id !== itemId) })) }));
  }

  const counts: Record<PriorityStatus, number> = { Done: 0, "In Progress": 0, "Not Started": 0, Blocked: 0 };
  activeWeek.priorities.forEach((p) => { counts[p.status] += 1; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}>
        Set the handful of things that must happen this week. Link a priority to a goal to see how the week ladders up.
      </div>
      <WeekPicker weeks={state.priorityWeeks} activeWeekId={activeWeek.id} onSelect={(id) => setState((s) => ({ ...s, activePriorityWeekId: id }))} onAdd={addWeek} onRemove={removeWeek} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {priorityStatusOptions.map((st) => (
          <div key={st} style={{ flex: 1, minWidth: 120, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={LABEL}>{st}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "oklch(0.22 0.02 258)" }}>{counts[st]}</div>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>{formatWeekLabel(activeWeek.weekOf)}</div>
        <div style={SECTION_SUB}>Who owns it, where it stands, and — if relevant — which goal it moves forward</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeWeek.priorities.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "oklch(0.97 0.004 258)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, fontWeight: 600 }} {...editable(p.text, (v) => updateField(p.id, "text", v))} />
              <select value={p.owner} onChange={(e) => updateField(p.id, "owner", e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
                {priorityOwners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={p.status} onChange={(e) => updateField(p.id, "status", e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
                {priorityStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <select value={p.linkedGoalId ?? ""} onChange={(e) => updateField(p.id, "linkedGoalId", e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer", maxWidth: 220 }}>
                <option value="">No linked goal</option>
                {state.okrs.map((o) => <option key={o.id} value={o.id}>{o.objective.length > 40 ? o.objective.slice(0, 40) + "…" : o.objective}</option>)}
              </select>
              <span onClick={() => removePriority(p.id)} style={REMOVE_X}>×</span>
            </div>
          ))}
        </div>
        <div onClick={addPriority} style={{ marginTop: 12, ...LINK_BTN }}>+ Add priority</div>
      </div>
    </div>
  );
}

function ReflectionsTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const activeWeek = state.reflectionWeeks.find((w) => w.id === state.activeReflectionWeekId) ?? state.reflectionWeeks[state.reflectionWeeks.length - 1];
  const categories: ReflectionCategory[] = ["self", "peer", "work"];

  function addWeek() {
    setState((s) => {
      const last = s.reflectionWeeks[s.reflectionWeeks.length - 1];
      const id = "rw" + Date.now();
      return { ...s, reflectionWeeks: [...s.reflectionWeeks, { id, weekOf: last ? nextMonday(last.weekOf) : new Date().toISOString().slice(0, 10), entries: [] }], activeReflectionWeekId: id };
    });
  }
  function removeWeek(weekId: string) {
    if (state.reflectionWeeks.length <= 1) { window.alert("At least one week must remain."); return; }
    if (!window.confirm("Delete this entire week's reflections? This cannot be undone.")) return;
    setState((s) => {
      const remaining = s.reflectionWeeks.filter((w) => w.id !== weekId);
      const activeReflectionWeekId = s.activeReflectionWeekId === weekId ? remaining[remaining.length - 1].id : s.activeReflectionWeekId;
      return { ...s, reflectionWeeks: remaining, activeReflectionWeekId };
    });
  }
  function updateField(entryId: string, field: "author" | "subject" | "text", value: string) {
    setState((s) => ({ ...s, reflectionWeeks: s.reflectionWeeks.map((w) => (w.id !== activeWeek.id ? w : { ...w, entries: w.entries.map((e) => (e.id !== entryId ? e : { ...e, [field]: value })) })) }));
  }
  function addEntry(category: ReflectionCategory) {
    setState((s) => ({
      ...s,
      reflectionWeeks: s.reflectionWeeks.map((w) => (w.id !== activeWeek.id ? w : {
        ...w,
        entries: [...w.entries, { id: "re" + Date.now(), category, author: TEAM_MEMBERS[0], subject: category === "peer" ? TEAM_MEMBERS[1] : "", text: "" }],
      })),
    }));
  }
  function removeEntry(entryId: string) {
    if (!window.confirm("Delete this reflection? This cannot be undone.")) return;
    setState((s) => ({ ...s, reflectionWeeks: s.reflectionWeeks.map((w) => (w.id !== activeWeek.id ? w : { ...w, entries: w.entries.filter((e) => e.id !== entryId) })) }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}>
        A weekly pause to reflect honestly — on yourself, on each other, and on how the work is actually going.
      </div>
      <WeekPicker weeks={state.reflectionWeeks} activeWeekId={activeWeek.id} onSelect={(id) => setState((s) => ({ ...s, activeReflectionWeekId: id }))} onAdd={addWeek} onRemove={removeWeek} />

      {categories.map((cat) => {
        const meta = REFLECTION_CATEGORY_META[cat];
        const entries = activeWeek.entries.filter((e) => e.category === cat);
        return (
          <div key={cat} style={CARD}>
            <div style={SECTION_TITLE}>{meta.sectionTitle}</div>
            <div style={SECTION_SUB}>{meta.sectionSub}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {entries.map((entry) => (
                <div key={entry.id} style={{ background: "oklch(0.97 0.004 258)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: meta.bg, color: meta.color, flex: "none" }}>{meta.label}</span>
                    <select value={entry.author} onChange={(e) => updateField(entry.id, "author", e.target.value)} style={{ fontSize: 12, padding: "4px 7px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
                      {(cat === "work" ? [...TEAM_MEMBERS, "Team"] : TEAM_MEMBERS).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {cat === "peer" && (
                      <>
                        <span style={{ fontSize: 11.5, color: MUTED }}>about</span>
                        <select value={entry.subject} onChange={(e) => updateField(entry.id, "subject", e.target.value)} style={{ fontSize: 12, padding: "4px 7px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer" }}>
                          {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </>
                    )}
                    <span onClick={() => removeEntry(entry.id)} style={{ ...REMOVE_X, marginLeft: "auto" }}>×</span>
                  </div>
                  <textarea
                    value={entry.text}
                    onChange={(e) => updateField(entry.id, "text", e.target.value)}
                    placeholder="Write the reflection…"
                    style={{ width: "100%", minHeight: 56, padding: "9px 11px", border: "1px solid oklch(0.88 0.006 258)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", background: "white" }}
                  />
                </div>
              ))}
            </div>
            <div onClick={() => addEntry(cat)} style={{ marginTop: 12, ...LINK_BTN }}>+ Add {cat === "self" ? "self-reflection" : cat === "peer" ? "peer reflection" : "team reflection"}</div>
          </div>
        );
      })}
    </div>
  );
}

function ReferenceTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  function updateKpiCategoryTitle(catId: string, value: string) {
    setState((s) => ({ ...s, kpiDefs: s.kpiDefs.map((c) => (c.id !== catId ? c : { ...c, title: value })) }));
  }
  function updateKpiItemField(catId: string, itemId: string, field: "name" | "measures" | "target" | "formula" | "source", value: string) {
    setState((s) => ({ ...s, kpiDefs: s.kpiDefs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, [field]: value })) })) }));
  }
  function addKpiCategory() {
    setState((s) => ({ ...s, kpiDefs: [...s.kpiDefs, { id: "c" + Date.now(), title: "New category", items: [] }] }));
  }
  function removeKpiCategory(catId: string) {
    if (!window.confirm("Delete this entire category and its metrics? This cannot be undone.")) return;
    setState((s) => ({ ...s, kpiDefs: s.kpiDefs.filter((c) => c.id !== catId) }));
  }
  function addKpiItem(catId: string) {
    setState((s) => ({ ...s, kpiDefs: s.kpiDefs.map((c) => (c.id !== catId ? c : { ...c, items: [...c.items, { id: "i" + Date.now(), name: "New metric", measures: "", target: "", formula: "", source: "" }] })) }));
  }
  function removeKpiItem(catId: string, itemId: string) {
    if (!window.confirm("Delete this metric definition? This cannot be undone.")) return;
    setState((s) => ({ ...s, kpiDefs: s.kpiDefs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) })) }));
  }
  function updateStatusLegend(key: Status, value: string) {
    setState((s) => ({ ...s, statusLegend: { ...s.statusLegend, [key]: value } }));
  }
  function toggleJiraPreview() {
    setState((s) => ({ ...s, jiraPreview: !s.jiraPreview }));
  }
  function updateJiraMapping(id: string, field: "from" | "to", value: string) {
    setState((s) => ({ ...s, jiraMapping: s.jiraMapping.map((m) => (m.id !== id ? m : { ...m, [field]: value })) }));
  }
  function addJiraMapping() {
    setState((s) => ({ ...s, jiraMapping: [...s.jiraMapping, { id: "jm" + Date.now(), from: "New trigger", to: "Counts toward…" }] }));
  }
  function removeJiraMapping(id: string) {
    if (!window.confirm("Delete this mapping row? This cannot be undone.")) return;
    setState((s) => ({ ...s, jiraMapping: s.jiraMapping.filter((m) => m.id !== id) }));
  }
  function updateJiraIssueField(id: string, field: "key" | "summary" | "assignee" | "updated" | "status", value: string) {
    setState((s) => ({ ...s, mockJiraIssues: s.mockJiraIssues.map((i) => (i.id !== id ? i : { ...i, [field]: value })) }));
  }
  function addJiraIssue() {
    setState((s) => ({ ...s, mockJiraIssues: [...s.mockJiraIssues, { id: "ji" + Date.now(), key: "GG-000", summary: "New sample issue", status: "To Do" as JiraStatus, assignee: "", updated: new Date().toISOString().slice(0, 10) }] }));
  }
  function removeJiraIssue(id: string) {
    if (!window.confirm("Delete this sample issue row? This cannot be undone.")) return;
    setState((s) => ({ ...s, mockJiraIssues: s.mockJiraIssues.filter((i) => i.id !== id) }));
  }

  const legendOrder: Status[] = ["green", "yellow", "red", "gray"];
  const jiraStatusOptions = Object.keys(JIRA_ISSUE_STATUS_META) as JiraStatus[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12, color: MUTED }}>These definitions drive what &quot;on track&quot; means for each scorecard metric — edit them as the engagement evolves.</div>

      {state.kpiDefs.map((cat) => (
        <div key={cat.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: INK }} {...editable(cat.title, (v) => updateKpiCategoryTitle(cat.id, v))} />
            <span onClick={() => removeKpiCategory(cat.id)} style={REMOVE_X}>×</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cat.items.map((it) => (
              <div key={it.id} style={{ paddingTop: 12, borderTop: "1px solid oklch(0.94 0.006 258)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }} {...editable(it.name, (v) => updateKpiItemField(cat.id, it.id, "name", v))} />
                  <span onClick={() => removeKpiItem(cat.id, it.id)} style={{ ...REMOVE_X, fontSize: 14 }}>×</span>
                </div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.01 258)", lineHeight: 1.6 }}><strong>Measures:</strong> <span {...editable(it.measures, (v) => updateKpiItemField(cat.id, it.id, "measures", v))} /></div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.01 258)", lineHeight: 1.6 }}><strong>Target:</strong> <span {...editable(it.target, (v) => updateKpiItemField(cat.id, it.id, "target", v))} /></div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.01 258)", lineHeight: 1.6, fontFamily: "var(--font-jetbrains-mono)" }}><strong style={{ fontFamily: "var(--font-inter)" }}>Formula:</strong> <span {...editable(it.formula, (v) => updateKpiItemField(cat.id, it.id, "formula", v))} /></div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.01 258)", lineHeight: 1.6 }}><strong>Source:</strong> <span {...editable(it.source, (v) => updateKpiItemField(cat.id, it.id, "source", v))} /></div>
              </div>
            ))}
            <div onClick={() => addKpiItem(cat.id)} style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer" }}>+ Add metric definition</div>
          </div>
        </div>
      ))}
      <div onClick={addKpiCategory} style={DASHED_ADD}>+ Add category</div>

      <div style={CARD}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Status legend</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {legendOrder.map((k) => (
            <div key={k} style={{ display: "flex", gap: 10, fontSize: 13 }}>
              <span>{STATUS_META[k].emoji}</span>
              <span><strong>{STATUS_META[k].label}</strong> — <span {...editable(state.statusLegend[k], (v) => updateStatusLegend(k, v))} /></span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: "oklch(0.94 0.01 258)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "oklch(0.4 0.1 258)" }}>J</div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Jira board sync</div>
            <div style={{ fontSize: 12, color: MUTED }}>Not connected · this preview is mocked with sample data</div>
          </div>
        </div>
        <div onClick={toggleJiraPreview} style={{ padding: "9px 16px", background: state.jiraPreview ? INK : "white", color: state.jiraPreview ? "white" : "oklch(0.35 0.01 258)", border: "1px solid oklch(0.85 0.01 258)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {state.jiraPreview ? "Hide sample preview" : "Show sample preview"}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "oklch(0.45 0.01 258)", background: "oklch(0.96 0.015 85)", border: "1px solid oklch(0.85 0.05 85)", borderRadius: 10, padding: "12px 16px", lineHeight: 1.6 }}>
        This tab is a working sketch of what a live sync would show. A real connection needs Jira API credentials held server-side — plan is to wire this up once the app has a backend (e.g. Supabase) so keys aren&apos;t exposed in the browser.
      </div>

      {state.jiraPreview && (
        <>
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Sample synced issues</div>
              <div style={{ fontSize: 11.5, color: MUTED, fontFamily: "var(--font-jetbrains-mono)" }}>Last synced: demo data, not live</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr><th style={TH}>Key</th><th style={TH}>Summary</th><th style={TH}>Status</th><th style={TH}>Assignee</th><th style={TH}>Updated</th><th style={{ width: 28, borderBottom: `2px solid ${BORDER}` }} /></tr>
                </thead>
                <tbody>
                  {state.mockJiraIssues.map((iss) => {
                    const meta = JIRA_ISSUE_STATUS_META[iss.status];
                    return (
                      <tr key={iss.id} style={{ borderBottom: "1px solid oklch(0.94 0.006 258)" }}>
                        <td style={{ ...TD, fontFamily: "var(--font-jetbrains-mono)", color: "oklch(0.4 0.1 258)", fontWeight: 600 }} {...editable(iss.key, (v) => updateJiraIssueField(iss.id, "key", v))} />
                        <td style={TD} {...editable(iss.summary, (v) => updateJiraIssueField(iss.id, "summary", v))} />
                        <td style={{ padding: "6px 10px" }}>
                          <select value={iss.status} onChange={(e) => updateJiraIssueField(iss.id, "status", e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: meta.bg, color: meta.color, border: "none", cursor: "pointer" }}>
                            {jiraStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </td>
                        <td style={{ ...TD, fontSize: 12.5, color: MUTED }} {...editable(iss.assignee, (v) => updateJiraIssueField(iss.id, "assignee", v))} />
                        <td style={{ ...TD, fontSize: 12, color: MUTED, fontFamily: "var(--font-jetbrains-mono)" }} {...editable(iss.updated, (v) => updateJiraIssueField(iss.id, "updated", v))} />
                        <td style={{ textAlign: "center" }}><span onClick={() => removeJiraIssue(iss.id)} style={REMOVE_X}>×</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div onClick={addJiraIssue} style={{ marginTop: 12, ...LINK_BTN }}>+ Add sample issue row</div>
          </div>

          <div style={CARD}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Planned KPI mapping</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.jiraMapping.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ padding: "3px 9px", borderRadius: 6, background: "oklch(0.94 0.01 258)", fontWeight: 600, fontSize: 12 }} {...editable(m.from, (v) => updateJiraMapping(m.id, "from", v))} />
                  <span style={{ color: "oklch(0.6 0.01 258)" }}>→</span>
                  <span style={{ flex: 1, color: "oklch(0.35 0.01 258)" }} {...editable(m.to, (v) => updateJiraMapping(m.id, "to", v))} />
                  <span onClick={() => removeJiraMapping(m.id)} style={{ ...REMOVE_X, fontSize: 14 }}>×</span>
                </div>
              ))}
              <div onClick={addJiraMapping} style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer", marginTop: 2 }}>+ Add mapping row</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReviewQuestionList({ questions, onRespond }: { questions: Review["questions"]; onRespond: (qid: string, value: number | string) => void }) {
  return (
    <>
      {questions.map((q) => (
        <div key={q.id} style={{ borderTop: "1px solid oklch(0.94 0.006 258)", paddingTop: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{q.text}</div>
          {q.type === "score" ? (
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <div
                  key={n}
                  onClick={() => onRespond(q.id, n)}
                  style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${q.response === n ? INK : "oklch(0.88 0.006 258)"}`, background: q.response === n ? INK : "white", color: q.response === n ? "white" : "oklch(0.4 0.01 258)" }}
                >
                  {n}
                </div>
              ))}
            </div>
          ) : (
            <textarea
              value={(q.response as string) ?? ""}
              onChange={(e) => onRespond(q.id, e.target.value)}
              placeholder="Write the answer…"
              style={{ width: "100%", minHeight: 60, padding: "10px 12px", border: "1px solid oklch(0.88 0.006 258)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          )}
        </div>
      ))}
    </>
  );
}

function ReviewsTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const activeReview = state.activeReviewId ? state.reviews.find((r) => r.id === state.activeReviewId) ?? null : null;

  function updateReviewResponse(reviewId: string, qid: string, value: number | string) {
    setState((s) => ({ ...s, reviews: s.reviews.map((r) => (r.id !== reviewId ? r : { ...r, questions: r.questions.map((q) => (q.id !== qid ? q : { ...q, response: value })) })) }));
  }
  function submitReview(reviewId: string) {
    setState((s) => ({ ...s, activeReviewId: null, reviews: s.reviews.map((r) => (r.id !== reviewId ? r : { ...r, status: "submitted", submittedDate: new Date().toISOString().slice(0, 10) })) }));
  }
  function removeReview(id: string) {
    if (!window.confirm("Delete this review request and any collected response? This cannot be undone.")) return;
    setState((s) => ({ ...s, reviews: s.reviews.filter((r) => r.id !== id) }));
  }

  function onDraftField(field: "subjectName" | "reviewerName" | "reviewerRole", value: string) {
    setState((s) => ({ ...s, reviewDraft: { ...s.reviewDraft, [field]: value } }));
  }
  function updateDraftQuestionText(qid: string, value: string) {
    setState((s) => ({ ...s, reviewDraft: { ...s.reviewDraft, questions: s.reviewDraft.questions.map((q) => (q.id !== qid ? q : { ...q, text: value })) } }));
  }
  function updateDraftQuestionType(qid: string, type: QuestionType) {
    setState((s) => ({ ...s, reviewDraft: { ...s.reviewDraft, questions: s.reviewDraft.questions.map((q) => (q.id !== qid ? q : { ...q, type })) } }));
  }
  function addDraftQuestion() {
    setState((s) => ({ ...s, reviewDraft: { ...s.reviewDraft, questions: [...s.reviewDraft.questions, { id: "dq" + Date.now(), text: "New question", type: "text" as QuestionType }] } }));
  }
  function removeDraftQuestion(qid: string) {
    setState((s) => ({ ...s, reviewDraft: { ...s.reviewDraft, questions: s.reviewDraft.questions.filter((q) => q.id !== qid) } }));
  }
  function generateReview() {
    const d = state.reviewDraft;
    if (!d.reviewerName.trim()) { window.alert("Add the reviewer's name first."); return; }
    if (!d.questions.length) { window.alert("Add at least one question first."); return; }
    const id = "rv" + Date.now();
    const token = Math.random().toString(36).slice(2, 10);
    const review: Review = {
      id, token, subjectName: d.subjectName, reviewerName: d.reviewerName.trim(), reviewerRole: d.reviewerRole.trim(),
      status: "pending", requestedDate: new Date().toISOString().slice(0, 10),
      questions: d.questions.map((q) => ({ id: q.id, text: q.text, type: q.type, response: q.type === "score" ? null : "" })),
    };
    const nextSubject = d.subjectName === "Ethan Maxey" ? "Grace Soegiarto" : "Ethan Maxey";
    setState((s) => ({ ...s, reviews: [review, ...s.reviews], reviewDraft: freshDraftQuestions(nextSubject) }));
  }
  function copyReviewLink(token: string) {
    const url = window.location.origin + window.location.pathname + "?review=" + token;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => window.alert("Review link copied to clipboard:\n" + url),
        () => window.alert("Copy this link:\n" + url)
      );
    } else {
      window.alert("Copy this link:\n" + url);
    }
  }

  const reviewSummaries = ["Ethan Maxey", "Grace Soegiarto"].map((name) => {
    const submitted = state.reviews.filter((r) => r.subjectName === name && r.status === "submitted");
    const scores: number[] = [];
    const quotes: { text: string; reviewer: string; roleSuffix: string; question: string }[] = [];
    submitted.forEach((r) => r.questions.forEach((q) => {
      if (q.type === "score" && typeof q.response === "number") scores.push(q.response);
      if (q.type === "text" && q.response && String(q.response).trim()) {
        quotes.push({ text: String(q.response), reviewer: r.reviewerName, roleSuffix: r.reviewerRole ? ` (${r.reviewerRole})` : "", question: q.text });
      }
    }));
    return {
      name, reviewCount: submitted.length,
      avgLabel: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) + " / 10" : "—",
      quotes,
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {activeReview && (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={SECTION_TITLE}>Reviewing {activeReview.subjectName}</div>
              <div style={SECTION_SUB}>Reviewer: {activeReview.reviewerName}{activeReview.reviewerRole ? ` (${activeReview.reviewerRole})` : ""} — use this to preview the reviewer&apos;s form, or to transcribe a response you collected elsewhere</div>
            </div>
            <div onClick={() => setState((s) => ({ ...s, activeReviewId: null }))} style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.45 0.01 258)", cursor: "pointer" }}>Close</div>
          </div>
          <ReviewQuestionList questions={activeReview.questions} onRespond={(qid, value) => updateReviewResponse(activeReview.id, qid, value)} />
          <div onClick={() => submitReview(activeReview.id)} style={{ padding: 10, background: INK, color: "white", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>Save response &amp; mark submitted</div>
        </div>
      )}

      <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={SECTION_TITLE}>Request a review</div>
          <div style={SECTION_SUB}>Pick who it&apos;s about, who&apos;s reviewing, and adjust the questions — then generate a link to send</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={LABEL}>Review is about</label>
            <select value={state.reviewDraft.subjectName} onChange={(e) => onDraftField("subjectName", e.target.value)} style={FIELD}>
              <option value="Ethan Maxey">Ethan Maxey</option>
              <option value="Grace Soegiarto">Grace Soegiarto</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={LABEL}>Reviewer name</label>
            <input type="text" value={state.reviewDraft.reviewerName} onChange={(e) => onDraftField("reviewerName", e.target.value)} placeholder="e.g. Jordan Patel" style={FIELD} />
          </div>
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={LABEL}>Reviewer role / relationship</label>
            <input type="text" value={state.reviewDraft.reviewerRole} onChange={(e) => onDraftField("reviewerRole", e.target.value)} placeholder="e.g. Engagement Lead, Client contact, fellow intern" style={FIELD} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.reviewDraft.questions.map((q) => (
            <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "oklch(0.97 0.004 258)", borderRadius: 8, padding: "8px 10px" }}>
              <select value={q.type} onChange={(e) => updateDraftQuestionType(q.id, e.target.value as QuestionType)} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 6px", borderRadius: 6, border: "1px solid oklch(0.88 0.006 258)", background: "white", cursor: "pointer", flex: "none" }}>
                <option value="score">Score 1-10</option>
                <option value="text">Written</option>
              </select>
              <div style={{ flex: 1, fontSize: 13 }} {...editable(q.text, (v) => updateDraftQuestionText(q.id, v))} />
              <span onClick={() => removeDraftQuestion(q.id)} style={{ ...REMOVE_X, fontSize: 14 }}>×</span>
            </div>
          ))}
          <div onClick={addDraftQuestion} style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.4 0.1 258)", cursor: "pointer" }}>+ Add question</div>
        </div>
        <div onClick={generateReview} style={PRIMARY_BTN}>Generate review link</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.35 0.01 258)" }}>All review requests</div>
        {state.reviews.map((r) => (
          <div key={r.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.subjectName} <span style={{ fontWeight: 500, color: MUTED }}>— reviewed by {r.reviewerName}{r.reviewerRole ? ` (${r.reviewerRole})` : ""}</span></div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{r.questions.length} questions · requested {r.requestedDate}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: r.status === "submitted" ? "oklch(0.94 0.06 150)" : "oklch(0.95 0.06 85)", color: r.status === "submitted" ? "oklch(0.4 0.1 150)" : "oklch(0.5 0.12 85)" }}>
              {r.status === "submitted" ? "Submitted" : "Pending"}
            </span>
            <div onClick={() => copyReviewLink(r.token)} style={{ ...LINK_BTN, whiteSpace: "nowrap" }}>Copy link</div>
            <div onClick={() => setState((s) => ({ ...s, activeReviewId: r.id }))} style={{ ...LINK_BTN, whiteSpace: "nowrap" }}>{r.status === "submitted" ? "View response" : "Preview / enter response"}</div>
            <span onClick={() => removeReview(r.id)} style={REMOVE_X}>×</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.35 0.01 258)" }}>Summary for leadership</div>
        {reviewSummaries.map((sub) => (
          <div key={sub.name} style={CARD}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{sub.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 12, color: MUTED }}>{sub.reviewCount} submitted</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: INK }}>{sub.avgLabel}</div>
              </div>
            </div>
            {sub.quotes.map((quote, i) => (
              <div key={i} style={{ padding: "8px 0", borderTop: "1px solid oklch(0.94 0.006 258)", fontSize: 12.5 }}>
                <div style={{ color: "oklch(0.3 0.01 258)", lineHeight: 1.5 }}>&ldquo;{quote.text}&rdquo;</div>
                <div style={{ color: MUTED, marginTop: 3, fontSize: 11.5 }}>— {quote.reviewer}{quote.roleSuffix}, on &ldquo;{quote.question}&rdquo;</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
