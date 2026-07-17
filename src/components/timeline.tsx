// src/components/timeline.tsx
"use client";

import { useState } from "react";

export interface TimelineMilestone {
  id: string;
  title: string;
  date: number | null;
  status: "upcoming" | "complete";
  kind: "standard" | "custom";
  notes?: string | null;
}

interface TimelineProps {
  uid: string;
  milestones: TimelineMilestone[];
  editable: boolean;
  onAdd?: (formData: FormData) => void | Promise<void>;
  onUpdate?: (formData: FormData) => void | Promise<void>;
  onDelete?: (formData: FormData) => void | Promise<void>;
}

function formatDate(date: number | null): string {
  return date === null ? "TBD" : new Date(date).toLocaleDateString();
}

function dateInputValue(date: number | null): string {
  return date === null ? "" : new Date(date).toISOString().slice(0, 10);
}

function dotColor(milestone: TimelineMilestone): string {
  return milestone.kind === "standard" ? "#4a7" : "#c93";
}

export function Timeline({
  uid,
  milestones,
  editable,
  onAdd = async () => {},
  onUpdate = async () => {},
  onDelete = async () => {},
}: TimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const sorted = [...milestones].sort(
    (a, b) => (a.date ?? Infinity) - (b.date ?? Infinity)
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
        {sorted.map((milestone, index) => {
          const above = index % 2 === 0;
          const isExpanded = expandedId === milestone.id;
          const color = dotColor(milestone);

          return (
            <div
              key={milestone.id}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 160, flexShrink: 0 }}
            >
              <div style={{ height: 32, display: "flex", alignItems: "flex-end", fontSize: 12, textAlign: "center" }}>
                {above ? milestone.title : ""}
              </div>
              <div style={{ height: 20, width: 1, background: above ? "#888" : "transparent" }} />
              <div style={{ width: "100%", height: 2, background: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : milestone.id)}
                  aria-label={`${milestone.title}, ${milestone.status}`}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: `2px solid ${color}`,
                    background: milestone.status === "complete" ? color : "transparent",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              </div>
              <div style={{ height: 20, width: 1, background: above ? "transparent" : "#888" }} />
              <div style={{ height: 32, display: "flex", alignItems: "flex-start", fontSize: 12, textAlign: "center" }}>
                {above ? "" : milestone.title}
              </div>

              {isExpanded && (
                <div style={{ border: "1px solid #888", borderRadius: 8, padding: 12, marginTop: 8, width: 200, textAlign: "left" }}>
                  {editable ? (
                    <form action={onUpdate}>
                      <input type="hidden" name="uid" value={uid} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <label>
                        Title
                        <input name="title" defaultValue={milestone.title} required />
                      </label>
                      <label>
                        Date
                        <input type="date" name="date" defaultValue={dateInputValue(milestone.date)} />
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={milestone.status}>
                          <option value="upcoming">Upcoming</option>
                          <option value="complete">Complete</option>
                        </select>
                      </label>
                      <label>
                        Notes
                        <textarea name="notes" defaultValue={milestone.notes ?? ""} />
                      </label>
                      <button type="submit">Save</button>
                    </form>
                  ) : (
                    <>
                      <p>
                        {formatDate(milestone.date)} —{" "}
                        {milestone.status === "complete" ? "Complete" : "Upcoming"}
                      </p>
                      {milestone.notes && <p>{milestone.notes}</p>}
                    </>
                  )}
                  {editable && (
                    <form action={onDelete}>
                      <input type="hidden" name="uid" value={uid} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <button type="submit">Delete</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && (
        <div style={{ marginTop: 16 }}>
          {adding ? (
            <form
              action={async (formData: FormData) => {
                await onAdd(formData);
                setAdding(false);
              }}
            >
              <input type="hidden" name="uid" value={uid} />
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Date
                <input type="date" name="date" />
              </label>
              <label>
                Notes
                <textarea name="notes" />
              </label>
              <button type="submit">Add</button>
              <button type="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)}>
              + Add milestone
            </button>
          )}
        </div>
      )}
    </div>
  );
}
