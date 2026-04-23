import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

function getToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token") || null;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data?.detail
        ? typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail)
        : text || "Request failed";
    throw new Error(msg);
  }

  return data;
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sv-SE");
}

function formatDateTime(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("sv-SE");
}

/** ---- board config ---- */
const COLUMNS = [
  {
    id: "new",
    title: "New",
    helper: "Untriaged",
    tint: "from-slate-50 to-white",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
  },
  {
    id: "triaged",
    title: "Triaged",
    helper: "Ready to pick up",
    tint: "from-sky-50 to-white",
    ring: "ring-sky-200",
    dot: "bg-sky-500",
  },
  {
    id: "in_progress",
    title: "In Progress",
    helper: "Being fixed",
    tint: "from-amber-50 to-white",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
  },
  {
    id: "fixed",
    title: "Fixed",
    helper: "Awaiting retest",
    tint: "from-emerald-50 to-white",
    ring: "ring-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    id: "retest_pending",
    title: "Retest Pending",
    helper: "Verify in build",
    tint: "from-violet-50 to-white",
    ring: "ring-violet-200",
    dot: "bg-violet-500",
  },
  {
    id: "verified",
    title: "Verified",
    helper: "Confirmed fixed",
    tint: "from-teal-50 to-white",
    ring: "ring-teal-200",
    dot: "bg-teal-500",
  },
  {
    id: "reopened",
    title: "Reopened",
    helper: "Failed retest",
    tint: "from-rose-50 to-white",
    ring: "ring-rose-200",
    dot: "bg-rose-500",
  },
];

const SEVERITY_STYLES = {
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const PRIORITY_STYLES = {
  critical: "bg-rose-600 text-white",
  high: "bg-orange-600 text-white",
  medium: "bg-amber-600 text-white",
  low: "bg-sky-600 text-white",
};

function Pill({ className, children, title }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
  );
}

function Button({ variant = "primary", className, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-300",
    secondary:
      "bg-white/80 text-slate-800 border border-slate-200 hover:bg-white focus:ring-slate-300",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100/70 border border-transparent focus:ring-slate-300",
  };

  return <button className={cn(base, variants[variant], className)} {...props} />;
}

function IconButton({ className, title, children, ...props }) {
  return (
    <button
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-700 " +
          "hover:bg-white hover:text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, hint, className }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/40 bg-white/70 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] backdrop-blur p-4",
        className
      )}
    >
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export default function BugBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [bugs, setBugs] = useState([]);
  const [project, setProject] = useState(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  // UI state
  const [draggedBug, setDraggedBug] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("all");
  const [priority, setPriority] = useState("all");
  const [onlyReopened, setOnlyReopened] = useState(false);

  const toastRef = useRef(null);
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(""), 2400);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      // project is optional
      try {
        const proj = await apiFetch(`/api/projects/${projectId}`);
        setProject(proj);
      } catch (e) {
        setProject(null);
      }

      const bugData = await apiFetch(`/api/bug_reports?project_id=${projectId}`);
      setBugs(Array.isArray(bugData) ? bugData : []);
    } catch (err) {
      setError(err?.message || "Failed to load bugs");
    } finally {
      setLoading(false);
    }
  }

  const filteredBugs = useMemo(() => {
    let list = Array.isArray(bugs) ? bugs : [];

    const qq = (q || "").trim().toLowerCase();
    if (qq) {
      list = list.filter((b) => {
        const hay = `${b.id} ${b.title || ""} ${b.description || ""}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    if (severity !== "all") {
      list = list.filter((b) => String(b.severity || "").toLowerCase() === severity);
    }
    if (priority !== "all") {
      list = list.filter((b) => String(b.priority || "").toLowerCase() === priority);
    }
    if (onlyReopened) {
      list = list.filter((b) => String(b.status || "").toLowerCase() === "reopened");
    }

    return list;
  }, [bugs, q, severity, priority, onlyReopened]);

  const counts = useMemo(() => {
    const map = new Map(COLUMNS.map((c) => [c.id, 0]));
    for (const b of filteredBugs) {
      const s = String(b.status || "new");
      map.set(s, (map.get(s) || 0) + 1);
    }
    return map;
  }, [filteredBugs]);

  const total = filteredBugs.length;

  const ageHint = useMemo(() => {
    if (!filteredBugs.length) return "—";
    const newest = filteredBugs
      .map((b) => new Date(b.created_at || 0).getTime())
      .filter((t) => Number.isFinite(t) && t > 0)
      .sort((a, b) => b - a)[0];
    if (!newest) return "—";
    return `Latest: ${formatDateTime(new Date(newest).toISOString())}`;
  }, [filteredBugs]);

  async function updateBugStatus(bugId, newStatus, comment = null) {
    // optimistic update
    const prev = bugs;
    setBugs((cur) => cur.map((b) => (b.id === bugId ? { ...b, status: newStatus } : b)));

    try {
      setUpdating(true);
      await apiFetch(`/api/bug_reports/${bugId}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: newStatus,
          comment: comment || `Status changed to ${newStatus}`,
        }),
      });
      showToast("Status updated");
    } catch (err) {
      // rollback
      setBugs(prev);
      setError(err?.message || "Failed to update bug status");
      showToast("Update failed");
    } finally {
      setUpdating(false);
    }
  }

  function handleDragStart(e, bug) {
    setDraggedBug(bug);
    e.dataTransfer.effectAllowed = "move";
    // needed for some browsers
    e.dataTransfer.setData("text/plain", String(bug.id));
    e.currentTarget.classList.add("opacity-60");
  }

  function handleDragEnd(e) {
    e.currentTarget.classList.remove("opacity-60");
    setDraggedBug(null);
    setDragOverCol(null);
  }

  function handleDragOver(e, columnId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== columnId) setDragOverCol(columnId);
  }

  function handleDrop(e, columnId) {
    e.preventDefault();
    setDragOverCol(null);

    if (!draggedBug) return;
    const newStatus = columnId;

    if (String(draggedBug.status || "new") !== String(newStatus)) {
      updateBugStatus(draggedBug.id, newStatus);
    }
  }

  function bugsByStatus(status) {
    return filteredBugs.filter((b) => String(b.status || "new") === status);
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.10),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.10),transparent_40%)] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <p className="text-slate-700 font-semibold">Loading bug board…</p>
          <p className="mt-1 text-sm text-slate-500">Fetching bugs & project details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.10),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.10),transparent_40%)]">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 border-b border-white/40 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* left */}
            <div className="flex items-center gap-3">
              <IconButton
                title="Back to Project"
                onClick={() => navigate(`/projects/${projectId}`)}
                className="shrink-0"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 19l-7-7 7-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </IconButton>

              <div>
                <div className="flex items-center gap-2">
                  <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm" />
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                      Bug Board
                    </h1>
                    <p className="text-sm text-slate-600">
                      {project?.name ? (
                        <>
                          <span className="font-semibold">{project.name}</span>{" "}
                          <span className="text-slate-400">•</span> Project #{projectId}
                        </>
                      ) : (
                        <>Project #{projectId}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* right actions */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button variant="secondary" onClick={loadData} disabled={updating}>
                Refresh
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/bugs`)}>
                📋 List View
              </Button>
              <Button onClick={() => navigate(`/projects/${projectId}/bugs/new`)}>
                + New Bug
              </Button>
            </div>
          </div>

          {/* controls */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="text-[11px] font-semibold text-slate-600">Search</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by id, title, description…"
                  className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                {q ? (
                  <button
                    onClick={() => setQ("")}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    title="Clear"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-600">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              >
                {["all", "critical", "high", "medium", "low"].map((v) => (
                  <option key={v} value={v}>
                    {v === "all" ? "All" : v}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-600">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              >
                {["all", "critical", "high", "medium", "low"].map((v) => (
                  <option key={v} value={v}>
                    {v === "all" ? "All" : v}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-[11px] font-semibold text-slate-600">Quick toggles</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                <input
                  id="onlyReopened"
                  type="checkbox"
                  checked={onlyReopened}
                  onChange={(e) => setOnlyReopened(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="onlyReopened" className="text-sm text-slate-700">
                  Only reopened
                </label>
              </div>
            </div>
          </div>

          {/* stats */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Visible bugs" value={total} hint={ageHint} />
            <StatCard label="New" value={counts.get("new") || 0} />
            <StatCard label="In progress" value={counts.get("in_progress") || 0} />
            <StatCard label="Retest pending" value={counts.get("retest_pending") || 0} />
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <div className="font-semibold">Error</div>
              <div className="mt-1">{error}</div>
            </div>
          ) : null}

          {toast ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {toast}
            </div>
          ) : null}
        </div>
      </div>

      {/* Board */}
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="flex gap-4 overflow-x-auto pb-6">
          {COLUMNS.map((col) => {
            const colBugs = bugsByStatus(col.id);
            const isOver = dragOverCol === col.id;

            return (
              <div
                key={col.id}
                className="w-[340px] shrink-0"
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column shell */}
                <div
                  className={cn(
                    "rounded-2xl ring-1 ring-inset bg-gradient-to-b shadow-[0_1px_0_0_rgba(15,23,42,0.04)]",
                    col.ring,
                    col.tint,
                    isOver ? "ring-2 ring-blue-400" : ""
                  )}
                >
                  {/* Column header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", col.dot)} />
                          <h3 className="text-sm font-extrabold tracking-tight text-slate-900">
                            {col.title}
                          </h3>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{col.helper}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Pill className="bg-white text-slate-700 ring-slate-200" title="Count">
                          {colBugs.length}
                        </Pill>
                      </div>
                    </div>
                  </div>

                  {/* Column body */}
                  <div className="px-3 pb-3">
                    <div
                      className={cn(
                        "rounded-xl border border-white/50 bg-white/55 backdrop-blur",
                        "min-h-[420px] max-h-[calc(100vh-340px)] overflow-y-auto p-2 space-y-2"
                      )}
                    >
                      {colBugs.length === 0 ? (
                        <EmptyColumn isOver={isOver} />
                      ) : (
                        colBugs.map((bug) => (
                          <BugCard
                            key={bug.id}
                            bug={bug}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onClick={() => navigate(`/projects/${projectId}/bugs/${bug.id}`)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* tiny footer hint */}
                <div className="mt-2 text-[11px] text-slate-500">
                  Drop cards here to move to <span className="font-semibold">{col.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Updating overlay */}
      {updating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/40 bg-white/80 px-5 py-4 shadow-xl flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            <div className="text-sm font-semibold text-slate-800">Updating status…</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyColumn({ isOver }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed px-3 py-10 text-center text-sm",
        isOver ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white/40 text-slate-500"
      )}
    >
      <div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-white/70 ring-1 ring-slate-200 flex items-center justify-center">
        <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14m-7-7h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {isOver ? "Release to move here" : "No bugs"}
      <div className="mt-1 text-[11px] opacity-80">Drag a card into this column</div>
    </div>
  );
}

function BugCard({ bug, onDragStart, onDragEnd, onClick }) {
  const sev = String(bug.severity || "").toLowerCase();
  const pri = String(bug.priority || "").toLowerCase();

  const sevStyle = SEVERITY_STYLES[sev] || "bg-slate-50 text-slate-700 ring-slate-200";
  const priStyle = PRIORITY_STYLES[pri] || "bg-slate-600 text-white";

  // Optional fields (safe)
  const created = formatDate(bug.created_at);
  const updated = bug.updated_at ? formatDate(bug.updated_at) : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bug)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]",
        "hover:shadow-md hover:border-blue-200 transition",
        "p-3"
      )}
    >
      {/* top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500">#{bug.id}</span>
          {bug.test_case_id ? (
            <Pill className="bg-slate-50 text-slate-700 ring-slate-200" title="Test case">
              TC {bug.test_case_id}
            </Pill>
          ) : null}
        </div>

        <Pill className={cn("ring-1", sevStyle)} title="Severity">
          {sev ? sev.toUpperCase() : "—"}
        </Pill>
      </div>

      {/* title */}
      <div className="mt-2">
        <div className="text-sm font-extrabold leading-snug text-slate-900 line-clamp-2">
          {bug.title || "Untitled bug"}
        </div>
        {bug.description ? (
          <div className="mt-1 text-xs text-slate-600 line-clamp-2">{bug.description}</div>
        ) : null}
      </div>

      {/* meta chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold",
            priStyle
          )}
          title="Priority"
        >
          P: {pri || "—"}
        </span>

        {bug.reported_by_user_name || bug.reported_by_user_id ? (
          <Pill className="bg-white text-slate-700 ring-slate-200" title="Reported by">
            {bug.reported_by_user_name ? bug.reported_by_user_name : `User #${bug.reported_by_user_id}`}
          </Pill>
        ) : null}

        {bug.execution_id ? (
          <Pill className="bg-indigo-50 text-indigo-700 ring-indigo-200" title="Linked execution">
            Exec #{bug.execution_id}
          </Pill>
        ) : null}
      </div>

      {/* footer */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <span title={bug.created_at ? formatDateTime(bug.created_at) : ""}>Created {created}</span>
        {updated ? <span title={bug.updated_at ? formatDateTime(bug.updated_at) : ""}>Updated {updated}</span> : <span />}
      </div>

      {/* subtle hint */}
      <div className="mt-2 text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
        Drag to change status • Click to open
      </div>
    </div>
  );
}
