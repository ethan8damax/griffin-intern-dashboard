"use client";

import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
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
  type TabId,
  type NavItem,
  type ProjectStatus,
  type Priority,
  MONTH_NAMES,
  STATUS_META,
  JOURNAL_TAG_META,
  JIRA_ISSUE_STATUS_META,
  REFLECTION_CATEGORY_META,
  PROJECT_STATUS_META,
  PRIORITY_META,
  NAV_STANDALONE_ITEMS,
  NAV_GROUPS,
  TEAM_MEMBERS,
  freshDraftQuestions,
  initialState,
  normalizeState,
  DASHBOARD_DOC_ID,
} from "@/lib/dashboard-data";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type SetAppState = Dispatch<SetStateAction<AppState>>;

const MAROON = "oklch(0.32 0.13 20)";
const MAROON_DEEP = "oklch(0.22 0.11 20)";
const MAROON_TINT = "oklch(0.93 0.045 20)";
const BORDER = "oklch(0.9 0.012 60)";
const MUTED = "oklch(0.55 0.015 50)";
const INK_TEXT = "oklch(0.22 0.02 40)";
const SERIF = "var(--font-serif), Georgia, serif";

const CARD: CSSProperties = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 22px" };
const LABEL: CSSProperties = { fontSize: 11, fontWeight: 600, color: "oklch(0.5 0.015 50)", textTransform: "uppercase", letterSpacing: "0.04em" };
const FIELD: CSSProperties = { padding: "8px 10px", border: "1px solid oklch(0.88 0.012 55)", borderRadius: 7, fontSize: 13 };
const TH: CSSProperties = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "oklch(0.5 0.015 50)", padding: "8px 10px", borderBottom: `2px solid ${BORDER}` };
const TD: CSSProperties = { padding: "9px 10px", fontSize: 13 };
const SECTION_TITLE: CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 2, color: INK_TEXT };
const SECTION_SUB: CSSProperties = { fontSize: 12, color: MUTED, marginBottom: 14 };
const LINK_BTN: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: MAROON, cursor: "pointer", borderRadius: 6, padding: "2px 4px", marginLeft: -4 };
const PRIMARY_BTN: CSSProperties = { padding: "10px 18px", background: MAROON, color: "white", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" };
const REMOVE_X: CSSProperties = { cursor: "pointer", color: "oklch(0.65 0.015 50)", fontSize: 15, borderRadius: 5, padding: "0 3px" };
const DASHED_ADD: CSSProperties = { fontSize: 13, fontWeight: 600, color: MAROON, cursor: "pointer", padding: 10, border: "1px dashed oklch(0.72 0.04 20)", borderRadius: 10, textAlign: "center", background: "white" };
const PILL: CSSProperties = { borderRadius: 999 };

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

function parseMetricNumber(value: string): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function mutedTint(oklchStr: string): string {
  const m = oklchStr.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!m) return oklchStr;
  const l = Math.min(0.85, parseFloat(m[1]) + 0.22);
  const c = parseFloat(m[2]) * 0.45;
  return `oklch(${l.toFixed(2)} ${c.toFixed(3)} ${m[3]})`;
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 64;
  const h = 24;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => [pad + i * stepX, h - pad - ((p - min) / range) * (h - pad * 2)] as const);
  const path = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg width={w} height={h} style={{ display: "block", flex: "none" }}>
      <path d={path} fill="none" stroke={mutedTint(color)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} stroke="white" strokeWidth={1.5} />
    </svg>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 80 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "oklch(0.92 0.008 55)", overflow: "hidden" }}>
        <div style={{ width: `${clamped}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "oklch(0.35 0.015 50)", flex: "none", minWidth: 30, textAlign: "right" }}>{clamped}%</span>
    </div>
  );
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
  return `<div style="margin-bottom:22px;border-bottom:2px solid #4a1220;padding-bottom:14px;">
    <div style="font-size:21px;font-weight:800;color:#4a1220;">Intern Analyst — KPI &amp; Metrics Dashboard</div>
    <div style="font-size:12.5px;color:#555;margin-top:4px;">Grace Soegiarto + Ethan Maxey · Griffin Global / Doeren Mayhew</div>
    <div style="font-size:11.5px;color:#888;margin-top:2px;">${escapeHtml(subtitle)} · Generated ${new Date().toLocaleDateString()}</div>
  </div>`;
}

function renderPeriodSectionHtml(period: Period): string {
  const label = MONTH_NAMES[period.month] + " " + period.year;
  const th = "text-align:left;padding:8px 10px;border-bottom:2px solid #4a1220;font-size:10.5px;text-transform:uppercase;letter-spacing:0.03em;color:#666;";
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
    <h2 style="font-size:19px;margin:0 0 4px;color:#4a1220;">Period: ${label}</h2>
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const searchParams = useSearchParams();

  const dashboardDocRef = doc(db, "dashboard", DASHBOARD_DOC_ID);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(dashboardDocRef);
        if (cancelled) return;
        if (snap.exists()) {
          setState(normalizeState(snap.data() as Partial<AppState>));
        } else {
          const seed = initialState();
          await setDoc(dashboardDocRef, seed);
          setState(seed);
        }
        setLoaded(true);
      } catch (err) {
        if (cancelled) return;
        // Do NOT setLoaded(true) here: the save effect only runs once
        // loaded, and this component's state still holds the initialState()
        // seed data. Enabling saves now would overwrite whatever real
        // document already exists in Firestore. Leaving loaded=false keeps
        // the user on read-only seed data until a page reload retries.
        console.error("Failed to load dashboard state", err);
        setSaveStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await setDoc(dashboardDocRef, state);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save dashboard state", err);
        setSaveStatus("error");
      }
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!loaded) {
    // Block interaction until the initial Firestore fetch resolves.
    // Rendering the seed/stale data as an editable form here would let a
    // user's edit land, then get silently overwritten the moment the fetch
    // finally completes and calls setState with server data.
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "oklch(0.97 0.014 75)", color: MUTED, fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (standaloneReview) {
    return (
      <div style={{ minHeight: "100vh", background: "oklch(0.97 0.014 75)", color: INK_TEXT }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MAROON, textTransform: "uppercase", letterSpacing: "0.04em" }}>Intern Analyst Review Request</div>
            <div style={{ fontSize: 21, fontWeight: 600, marginTop: 4, fontFamily: SERIF }}>You&apos;re reviewing {standaloneReview.subjectName}</div>
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
                          style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${q.response === n ? MAROON : "oklch(0.88 0.012 55)"}`, background: q.response === n ? MAROON : "white", color: q.response === n ? "white" : "oklch(0.4 0.015 50)" }}
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
                      style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: "1px solid oklch(0.88 0.012 55)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                    />
                  )}
                </div>
              ))}
              <div onClick={() => submitReview(standaloneReview.id)} className="ghi-btn-primary" style={{ padding: 12, background: MAROON, color: "white", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
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
      <h2 style="font-size:18px;color:#4a1220;margin-bottom:12px;">Intern Journal</h2>
      ${state.journal.map((j) => {
        const tag = JOURNAL_TAG_META[j.type] ?? JOURNAL_TAG_META.note;
        return `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #eee;">
          <div style="font-size:10.5px;font-weight:700;color:#555;">${tag.label} · ${escapeHtml(j.date)} · ${escapeHtml(j.author)}</div>
          <div style="font-size:13px;margin-top:3px;">${escapeHtml(j.text)}</div>
        </div>`;
      }).join("")}
    </div>`;
    const goalSection = (title: string, goals: AppState["okrs"]) => `<div style="margin-bottom:18px;">
      <div style="font-size:13px;font-weight:700;color:#4a1220;margin-bottom:8px;">${escapeHtml(title)}</div>
      ${goals.map((o) => `<div style="margin-bottom:14px;">
        <div style="font-weight:700;font-size:14px;">${escapeHtml(o.objective)}${o.assignee ? ` <span style="font-weight:500;color:#666;">(${escapeHtml(o.assignee)})</span>` : ""}</div>
        <div style="font-size:11px;color:#777;margin-top:2px;">${STATUS_META[o.status].emoji} ${STATUS_META[o.status].label} · ${o.progress}% complete${o.targetDate ? ` · target ${escapeHtml(o.targetDate)}` : ""}</div>
        <ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;color:#444;">${o.krs.map((k) => `<li>${escapeHtml(k.text)}</li>`).join("")}</ul>
      </div>`).join("")}
    </div>`;
    const okrHtml = `<div style="margin-top:24px;">
      <h2 style="font-size:18px;color:#4a1220;margin-bottom:12px;">Goals</h2>
      ${goalSection("Team Goals", state.okrs.filter((o) => o.owner === "team"))}
      ${goalSection("Individual Goals", state.okrs.filter((o) => o.owner === "individual"))}
    </div>`;
    const prioritiesHtml = `<div style="margin-top:24px;page-break-before:always;">
      <h2 style="font-size:18px;color:#4a1220;margin-bottom:12px;">Weekly Priorities</h2>
      ${state.priorityWeeks.map((w) => `<div style="margin-bottom:16px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${escapeHtml(formatWeekLabel(w.weekOf))}</div>
        <ul style="margin:0 0 0 18px;padding:0;font-size:12.5px;color:#444;">${w.priorities.map((p) => `<li>${escapeHtml(p.text)} — <span style="color:#777;">${escapeHtml(p.owner)}, ${escapeHtml(p.status)}</span></li>`).join("")}</ul>
      </div>`).join("")}
    </div>`;
    const reflectionsHtml = `<div style="margin-top:24px;">
      <h2 style="font-size:18px;color:#4a1220;margin-bottom:12px;">Weekly Reflections</h2>
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "oklch(0.97 0.014 75)", color: INK_TEXT }}>
      <TopNav state={state} setState={setState} saveStatus={saveStatus} onExportFull={exportFullPdf} />

      <div style={{ flex: 1, width: "100%", maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
        {state.activeTab === "dashboard" && (
          <DashboardTab state={state} setState={setState} activePeriod={activePeriod} />
        )}
        {state.activeTab === "profile" && <ProfileTab state={state} setState={setState} />}
        {state.activeTab === "scorecard" && (
          <ScorecardTab state={state} setState={setState} activePeriod={activePeriod} onExportPeriod={() => exportPeriodPdf(activePeriod.id)} />
        )}
        {state.activeTab === "journal" && <JournalTab state={state} setState={setState} />}
        {state.activeTab === "okrs" && <GoalsTab state={state} setState={setState} />}
        {state.activeTab === "projects" && <ProjectsTab state={state} setState={setState} />}
        {state.activeTab === "workload" && <WorkloadTab state={state} setState={setState} />}
        {state.activeTab === "priorities" && <PrioritiesTab state={state} setState={setState} />}
        {state.activeTab === "reflections" && <ReflectionsTab state={state} setState={setState} />}
        {state.activeTab === "feedback" && <FeedbackTab state={state} setState={setState} />}
        {state.activeTab === "reviews" && <ReviewsTab state={state} setState={setState} />}
        {state.activeTab === "reference" && <ReferenceTab state={state} setState={setState} />}
        {state.activeTab === "saved" && <SavedTab state={state} setState={setState} />}
      </div>
    </div>
  );
}

function TopNav({ state, setState, saveStatus, onExportFull }: { state: AppState; setState: SetAppState; saveStatus: "idle" | "saving" | "saved" | "error"; onExportFull: () => void }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectTab(id: TabId) {
    setState((s) => ({ ...s, activeTab: id }));
    setOpenGroup(null);
  }

  function renderMenuItem(item: NavItem) {
    if (item.disabled) {
      return (
        <div
          key={item.id}
          title="Coming soon"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, fontSize: 13, fontWeight: 500, color: "oklch(0.72 0.01 50)", cursor: "not-allowed" }}
        >
          <span>{item.label}</span>
          <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: "oklch(0.6 0.01 50)", background: "oklch(0.94 0.008 55)", padding: "2px 6px", borderRadius: 999, letterSpacing: "0.03em" }}>SOON</span>
        </div>
      );
    }
    const active = state.activeTab === item.id;
    return (
      <div
        key={item.id}
        onClick={() => selectTab(item.id)}
        className="ghi-btn-ghost"
        style={{ padding: "8px 10px", borderRadius: 7, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? MAROON : "oklch(0.35 0.015 50)", background: active ? MAROON_TINT : "transparent", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        {item.label}
      </div>
    );
  }

  function openProfile(name: string) {
    setState((s) => ({ ...s, activeTab: "profile", activeProfileName: name }));
    setOpenGroup(null);
  }

  return (
    <div style={{ background: "white", borderBottom: `1px solid ${BORDER}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 200 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: MAROON, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, fontFamily: SERIF, flex: "none" }}>G</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: SERIF, letterSpacing: "-0.01em", lineHeight: 1.2 }}>Intern Dashboard</div>
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.3 }}>Doeren Mayhew</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, ...FIELD, color: MUTED, minWidth: 200, cursor: "text" }} title="Search — coming soon">
          <span aria-hidden>🔍</span>
          <span style={{ fontSize: 13 }}>Search…</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div ref={navRef} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {NAV_STANDALONE_ITEMS.map((navItem) => {
            const active = state.activeTab === navItem.id;
            return (
              <div
                key={navItem.id}
                onClick={() => selectTab(navItem.id)}
                className="ghi-nav-tab"
                style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: active ? 700 : 500, cursor: "pointer", color: active ? MAROON : MUTED, background: active ? MAROON_TINT : "transparent" }}
              >
                {navItem.label}
              </div>
            );
          })}

          {NAV_GROUPS.map((group) => {
            const groupActive = group.items.some((it) => it.id === state.activeTab);
            const open = openGroup === group.id;
            return (
              <div key={group.id} style={{ position: "relative" }}>
                <div
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  className="ghi-nav-tab"
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: groupActive ? 700 : 500, cursor: "pointer", color: groupActive || open ? MAROON : MUTED, background: groupActive ? MAROON_TINT : "transparent", userSelect: "none" }}
                >
                  <span>{group.label}</span>
                  <span className="ghi-chevron" style={{ fontSize: 9, display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </div>
                {open && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 210, background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 8px 24px oklch(0.2 0.02 40 / 0.14)", padding: 6, zIndex: 30, display: "flex", flexDirection: "column", gap: 2 }}>
                    {group.items.map((item) => renderMenuItem(item))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11.5, color: saveStatus === "error" ? "oklch(0.5 0.16 25)" : MUTED, whiteSpace: "nowrap" }}>
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed — check connection"}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div onClick={() => openProfile("Grace Soegiarto")} className="ghi-avatar" title="View Grace Soegiarto's profile" style={{ width: 26, height: 26, borderRadius: "50%", background: MAROON, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, border: "2px solid white", cursor: "pointer" }}>GS</div>
          <div onClick={() => openProfile("Ethan Maxey")} className="ghi-avatar" title="View Ethan Maxey's profile" style={{ width: 26, height: 26, borderRadius: "50%", background: MAROON_DEEP, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, border: "2px solid white", marginLeft: -8, cursor: "pointer" }}>EM</div>
        </div>
        <div onClick={onExportFull} className="ghi-btn-primary" style={{ padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "white", background: MAROON, cursor: "pointer", whiteSpace: "nowrap" }}>
          Export full internship PDF
        </div>
      </div>
    </div>
  );
}

function DashboardTab({ state, setState, activePeriod }: { state: AppState; setState: SetAppState; activePeriod: Period }) {
  function go(tab: TabId) {
    setState((s) => ({ ...s, activeTab: tab }));
  }
  function sectionLink(label: string, tab: TabId) {
    return (
      <div onClick={() => go(tab)} className="ghi-btn-ghost" style={{ ...LINK_BTN, marginLeft: "auto" }}>{label} &rarr;</div>
    );
  }

  const order: Status[] = ["green", "yellow", "red", "gray"];

  const scorecardCounts: Record<Status, number> = { green: 0, yellow: 0, red: 0, gray: 0 };
  activePeriod.scorecard.forEach((r) => { scorecardCounts[r.status] += 1; });

  const goalCounts: Record<Status, number> = { green: 0, yellow: 0, red: 0, gray: 0 };
  state.okrs.forEach((o) => { goalCounts[o.status] += 1; });

  const activePriorityWeek = state.priorityWeeks.find((w) => w.id === state.activePriorityWeekId) ?? state.priorityWeeks[state.priorityWeeks.length - 1];
  const priorityCounts: Record<PriorityStatus, number> = { Done: 0, "In Progress": 0, "Not Started": 0, Blocked: 0 };
  activePriorityWeek?.priorities.forEach((p) => { priorityCounts[p.status] += 1; });

  const recentJournal = state.journal.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.dashboard ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, dashboard: v } })))}
      />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ ...CARD, flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={SECTION_TITLE}>Scorecard — {MONTH_NAMES[activePeriod.month]} {activePeriod.year}</div>
            {sectionLink("View scorecard", "scorecard")}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {order.map((k) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: STATUS_META[k].color }}>{scorecardCounts[k]}</div>
                <div style={{ fontSize: 10.5, color: MUTED, textAlign: "center" }}>{STATUS_META[k].label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...CARD, flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={SECTION_TITLE}>Goals</div>
            {sectionLink("View goals", "okrs")}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {order.map((k) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: STATUS_META[k].color }}>{goalCounts[k]}</div>
                <div style={{ fontSize: 10.5, color: MUTED, textAlign: "center" }}>{STATUS_META[k].label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activePriorityWeek && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <div style={SECTION_TITLE}>This week&apos;s priorities — {formatWeekLabel(activePriorityWeek.weekOf)}</div>
            {sectionLink("View priorities", "priorities")}
          </div>
          <div style={SECTION_SUB}>{priorityCounts.Done} done, {priorityCounts["In Progress"]} in progress, {priorityCounts["Not Started"]} not started, {priorityCounts.Blocked} blocked</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activePriorityWeek.priorities.slice(0, 5).map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ flex: 1, color: "oklch(0.3 0.015 50)" }}>{p.text}</span>
                <span style={{ fontSize: 11.5, color: MUTED }}>{p.owner}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: MAROON }}>{p.status}</span>
              </div>
            ))}
            {activePriorityWeek.priorities.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>No priorities set for this week yet.</div>}
          </div>
        </div>
      )}

      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={SECTION_TITLE}>Recent journal entries</div>
          {sectionLink("View journal", "journal")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recentJournal.map((entry) => {
            const tag = JOURNAL_TAG_META[entry.type] ?? JOURNAL_TAG_META.note;
            return (
              <div key={entry.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ ...PILL, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", background: tag.bg, color: tag.color, flex: "none" }}>{tag.label}</span>
                <span style={{ fontSize: 13, color: "oklch(0.3 0.015 50)", flex: 1 }}>{entry.text}</span>
                <span style={{ fontSize: 11, color: MUTED, flex: "none" }}>{entry.date}</span>
              </div>
            );
          })}
          {recentJournal.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>No journal entries yet.</div>}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const person = state.activeProfileName;
  const profile = state.internProfiles[person] ?? state.internProfiles[TEAM_MEMBERS[0]];

  function selectPerson(name: string) {
    setState((s) => ({ ...s, activeProfileName: name }));
  }
  function updateProfileField(field: "role" | "manager" | "department" | "startDate" | "bio", value: string) {
    setState((s) => ({ ...s, internProfiles: { ...s.internProfiles, [person]: { ...s.internProfiles[person], [field]: value } } }));
  }

  const order: Status[] = ["green", "yellow", "red", "gray"];

  const individualGoals = state.okrs.filter((o) => o.owner === "individual" && o.assignee === person);
  const goalCounts: Record<Status, number> = { green: 0, yellow: 0, red: 0, gray: 0 };
  individualGoals.forEach((o) => { goalCounts[o.status] += 1; });

  const activePriorityWeek = state.priorityWeeks.find((w) => w.id === state.activePriorityWeekId) ?? state.priorityWeeks[state.priorityWeeks.length - 1];
  const myPriorities = activePriorityWeek ? activePriorityWeek.priorities.filter((p) => p.owner === person) : [];

  const activeReflectionWeek = state.reflectionWeeks.find((w) => w.id === state.activeReflectionWeekId) ?? state.reflectionWeeks[state.reflectionWeeks.length - 1];
  const mySelfReflections = activeReflectionWeek ? activeReflectionWeek.entries.filter((e) => e.category === "self" && e.author === person) : [];
  const peerNotesAboutMe = activeReflectionWeek ? activeReflectionWeek.entries.filter((e) => e.category === "peer" && e.subject === person) : [];

  const myReviews = state.reviews.filter((r) => r.subjectName === person);
  const submittedReviews = myReviews.filter((r) => r.status === "submitted");
  const scores: number[] = [];
  submittedReviews.forEach((r) => r.questions.forEach((q) => { if (q.type === "score" && typeof q.response === "number") scores.push(q.response); }));
  const kpiScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {TEAM_MEMBERS.map((name) => {
          const active = name === person;
          return (
            <div
              key={name}
              onClick={() => selectPerson(name)}
              className="ghi-pill"
              style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", color: active ? "white" : "oklch(0.35 0.015 50)", background: active ? MAROON : "white", border: `1px solid ${active ? MAROON : BORDER}` }}
            >
              {name}
            </div>
          );
        })}
      </div>

      <div style={{ ...CARD, display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: MAROON, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flex: "none" }}>{profile.initials}</div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 20, fontWeight: 600, fontFamily: SERIF }}>{profile.name}</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }} {...editable(profile.role, (v) => updateProfileField("role", v))} />
          <div style={{ fontSize: 12.5, color: "oklch(0.35 0.015 50)", marginTop: 8, lineHeight: 1.5 }} {...editable(profile.bio, (v) => updateProfileField("bio", v))} />
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 12 }}>
            <div>
              <div style={LABEL}>Manager</div>
              <div style={{ fontSize: 12.5, marginTop: 2 }} {...editable(profile.manager, (v) => updateProfileField("manager", v))} />
            </div>
            <div>
              <div style={LABEL}>Department</div>
              <div style={{ fontSize: 12.5, marginTop: 2 }} {...editable(profile.department, (v) => updateProfileField("department", v))} />
            </div>
            <div>
              <div style={LABEL}>Started</div>
              <input type="date" value={profile.startDate} onChange={(e) => updateProfileField("startDate", e.target.value)} style={{ fontSize: 12.5, marginTop: 2, border: "1px solid oklch(0.88 0.012 55)", borderRadius: 6, padding: "3px 6px" }} />
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", flex: "none" }}>
          <div style={LABEL}>KPI Score</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: MAROON, lineHeight: 1.2 }}>{kpiScore !== null ? kpiScore.toFixed(1) + " / 10" : "—"}</div>
          <div style={{ fontSize: 10.5, color: MUTED }}>from submitted reviews</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ ...CARD, flex: 1, minWidth: 220 }}>
          <div style={SECTION_TITLE}>Goals</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {order.map((k) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: STATUS_META[k].color }}>{goalCounts[k]}</div>
                <div style={{ fontSize: 9.5, color: MUTED, textAlign: "center" }}>{STATUS_META[k].label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...CARD, flex: 1, minWidth: 220 }}>
          <div style={SECTION_TITLE}>Reviews</div>
          <div style={{ fontSize: 13, marginTop: 10, color: "oklch(0.3 0.015 50)" }}>{submittedReviews.length} submitted · {myReviews.length - submittedReviews.length} pending</div>
        </div>
        <div style={{ ...CARD, flex: 1, minWidth: 220 }}>
          <div style={SECTION_TITLE}>Reflection activity</div>
          <div style={{ fontSize: 13, marginTop: 10, color: "oklch(0.3 0.015 50)" }}>{mySelfReflections.length} self-reflection{mySelfReflections.length === 1 ? "" : "s"} · {peerNotesAboutMe.length} peer note{peerNotesAboutMe.length === 1 ? "" : "s"} this week</div>
        </div>
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>Individual goals</div>
        <div style={SECTION_SUB}>Read-only — edit under Planning → Goals</div>
        {individualGoals.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>No individual goals set yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {individualGoals.map((o) => (
            <div key={o.id} style={{ borderTop: "1px solid oklch(0.94 0.008 55)", paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{STATUS_META[o.status].emoji}</span>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{o.objective}</span>
                {o.targetDate && <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>target {o.targetDate}</span>}
              </div>
              <div style={{ marginTop: 6 }}>
                <ProgressBar percent={o.progress} color={STATUS_META[o.status].color} />
              </div>
              {o.krs.length > 0 && (
                <ul style={{ margin: "6px 0 0 22px", padding: 0, fontSize: 12.5, color: "oklch(0.35 0.015 50)" }}>
                  {o.krs.map((k) => <li key={k.id}>{k.text}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>This week&apos;s priorities</div>
        <div style={SECTION_SUB}>{activePriorityWeek ? formatWeekLabel(activePriorityWeek.weekOf) : "No week set"} — Read-only — edit under Planning → Weekly Priorities</div>
        {myPriorities.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>No priorities assigned this week.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myPriorities.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ flex: 1, color: "oklch(0.3 0.015 50)" }}>{p.text}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: MAROON }}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>Review status</div>
        <div style={SECTION_SUB}>Read-only — manage under Performance → 360 Feedback</div>
        {myReviews.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>No reviews requested yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myReviews.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ flex: 1, fontSize: 13, color: "oklch(0.3 0.015 50)" }}>Reviewed by {r.reviewerName}{r.reviewerRole ? ` (${r.reviewerRole})` : ""}</span>
              <span style={{ fontSize: 11.5, color: MUTED }}>{r.requestedDate}</span>
              <span style={{ ...PILL, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: r.status === "submitted" ? "oklch(0.94 0.06 150)" : "oklch(0.95 0.06 85)", color: r.status === "submitted" ? "oklch(0.4 0.1 150)" : "oklch(0.5 0.12 85)" }}>
                {r.status === "submitted" ? "Submitted" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "oklch(0.45 0.015 50)", background: "oklch(0.96 0.015 85)", border: "1px solid oklch(0.85 0.05 85)", borderRadius: 10, padding: "12px 16px", lineHeight: 1.6 }}>
        <strong>Assumptions &amp; limitations:</strong> role, bio, manager, department, and start date are editable here (click text to edit, like the rest of the dashboard) and save to the shared Firestore document — there&apos;s no per-user login, so anyone with the link can edit anyone&apos;s profile. The goals/priorities/reflections/reviews sections below stay read-only rollups of data owned by their own tabs; edit those under Planning/Performance instead. The name itself isn&apos;t editable here since it&apos;s used as the lookup key across goals, priorities, and reviews — renaming a person would need a real person-ID system as a future enhancement. &quot;KPI Score&quot; is currently the average of this person&apos;s submitted review scores only, since the Scorecard is tracked at the engagement level rather than per intern; attributing individual scorecard metrics to a person is a future enhancement. &quot;Department&quot; shows the client engagement rather than a corporate department, since this is a consulting internship, not a multi-department org. Other future enhancements: a profile photo/avatar upload, an activity timeline combining journal + reflections + goal updates in one feed, and exporting a single-person PDF summary (today&apos;s PDF export is engagement-wide only).
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

  const periodsSorted = [...state.periods].sort((a, b) => (a.year - b.year) || (a.month - b.month));
  function metricSeries(name: string): number[] {
    return periodsSorted
      .map((p) => p.scorecard.find((r) => r.metric === name))
      .map((r) => (r ? parseMetricNumber(r.actual) : null))
      .filter((n): n is number => n !== null);
  }

  const findRow = (name: string) => activePeriod.scorecard.find((r) => r.metric === name);
  const onTime = findRow("On-time delivery rate");
  const shipped = findRow("Deliverables shipped");
  const accuracy = findRow("Data accuracy");
  const feedback = findRow("Lead / client feedback");
  const statCards = [
    { label: "On-time delivery", value: onTime?.actual || "—", target: onTime?.target || "—", color: STATUS_META[onTime?.status ?? "gray"].color, series: metricSeries("On-time delivery rate") },
    { label: "Deliverables shipped", value: shipped?.actual || "—", target: shipped?.target || "—", color: STATUS_META[shipped?.status ?? "gray"].color, series: metricSeries("Deliverables shipped") },
    { label: "Data accuracy", value: accuracy?.actual || "Pending", target: accuracy?.target || "—", color: STATUS_META[accuracy?.status ?? "gray"].color, series: metricSeries("Data accuracy") },
    { label: "Client feedback", value: feedback?.actual || "Pending", target: feedback?.target || "—", color: STATUS_META[feedback?.status ?? "gray"].color, series: metricSeries("Lead / client feedback") },
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
  const donutGradient = segments.length ? `conic-gradient(${segments.join(", ")})` : "oklch(0.9 0.012 55)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {riskRows.length > 0 && (
        <div style={{ background: "oklch(0.97 0.03 40)", border: "1px solid oklch(0.82 0.08 40)", borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "oklch(0.4 0.13 40)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Needs attention this period</div>
          {riskRows.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13 }}>
              <span>{STATUS_META[r.status].emoji}</span>
              <span style={{ fontWeight: 700, color: "oklch(0.3 0.02 40)" }}>{r.metric}</span>
              <span style={{ color: "oklch(0.45 0.02 40)" }}>{r.notes ? `— ${r.notes}` : "(no note added yet)"}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ flex: 1, minWidth: 190, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 1px 2px oklch(0.2 0.02 40 / 0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={LABEL}>{card.label}</div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: card.color }} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: INK_TEXT, letterSpacing: "-0.01em" }}>{card.value}</div>
                <div style={{ fontSize: 11, color: MUTED }}>Target {card.target}</div>
              </div>
              <Sparkline points={card.series} color={card.color} />
            </div>
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
                <span style={{ fontWeight: 700, color: INK_TEXT }}>{counts[k]}</span>
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
              style={{ padding: "7px 8px 7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${active ? MAROON : "oklch(0.88 0.012 55)"}`, background: active ? MAROON : "white", color: active ? "white" : "oklch(0.35 0.015 50)" }}
            >
              <span>{MONTH_NAMES[p.month]} {p.year}</span>
              <span
                title="Delete this period"
                onClick={(e) => { e.stopPropagation(); removePeriod(p.id); }}
                style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 5px", borderRadius: 999, color: active ? "oklch(0.85 0.03 20)" : "oklch(0.6 0.015 50)" }}
              >
                ×
              </span>
            </div>
          );
        })}
        <div onClick={addPeriod} className="ghi-btn-ghost" style={{ fontSize: 12.5, fontWeight: 600, color: MAROON, cursor: "pointer", padding: "7px 12px", border: "1px dashed oklch(0.72 0.04 20)", borderRadius: 999 }}>+ New period</div>
        <div onClick={onExportPeriod} className="ghi-btn-primary" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "white", cursor: "pointer", padding: "7px 14px", borderRadius: 9, background: MAROON }}>Export this period as PDF</div>
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
                <tr key={row.id} style={{ borderBottom: "1px solid oklch(0.94 0.008 55)" }}>
                  <td style={{ ...TD, fontWeight: 600, color: "oklch(0.35 0.02 40)", minWidth: 100 }} {...editable(row.category, (v) => updateScoreField(row.id, "category", v))} />
                  <td style={{ ...TD, minWidth: 150 }} {...editable(row.metric, (v) => updateScoreField(row.id, "metric", v))} />
                  <td style={{ ...TD, color: MUTED, minWidth: 90 }} {...editable(row.target, (v) => updateScoreField(row.id, "target", v))} />
                  <td style={{ ...TD, fontWeight: 700, minWidth: 80 }} {...editable(row.actual, (v) => updateScoreField(row.id, "actual", v))} />
                  <td style={{ padding: "6px 10px" }}>
                    <select value={row.status} onChange={(e) => updateScoreField(row.id, "status", e.target.value)} style={{ fontSize: 12.5, padding: "5px 10px", borderRadius: 999, border: "1px solid oklch(0.88 0.012 55)", background: "white", cursor: "pointer" }}>
                      {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...TD, fontSize: 12.5, color: "oklch(0.4 0.015 50)", minWidth: 200 }} {...editable(row.notes, (v) => updateScoreField(row.id, "notes", v))} />
                  <td style={{ textAlign: "center" }}><span onClick={() => removeScoreRow(row.id)} className="ghi-x" style={REMOVE_X}>×</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div onClick={addScoreRow} className="ghi-btn-ghost" style={{ marginTop: 12, ...LINK_BTN }}>+ Add metric row</div>
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
                <tr key={w.id} style={{ borderBottom: "1px solid oklch(0.94 0.008 55)" }}>
                  <td style={{ ...TD, fontWeight: 600, minWidth: 200 }} {...editable(w.item, (v) => updateWorkField(w.id, "item", v))} />
                  <td style={{ ...TD, fontSize: 12.5, color: MUTED, minWidth: 130 }} {...editable(w.type, (v) => updateWorkField(w.id, "type", v))} />
                  <td style={{ ...TD, fontSize: 12.5, color: MUTED, minWidth: 130 }} {...editable(w.category, (v) => updateWorkField(w.id, "category", v))} />
                  <td style={{ padding: "6px 10px" }}>
                    <select value={w.status} onChange={(e) => updateWorkField(w.id, "status", e.target.value)} style={{ fontSize: 12.5, padding: "5px 10px", borderRadius: 999, border: "1px solid oklch(0.88 0.012 55)", background: "white", cursor: "pointer" }}>
                      {workStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>
                  <td style={{ ...TD, fontSize: 12.5, color: MAROON, minWidth: 160 }} {...editable(w.evidence, (v) => updateWorkField(w.id, "evidence", v))} />
                  <td style={{ textAlign: "center" }}><span onClick={() => removeWorkRow(w.id)} className="ghi-x" style={REMOVE_X}>×</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div onClick={addWorkRow} className="ghi-btn-ghost" style={{ marginTop: 12, ...LINK_BTN }}>+ Add work item</div>
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
          <div onClick={submitJournal} className="ghi-btn-primary" style={{ padding: "9px 16px", background: MAROON, color: "white", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add entry</div>
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
                style={{ ...PILL, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: tag.bg, color: tag.color, border: "none", flex: "none", marginTop: 1, cursor: "pointer" }}
              >
                <option value="win">WIN</option>
                <option value="blocker">BLOCKER</option>
                <option value="checkin">CHECK-IN</option>
                <option value="note">NOTE</option>
              </select>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 13.5, color: "oklch(0.25 0.015 50)", lineHeight: 1.5 }} {...editable(entry.text, (v) => updateJournalField(entry.id, "text", v))} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="date" value={entry.date} onChange={(e) => updateJournalField(entry.id, "date", e.target.value)} style={{ fontSize: 11.5, color: MUTED, fontFamily: "var(--font-jetbrains-mono)", border: "none", background: "transparent", padding: 0, cursor: "pointer" }} />
                  <span style={{ fontSize: 11.5, color: MUTED }}>·</span>
                  <select value={entry.author} onChange={(e) => updateJournalField(entry.id, "author", e.target.value)} style={{ fontSize: 11.5, color: MUTED, fontFamily: "var(--font-jetbrains-mono)", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
                    {authorOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <span onClick={() => removeJournalEntry(entry.id)} className="ghi-x" style={REMOVE_X}>×</span>
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
      okrs: [...s.okrs, { id: "o" + Date.now(), objective: owner === "team" ? "New team goal" : "New individual goal", owner, assignee: owner === "individual" ? TEAM_MEMBERS[0] : "", status: "gray" as Status, targetDate: "", progress: 0, krs: [] }],
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
  function updateObjectiveProgress(id: string, value: number) {
    const clamped = Math.max(0, Math.min(100, value));
    setState((s) => ({ ...s, okrs: s.okrs.map((o) => (o.id !== id ? o : { ...o, progress: clamped })) }));
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
  const pillSelect: CSSProperties = { fontSize: 12, padding: "5px 10px", borderRadius: 999, border: "1px solid oklch(0.88 0.012 55)", background: "white", cursor: "pointer" };

  function renderGoalCard(obj: AppState["okrs"][number], index: number) {
    return (
      <div key={obj.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: MAROON, flex: "none", marginTop: 2 }}>Goal {index + 1}</span>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: INK_TEXT }} {...editable(obj.objective, (v) => updateObjectiveText(obj.id, v))} />
          <span onClick={() => removeObjective(obj.id)} className="ghi-x" style={REMOVE_X}>&times;</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12, paddingLeft: 22 }}>
          {obj.owner === "individual" && (
            <select value={obj.assignee} onChange={(e) => updateObjectiveField(obj.id, "assignee", e.target.value)} style={pillSelect}>
              {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select value={obj.status} onChange={(e) => updateObjectiveField(obj.id, "status", e.target.value)} style={pillSelect}>
            {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11.5, color: MUTED }}>Target date</span>
            <input type="date" value={obj.targetDate} onChange={(e) => updateObjectiveField(obj.id, "targetDate", e.target.value)} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid oklch(0.88 0.012 55)" }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingLeft: 22 }}>
          <span style={{ fontSize: 11.5, color: MUTED, flex: "none" }}>Progress</span>
          <input
            type="range" min={0} max={100} step={5} value={obj.progress}
            onChange={(e) => updateObjectiveProgress(obj.id, Number(e.target.value))}
            style={{ flex: "none", width: 90, accentColor: MAROON }}
          />
          <ProgressBar percent={obj.progress} color={STATUS_META[obj.status].color} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 22 }}>
          {obj.krs.map((kr) => (
            <div key={kr.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.7 0.02 40)", flex: "none" }} />
              <div style={{ flex: 1, fontSize: 13, color: "oklch(0.35 0.015 50)" }} {...editable(kr.text, (v) => updateKrText(obj.id, kr.id, v))} />
              <span onClick={() => removeKr(obj.id, kr.id)} className="ghi-x" style={{ ...REMOVE_X, fontSize: 13, color: "oklch(0.75 0.015 50)" }}>&times;</span>
            </div>
          ))}
          <div onClick={() => addKr(obj.id)} className="ghi-btn-ghost" style={{ fontSize: 12, fontWeight: 600, color: MAROON, cursor: "pointer", marginTop: 2, borderRadius: 6, padding: "2px 4px", marginLeft: -4 }}>+ Add key result</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.okrs ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, okrs: v } })))}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={SECTION_TITLE}>Team Goals</div>
        {teamGoals.map((obj, i) => renderGoalCard(obj, i))}
        <div onClick={() => addObjective("team")} className="ghi-btn-ghost" style={DASHED_ADD}>+ Add team goal</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={SECTION_TITLE}>Individual Goals</div>
        {individualGoals.map((obj, i) => renderGoalCard(obj, i))}
        <div onClick={() => addObjective("individual")} className="ghi-btn-ghost" style={DASHED_ADD}>+ Add individual goal</div>
      </div>
    </div>
  );
}

function ProjectsTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const projectStatusOptions: ProjectStatus[] = ["Not Started", "In Progress", "Complete", "Blocked"];
  const priorityOptions: Priority[] = ["Low", "Medium", "High"];
  const pillSelect: CSSProperties = { fontSize: 12, padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 700 };
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function addProject(owner: string) {
    setState((s) => ({
      ...s,
      projects: [...s.projects, { id: "pr" + Date.now(), name: "New project", owner, assignedBy: "", status: "Not Started" as ProjectStatus, dueDate: "", githubRepo: "", jiraTicket: "", deliverables: "", estimatedTime: "", priority: "Medium" as Priority }],
    }));
  }
  function removeProject(id: string) {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }));
  }
  function updateProjectField(id: string, field: "name" | "assignedBy" | "status" | "dueDate" | "githubRepo" | "jiraTicket" | "deliverables" | "estimatedTime" | "priority", value: string) {
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id !== id ? p : { ...p, [field]: value })) }));
  }
  function reorderProject(owner: string, fromId: string, toId: string) {
    setState((s) => {
      const mine = s.projects.filter((p) => p.owner === owner);
      const fromIdx = mine.findIndex((p) => p.id === fromId);
      const toIdx = mine.findIndex((p) => p.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return s;
      const reordered = [...mine];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      let i = 0;
      const projects = s.projects.map((p) => (p.owner === owner ? reordered[i++] : p));
      return { ...s, projects };
    });
  }

  function renderProjectCard(p: AppState["projects"][number]) {
    const isDragging = draggedId === p.id;
    const isDragOver = dragOverId === p.id && draggedId !== p.id;
    return (
      <div
        key={p.id}
        onDragOver={(e) => { e.preventDefault(); if (draggedId && draggedId !== p.id) setDragOverId(p.id); }}
        onDragLeave={() => setDragOverId((id) => (id === p.id ? null : id))}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedId && draggedId !== p.id) reorderProject(p.owner, draggedId, p.id);
          setDraggedId(null);
          setDragOverId(null);
        }}
        style={{ background: "white", border: `${isDragOver ? 2 : 1}px solid ${isDragOver ? MAROON : BORDER}`, borderRadius: 12, padding: "18px 22px", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s ease-out, border-color 0.15s ease-out" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <span
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggedId(p.id); }}
            onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
            title="Drag to reorder"
            style={{ cursor: "grab", color: MUTED, fontSize: 15, flex: "none", marginTop: 2, userSelect: "none", lineHeight: 1 }}
          >
            ⠿
          </span>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: INK_TEXT }} {...editable(p.name, (v) => updateProjectField(p.id, "name", v))} />
          <span onClick={() => removeProject(p.id)} className="ghi-x" style={REMOVE_X}>&times;</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <select value={p.status} onChange={(e) => updateProjectField(p.id, "status", e.target.value)} style={{ ...pillSelect, background: PROJECT_STATUS_META[p.status].bg, color: PROJECT_STATUS_META[p.status].color }}>
            {projectStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <select value={p.priority} onChange={(e) => updateProjectField(p.id, "priority", e.target.value)} style={{ ...pillSelect, background: PRIORITY_META[p.priority].bg, color: PRIORITY_META[p.priority].color }}>
            {priorityOptions.map((opt) => <option key={opt} value={opt}>{opt} priority</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11.5, color: MUTED }}>Due</span>
            <input type="date" value={p.dueDate} onChange={(e) => updateProjectField(p.id, "dueDate", e.target.value)} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid oklch(0.88 0.012 55)" }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, fontSize: 12.5, marginBottom: 12 }}>
          <div>
            <div style={LABEL}>Assigned by</div>
            <div style={{ marginTop: 3 }} {...editable(p.assignedBy, (v) => updateProjectField(p.id, "assignedBy", v))} />
          </div>
          <div>
            <div style={LABEL}>Estimated time</div>
            <div style={{ marginTop: 3 }} {...editable(p.estimatedTime, (v) => updateProjectField(p.id, "estimatedTime", v))} />
          </div>
          <div>
            <div style={LABEL}>GitHub repo</div>
            <div style={{ marginTop: 3, color: MAROON, fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5 }} {...editable(p.githubRepo, (v) => updateProjectField(p.id, "githubRepo", v))} />
          </div>
          <div>
            <div style={LABEL}>Jira epic/ticket (optional)</div>
            <div style={{ marginTop: 3, fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5 }} {...editable(p.jiraTicket, (v) => updateProjectField(p.id, "jiraTicket", v))} />
          </div>
        </div>
        <div>
          <div style={LABEL}>Deliverables</div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: "oklch(0.35 0.015 50)" }} {...editable(p.deliverables, (v) => updateProjectField(p.id, "deliverables", v))} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.projects ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, projects: v } })))}
      />

      {TEAM_MEMBERS.map((name) => {
        const myProjects = state.projects.filter((p) => p.owner === name);
        return (
          <div key={name} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={SECTION_TITLE}>{name}&apos;s Projects</div>
            {myProjects.map((p) => renderProjectCard(p))}
            <div onClick={() => addProject(name)} className="ghi-btn-ghost" style={DASHED_ADD}>+ Add project for {name}</div>
          </div>
        );
      })}
    </div>
  );
}

function WorkloadTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const person = state.activeProfileName;

  function selectPerson(name: string) {
    setState((s) => ({ ...s, activeProfileName: name }));
  }
  function updateCapacity(value: number) {
    const clamped = Math.max(0, Math.min(100, value));
    setState((s) => ({ ...s, workloads: { ...s.workloads, [person]: clamped } }));
  }

  const myProjects = state.projects.filter((p) => p.owner === person);
  const assignedByList = Array.from(new Set(myProjects.map((p) => p.assignedBy).filter(Boolean)));
  const isBlocked = myProjects.some((p) => p.status === "Blocked");
  const capacity = state.workloads[person] ?? 0;

  const upcomingDeadlines = myProjects
    .filter((p) => p.dueDate && p.status !== "Complete")
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  function formatDayLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  const capacityColor = capacity >= 90 ? "oklch(0.58 0.19 25)" : capacity >= 70 ? "oklch(0.75 0.15 85)" : "oklch(0.6 0.14 150)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.workload ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, workload: v } })))}
      />

      <div style={{ display: "flex", gap: 8 }}>
        {TEAM_MEMBERS.map((name) => {
          const active = name === person;
          return (
            <div
              key={name}
              onClick={() => selectPerson(name)}
              className="ghi-pill"
              style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", color: active ? "white" : "oklch(0.35 0.015 50)", background: active ? MAROON : "white", border: `1px solid ${active ? MAROON : BORDER}` }}
            >
              {name}
            </div>
          );
        })}
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>Current Capacity</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          <input type="range" min={0} max={100} step={5} value={capacity} onChange={(e) => updateCapacity(Number(e.target.value))} style={{ flex: "none", width: 160, accentColor: capacityColor }} />
          <ProgressBar percent={capacity} color={capacityColor} />
        </div>
        {isBlocked && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "oklch(0.45 0.14 25)" }}>⚠ Blocked on at least one project</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ ...CARD, flex: 1, minWidth: 200 }}>
          <div style={SECTION_TITLE}>Projects</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {myProjects.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span>{p.status === "Complete" ? "✓" : p.status === "Blocked" ? "⛔" : "•"}</span>
                <span style={{ color: "oklch(0.3 0.015 50)" }}>{p.name}</span>
              </div>
            ))}
            {myProjects.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>No projects yet.</div>}
          </div>
        </div>
        <div style={{ ...CARD, flex: 1, minWidth: 200 }}>
          <div style={SECTION_TITLE}>Assigned By</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {assignedByList.map((name) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "oklch(0.3 0.015 50)" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.7 0.02 40)", flex: "none" }} />
                {name}
              </div>
            ))}
            {assignedByList.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>Nobody assigned yet.</div>}
          </div>
        </div>
        <div style={{ ...CARD, flex: 1, minWidth: 200 }}>
          <div style={SECTION_TITLE}>Upcoming Deadlines</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {upcomingDeadlines.map((p) => (
              <div key={p.id} style={{ fontSize: 13, color: "oklch(0.3 0.015 50)" }}>{formatDayLabel(p.dueDate)}</div>
            ))}
            {upcomingDeadlines.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>Nothing due soon.</div>}
          </div>
        </div>
        <div style={{ ...CARD, flex: 1, minWidth: 160 }}>
          <div style={SECTION_TITLE}>Blocked?</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10, color: isBlocked ? "oklch(0.58 0.19 25)" : "oklch(0.6 0.14 150)" }}>{isBlocked ? "Yes" : "No"}</div>
        </div>
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>At a glance</div>
        <div style={SECTION_SUB}>Every project for {person}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={TH}>Project</th><th style={TH}>Mentor</th><th style={TH}>Status</th><th style={TH}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {myProjects.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid oklch(0.94 0.008 55)" }}>
                  <td style={{ ...TD, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...TD, color: MUTED }}>{p.assignedBy || "—"}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <span style={{ ...PILL, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: PROJECT_STATUS_META[p.status].bg, color: PROJECT_STATUS_META[p.status].color }}>{p.status}</span>
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <span style={{ ...PILL, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: PRIORITY_META[p.priority].bg, color: PRIORITY_META[p.priority].color }}>{p.priority}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            style={{ padding: "7px 8px 7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${active ? MAROON : "oklch(0.88 0.012 55)"}`, background: active ? MAROON : "white", color: active ? "white" : "oklch(0.35 0.015 50)" }}
          >
            <span>{formatWeekLabel(w.weekOf)}</span>
            <span
              title="Delete this week"
              onClick={(e) => { e.stopPropagation(); onRemove(w.id); }}
              style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 5px", borderRadius: 999, color: active ? "oklch(0.85 0.03 20)" : "oklch(0.6 0.015 50)" }}
            >
              &times;
            </span>
          </div>
        );
      })}
      <div onClick={onAdd} className="ghi-btn-ghost" style={{ fontSize: 12.5, fontWeight: 600, color: MAROON, cursor: "pointer", padding: "7px 12px", border: "1px dashed oklch(0.72 0.04 20)", borderRadius: 999 }}>+ New week</div>
    </div>
  );
}

function PrioritiesTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const activeWeek = state.priorityWeeks.find((w) => w.id === state.activePriorityWeekId) ?? state.priorityWeeks[state.priorityWeeks.length - 1];
  const priorityOwners = [...TEAM_MEMBERS, "Team"];
  const priorityStatusOptions: PriorityStatus[] = ["Not Started", "In Progress", "Done", "Blocked"];
  const pillSelect: CSSProperties = { fontSize: 12, padding: "5px 10px", borderRadius: 999, border: "1px solid oklch(0.88 0.012 55)", background: "white", cursor: "pointer" };

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
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.priorities ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, priorities: v } })))}
      />
      <WeekPicker weeks={state.priorityWeeks} activeWeekId={activeWeek.id} onSelect={(id) => setState((s) => ({ ...s, activePriorityWeekId: id }))} onAdd={addWeek} onRemove={removeWeek} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {priorityStatusOptions.map((st) => (
          <div key={st} style={{ flex: 1, minWidth: 120, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={LABEL}>{st}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: INK_TEXT }}>{counts[st]}</div>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>{formatWeekLabel(activeWeek.weekOf)}</div>
        <div style={SECTION_SUB}>Who owns it, where it stands, and, if relevant, which goal it moves forward</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeWeek.priorities.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "oklch(0.97 0.01 65)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, fontWeight: 600 }} {...editable(p.text, (v) => updateField(p.id, "text", v))} />
              <select value={p.owner} onChange={(e) => updateField(p.id, "owner", e.target.value)} style={pillSelect}>
                {priorityOwners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={p.status} onChange={(e) => updateField(p.id, "status", e.target.value)} style={pillSelect}>
                {priorityStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <select value={p.linkedGoalId ?? ""} onChange={(e) => updateField(p.id, "linkedGoalId", e.target.value)} style={{ ...pillSelect, maxWidth: 220 }}>
                <option value="">No linked goal</option>
                {state.okrs.map((o) => <option key={o.id} value={o.id}>{o.objective.length > 40 ? o.objective.slice(0, 40) + "..." : o.objective}</option>)}
              </select>
              <span onClick={() => removePriority(p.id)} className="ghi-x" style={REMOVE_X}>&times;</span>
            </div>
          ))}
        </div>
        <div onClick={addPriority} className="ghi-btn-ghost" style={{ marginTop: 12, ...LINK_BTN }}>+ Add priority</div>
      </div>
    </div>
  );
}

function ReflectionsTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  const activeWeek = state.reflectionWeeks.find((w) => w.id === state.activeReflectionWeekId) ?? state.reflectionWeeks[state.reflectionWeeks.length - 1];
  const categories: ReflectionCategory[] = ["self", "peer", "work"];
  const pillSelect: CSSProperties = { fontSize: 12, padding: "4px 9px", borderRadius: 999, border: "1px solid oklch(0.88 0.012 55)", background: "white", cursor: "pointer" };

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
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.reflections ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, reflections: v } })))}
      />
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
                <div key={entry.id} style={{ background: "oklch(0.97 0.01 65)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ ...PILL, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: meta.bg, color: meta.color, flex: "none" }}>{meta.label}</span>
                    <select value={entry.author} onChange={(e) => updateField(entry.id, "author", e.target.value)} style={pillSelect}>
                      {(cat === "work" ? [...TEAM_MEMBERS, "Team"] : TEAM_MEMBERS).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {cat === "peer" && (
                      <>
                        <span style={{ fontSize: 11.5, color: MUTED }}>about</span>
                        <select value={entry.subject} onChange={(e) => updateField(entry.id, "subject", e.target.value)} style={pillSelect}>
                          {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </>
                    )}
                    <span onClick={() => removeEntry(entry.id)} className="ghi-x" style={{ ...REMOVE_X, marginLeft: "auto" }}>&times;</span>
                  </div>
                  <textarea
                    value={entry.text}
                    onChange={(e) => updateField(entry.id, "text", e.target.value)}
                    placeholder="Write the reflection..."
                    style={{ width: "100%", minHeight: 56, padding: "9px 11px", border: "1px solid oklch(0.88 0.012 55)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", background: "white" }}
                  />
                </div>
              ))}
            </div>
            <div onClick={() => addEntry(cat)} className="ghi-btn-ghost" style={{ marginTop: 12, ...LINK_BTN }}>+ Add {cat === "self" ? "self-reflection" : cat === "peer" ? "peer reflection" : "team reflection"}</div>
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
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.reference ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, reference: v } })))}
      />

      {state.kpiDefs.map((cat) => (
        <div key={cat.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: MAROON }} {...editable(cat.title, (v) => updateKpiCategoryTitle(cat.id, v))} />
            <span onClick={() => removeKpiCategory(cat.id)} className="ghi-x" style={REMOVE_X}>×</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cat.items.map((it) => (
              <div key={it.id} style={{ paddingTop: 12, borderTop: "1px solid oklch(0.94 0.008 55)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }} {...editable(it.name, (v) => updateKpiItemField(cat.id, it.id, "name", v))} />
                  <span onClick={() => removeKpiItem(cat.id, it.id)} className="ghi-x" style={{ ...REMOVE_X, fontSize: 14 }}>×</span>
                </div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.015 50)", lineHeight: 1.6 }}><strong>Measures:</strong> <span {...editable(it.measures, (v) => updateKpiItemField(cat.id, it.id, "measures", v))} /></div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.015 50)", lineHeight: 1.6 }}><strong>Target:</strong> <span {...editable(it.target, (v) => updateKpiItemField(cat.id, it.id, "target", v))} /></div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.015 50)", lineHeight: 1.6, fontFamily: "var(--font-jetbrains-mono)" }}><strong style={{ fontFamily: "var(--font-inter)" }}>Formula:</strong> <span {...editable(it.formula, (v) => updateKpiItemField(cat.id, it.id, "formula", v))} /></div>
                <div style={{ fontSize: 12.5, color: "oklch(0.4 0.015 50)", lineHeight: 1.6 }}><strong>Source:</strong> <span {...editable(it.source, (v) => updateKpiItemField(cat.id, it.id, "source", v))} /></div>
              </div>
            ))}
            <div onClick={() => addKpiItem(cat.id)} className="ghi-btn-ghost" style={{ fontSize: 12, fontWeight: 600, color: MAROON, cursor: "pointer", borderRadius: 6, padding: "2px 4px", marginLeft: -4 }}>+ Add metric definition</div>
          </div>
        </div>
      ))}
      <div onClick={addKpiCategory} className="ghi-btn-ghost" style={DASHED_ADD}>+ Add category</div>

      <div style={CARD}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: INK_TEXT }}>Status legend</div>
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
          <div style={{ width: 40, height: 40, borderRadius: 9, background: MAROON_TINT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: MAROON }}>J</div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Jira board sync</div>
            <div style={{ fontSize: 12, color: MUTED }}>Not connected · this preview is mocked with sample data</div>
          </div>
        </div>
        <div onClick={toggleJiraPreview} className="ghi-btn-ghost" style={{ padding: "9px 16px", background: state.jiraPreview ? MAROON : "white", color: state.jiraPreview ? "white" : "oklch(0.35 0.015 50)", border: "1px solid oklch(0.85 0.015 50)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {state.jiraPreview ? "Hide sample preview" : "Show sample preview"}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "oklch(0.45 0.015 50)", background: "oklch(0.96 0.015 85)", border: "1px solid oklch(0.85 0.05 85)", borderRadius: 10, padding: "12px 16px", lineHeight: 1.6 }}>
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
                      <tr key={iss.id} style={{ borderBottom: "1px solid oklch(0.94 0.008 55)" }}>
                        <td style={{ ...TD, fontFamily: "var(--font-jetbrains-mono)", color: MAROON, fontWeight: 600 }} {...editable(iss.key, (v) => updateJiraIssueField(iss.id, "key", v))} />
                        <td style={TD} {...editable(iss.summary, (v) => updateJiraIssueField(iss.id, "summary", v))} />
                        <td style={{ padding: "6px 10px" }}>
                          <select value={iss.status} onChange={(e) => updateJiraIssueField(iss.id, "status", e.target.value)} style={{ ...PILL, fontSize: 12, fontWeight: 600, padding: "3px 10px", background: meta.bg, color: meta.color, border: "none", cursor: "pointer" }}>
                            {jiraStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </td>
                        <td style={{ ...TD, fontSize: 12.5, color: MUTED }} {...editable(iss.assignee, (v) => updateJiraIssueField(iss.id, "assignee", v))} />
                        <td style={{ ...TD, fontSize: 12, color: MUTED, fontFamily: "var(--font-jetbrains-mono)" }} {...editable(iss.updated, (v) => updateJiraIssueField(iss.id, "updated", v))} />
                        <td style={{ textAlign: "center" }}><span onClick={() => removeJiraIssue(iss.id)} className="ghi-x" style={REMOVE_X}>×</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div onClick={addJiraIssue} className="ghi-btn-ghost" style={{ marginTop: 12, ...LINK_BTN }}>+ Add sample issue row</div>
          </div>

          <div style={CARD}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Planned KPI mapping</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.jiraMapping.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ ...PILL, padding: "3px 10px", background: MAROON_TINT, color: MAROON, fontWeight: 600, fontSize: 12 }} {...editable(m.from, (v) => updateJiraMapping(m.id, "from", v))} />
                  <span style={{ color: "oklch(0.6 0.015 50)" }}>→</span>
                  <span style={{ flex: 1, color: "oklch(0.35 0.015 50)" }} {...editable(m.to, (v) => updateJiraMapping(m.id, "to", v))} />
                  <span onClick={() => removeJiraMapping(m.id)} className="ghi-x" style={{ ...REMOVE_X, fontSize: 14 }}>×</span>
                </div>
              ))}
              <div onClick={addJiraMapping} className="ghi-btn-ghost" style={{ fontSize: 12, fontWeight: 600, color: MAROON, cursor: "pointer", marginTop: 2, borderRadius: 6, padding: "2px 4px", marginLeft: -4 }}>+ Add mapping row</div>
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
        <div key={q.id} style={{ borderTop: "1px solid oklch(0.94 0.008 55)", paddingTop: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{q.text}</div>
          {q.type === "score" ? (
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <div
                  key={n}
                  onClick={() => onRespond(q.id, n)}
                  style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${q.response === n ? MAROON : "oklch(0.88 0.012 55)"}`, background: q.response === n ? MAROON : "white", color: q.response === n ? "white" : "oklch(0.4 0.015 50)" }}
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
              style={{ width: "100%", minHeight: 60, padding: "10px 12px", border: "1px solid oklch(0.88 0.012 55)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          )}
        </div>
      ))}
    </>
  );
}

function FeedbackTab({ state, setState }: { state: AppState; setState: SetAppState }) {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {activeReview && (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={SECTION_TITLE}>Reviewing {activeReview.subjectName}</div>
              <div style={SECTION_SUB}>Reviewer: {activeReview.reviewerName}{activeReview.reviewerRole ? ` (${activeReview.reviewerRole})` : ""} — use this to preview the reviewer&apos;s form, or to transcribe a response you collected elsewhere</div>
            </div>
            <div onClick={() => setState((s) => ({ ...s, activeReviewId: null }))} className="ghi-btn-ghost" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.45 0.015 50)", cursor: "pointer", borderRadius: 6, padding: "2px 6px" }}>Close</div>
          </div>
          <ReviewQuestionList questions={activeReview.questions} onRespond={(qid, value) => updateReviewResponse(activeReview.id, qid, value)} />
          <div onClick={() => submitReview(activeReview.id)} className="ghi-btn-primary" style={{ padding: 10, background: MAROON, color: "white", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>Save response &amp; mark submitted</div>
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
            <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "oklch(0.97 0.01 65)", borderRadius: 8, padding: "8px 10px" }}>
              <select value={q.type} onChange={(e) => updateDraftQuestionType(q.id, e.target.value as QuestionType)} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 6px", borderRadius: 6, border: "1px solid oklch(0.88 0.012 55)", background: "white", cursor: "pointer", flex: "none" }}>
                <option value="score">Score 1-10</option>
                <option value="text">Written</option>
              </select>
              <div style={{ flex: 1, fontSize: 13 }} {...editable(q.text, (v) => updateDraftQuestionText(q.id, v))} />
              <span onClick={() => removeDraftQuestion(q.id)} className="ghi-x" style={{ ...REMOVE_X, fontSize: 14 }}>×</span>
            </div>
          ))}
          <div onClick={addDraftQuestion} className="ghi-btn-ghost" style={{ fontSize: 12, fontWeight: 600, color: MAROON, cursor: "pointer", borderRadius: 6, padding: "2px 4px", marginLeft: -4 }}>+ Add question</div>
        </div>
        <div onClick={generateReview} className="ghi-btn-primary" style={PRIMARY_BTN}>Generate review link</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.35 0.015 50)" }}>All review requests</div>
        {state.reviews.map((r) => (
          <div key={r.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.subjectName} <span style={{ fontWeight: 500, color: MUTED }}>— reviewed by {r.reviewerName}{r.reviewerRole ? ` (${r.reviewerRole})` : ""}</span></div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{r.questions.length} questions · requested {r.requestedDate}</div>
            </div>
            <span style={{ ...PILL, fontSize: 11, fontWeight: 700, padding: "3px 11px", background: r.status === "submitted" ? "oklch(0.94 0.06 150)" : "oklch(0.95 0.06 85)", color: r.status === "submitted" ? "oklch(0.4 0.1 150)" : "oklch(0.5 0.12 85)" }}>
              {r.status === "submitted" ? "Submitted" : "Pending"}
            </span>
            <div onClick={() => copyReviewLink(r.token)} className="ghi-btn-ghost" style={{ ...LINK_BTN, whiteSpace: "nowrap" }}>Copy link</div>
            <div onClick={() => setState((s) => ({ ...s, activeReviewId: r.id }))} className="ghi-btn-ghost" style={{ ...LINK_BTN, whiteSpace: "nowrap" }}>{r.status === "submitted" ? "View response" : "Preview / enter response"}</div>
            <span onClick={() => removeReview(r.id)} className="ghi-x" style={REMOVE_X}>×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsTab({ state, setState }: { state: AppState; setState: SetAppState }) {
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
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.reviews ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, reviews: v } })))}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.35 0.015 50)" }}>All review requests</div>
        {state.reviews.map((r) => (
          <div key={r.id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.subjectName} <span style={{ fontWeight: 500, color: MUTED }}>— reviewed by {r.reviewerName}{r.reviewerRole ? ` (${r.reviewerRole})` : ""}</span></div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{r.questions.length} questions · requested {r.requestedDate}{r.submittedDate ? ` · submitted ${r.submittedDate}` : ""}</div>
            </div>
            <span style={{ ...PILL, fontSize: 11, fontWeight: 700, padding: "3px 11px", background: r.status === "submitted" ? "oklch(0.94 0.06 150)" : "oklch(0.95 0.06 85)", color: r.status === "submitted" ? "oklch(0.4 0.1 150)" : "oklch(0.5 0.12 85)" }}>
              {r.status === "submitted" ? "Submitted" : "Pending"}
            </span>
          </div>
        ))}
        {state.reviews.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>No reviews yet — go to 360 Feedback to request one.</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.35 0.015 50)" }}>Summary for leadership</div>
        {reviewSummaries.map((sub) => (
          <div key={sub.name} style={CARD}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{sub.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 12, color: MUTED }}>{sub.reviewCount} submitted</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: MAROON }}>{sub.avgLabel}</div>
              </div>
            </div>
            {sub.quotes.map((quote, i) => (
              <div key={i} style={{ padding: "8px 0", borderTop: "1px solid oklch(0.94 0.008 55)", fontSize: 12.5 }}>
                <div style={{ color: "oklch(0.3 0.015 50)", lineHeight: 1.5 }}>&ldquo;{quote.text}&rdquo;</div>
                <div style={{ color: MUTED, marginTop: 3, fontSize: 11.5 }}>— {quote.reviewer}{quote.roleSuffix}, on &ldquo;{quote.question}&rdquo;</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SavedTab({ state, setState }: { state: AppState; setState: SetAppState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{ fontSize: 12.5, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}
        {...editable(state.tabDescriptions.saved ?? "", (v) => setState((s) => ({ ...s, tabDescriptions: { ...s.tabDescriptions, saved: v } })))}
      />
      <div style={{ ...CARD, textAlign: "center", padding: "48px 22px", color: MUTED }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⭐</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK_TEXT, marginBottom: 4 }}>Nothing saved yet</div>
        <div style={{ fontSize: 12.5 }}>Coming soon.</div>
      </div>
    </div>
  );
}
