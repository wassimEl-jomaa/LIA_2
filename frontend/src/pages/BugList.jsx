import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

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

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function Badge({ children, tone = "slate" }) {
  const base = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border";
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return <span className={`${base} ${tones[tone] || tones.slate}`}>{children}</span>;
}

function toneFromSeverity(sev) {
  switch ((sev || "").toLowerCase()) {
    case "critical":
      return "rose";
    case "high":
      return "amber";
    case "medium":
      return "purple";
    case "low":
      return "green";
    default:
      return "slate";
  }
}

function toneFromStatus(st) {
  switch ((st || "").toLowerCase()) {
    case "open":
      return "blue";
    case "triaged":
      return "purple";
    case "in_progress":
      return "amber";
    case "resolved":
      return "green";
    case "closed":
      return "slate";
    default:
      return "slate";
  }
}

export default function BugList() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const requirementId = searchParams.get("requirementId") || "";
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "newest"); // newest|oldest|severity

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    steps_to_reproduce: "",
    expected_result: "",
    actual_result: "",
    environment: "",
    severity: "medium",
    priority: "medium",
    status: "open",
    requirement_id: requirementId ? Number(requirementId) : null,
    test_case_id: null,
    test_execution_id: null,
  });

  useEffect(() => {
    if (!getToken()) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (!projectId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const q = new URLSearchParams({ project_id: String(projectId) });
      if (requirementId) q.set("requirement_id", requirementId);
      if (status) q.set("status", status);
      if (severity) q.set("severity", severity);

      const data = await apiFetch(`/api/bug_reports?${q.toString()}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Failed to load bugs");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function syncUrl(next = {}) {
    const params = new URLSearchParams(searchParams);
    const setOrDel = (k, v) => {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, String(v));
    };

    setOrDel("q", next.q ?? query);
    setOrDel("status", next.status ?? status);
    setOrDel("severity", next.severity ?? severity);
    setOrDel("sort", next.sort ?? sort);
    setOrDel("requirementId", next.requirementId ?? requirementId);

    setSearchParams(params, { replace: true });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = Array.isArray(items) ? [...items] : [];

    if (q) {
      list = list.filter((b) => {
        const hay = `${b.title || ""} ${b.description || ""} ${b.environment || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const sevWeight = (s) => {
      switch ((s || "").toLowerCase()) {
        case "critical":
          return 4;
        case "high":
          return 3;
        case "medium":
          return 2;
        case "low":
          return 1;
        default:
          return 0;
      }
    };

    const asTime = (v) => {
      const d = new Date(v);
      const t = d.getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    if (sort === "oldest") list.sort((a, b) => asTime(a.created_at) - asTime(b.created_at));
    else if (sort === "severity") list.sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity));
    else list.sort((a, b) => asTime(b.created_at) - asTime(a.created_at));

    return list;
  }, [items, query, sort]);

  const counts = useMemo(() => {
    const c = { total: filtered.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const b of filtered) {
      const s = (b.status || "").toLowerCase();
      if (s === "open") c.open++;
      if (s === "in_progress") c.in_progress++;
      if (s === "resolved") c.resolved++;
      if (s === "closed") c.closed++;
    }
    return c;
  }, [filtered]);

  function onFormChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function createBug() {
    setCreateErr("");
    setCreating(true);
    try {
      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.description.trim()) throw new Error("Description is required.");

      const payload = {
        project_id: Number(projectId),
        title: form.title.trim(),
        description: form.description.trim(),
        steps_to_reproduce: form.steps_to_reproduce?.trim() || null,
        expected_result: form.expected_result?.trim() || null,
        actual_result: form.actual_result?.trim() || null,
        environment: form.environment?.trim() || null,
        severity: form.severity,
        priority: form.priority,
        status: form.status,
        requirement_id: form.requirement_id ? Number(form.requirement_id) : null,
        test_case_id: form.test_case_id ? Number(form.test_case_id) : null,
        test_execution_id: form.test_execution_id ? Number(form.test_execution_id) : null,
      };

      const created = await apiFetch(`/api/bug_reports`, { method: "POST", body: JSON.stringify(payload) });
      setOpenCreate(false);
      setForm((s) => ({
        ...s,
        title: "",
        description: "",
        steps_to_reproduce: "",
        expected_result: "",
        actual_result: "",
        environment: "",
        severity: "medium",
        priority: "medium",
        status: "open",
        requirement_id: requirementId ? Number(requirementId) : null,
        test_case_id: null,
        test_execution_id: null,
      }));

      // Optimistic add on top
      setItems((prev) => [created, ...(prev || [])]);
    } catch (e) {
      setCreateErr(e?.message || "Failed to create bug");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_86%_0%,rgba(244,63,94,0.10),transparent_35%)]" />
          <div className="relative p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900">Bug Reports</h1>
                <p className="text-sm text-slate-600 max-w-2xl">
                  Track issues per project. Filter by status/severity and open a bug for details.
                </p>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="blue">Project: {projectId || "—"}</Badge>
                  {requirementId ? <Badge tone="purple">Requirement: {requirementId}</Badge> : <Badge tone="slate">All bugs</Badge>}
                  <Badge tone="green">Shown: {counts.total}</Badge>
                  <Badge tone="blue">Open: {counts.open}</Badge>
                  <Badge tone="amber">In progress: {counts.in_progress}</Badge>
                  <Badge tone="green">Resolved: {counts.resolved}</Badge>
                  <Badge tone="slate">Closed: {counts.closed}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => navigate(`/projects/${projectId}`)}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                >
                  ← Back
                </button>

                <button
                  onClick={load}
                  disabled={loading}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>

                <button
                  onClick={() => setOpenCreate(true)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 shadow-sm"
                >
                  + New Bug
                </button>
              </div>
            </div>

            {err && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {err}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Filters</div>
              <div className="text-xs text-slate-500">Search in title/description/environment.</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  syncUrl({ q: e.target.value });
                }}
                placeholder="Search bugs…"
                className="w-full sm:w-72 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />

              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  syncUrl({ status: e.target.value });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                title="Status"
              >
                <option value="">All statuses</option>
                <option value="open">open</option>
                <option value="triaged">triaged</option>
                <option value="in_progress">in_progress</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>

              <select
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value);
                  syncUrl({ severity: e.target.value });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                title="Severity"
              >
                <option value="">All severities</option>
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>

              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  syncUrl({ sort: e.target.value });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                title="Sort"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="severity">Severity</option>
              </select>

              <button
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  setSeverity("");
                  setSort("newest");
                  const p = new URLSearchParams(searchParams);
                  p.delete("q");
                  p.delete("status");
                  p.delete("severity");
                  p.delete("sort");
                  setSearchParams(p, { replace: true });
                }}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>

          {/* List */}
          <div className="p-6">
            {loading ? (
              <div className="grid gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="h-4 w-2/3 bg-slate-200 rounded" />
                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No bugs found.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">ID</th>
                        <th className="px-4 py-3 text-left font-semibold">Title</th>
                        <th className="px-4 py-3 text-left font-semibold">Severity</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Created</th>
                        <th className="px-4 py-3 text-right font-semibold">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filtered.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/60 align-top">
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.id}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{b.title || "—"}</div>
                            {b.environment && <div className="text-xs text-slate-500">Env: {b.environment}</div>}
                            <div className="text-xs text-slate-500">
                              Req: {b.requirement_id ?? "—"} · TC: {b.test_case_id ?? "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={toneFromSeverity(b.severity)}>{(b.severity || "—").toLowerCase()}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={toneFromStatus(b.status)}>{(b.status || "—").toLowerCase()}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(b.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${projectId}/bugs/${b.id}`)}
                              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filtered.map((b) => (
                    <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="slate">ID {b.id}</Badge>
                            <Badge tone={toneFromSeverity(b.severity)}>{(b.severity || "—").toLowerCase()}</Badge>
                            <Badge tone={toneFromStatus(b.status)}>{(b.status || "—").toLowerCase()}</Badge>
                          </div>
                          <div className="mt-2 font-semibold text-slate-900 break-words">{b.title || "—"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Req: {b.requirement_id ?? "—"} · TC: {b.test_case_id ?? "—"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(b.created_at)}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${projectId}/bugs/${b.id}`)}
                          className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Create Modal */}
        {openCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Create Bug</div>
                  <div className="text-xs text-slate-500">Project {projectId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenCreate(false)}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="p-6 space-y-4">
                {createErr && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {createErr}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Title</label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={onFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Short, specific bug title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={onFormChange}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="What is wrong? What is the impact?"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Severity</label>
                    <select
                      name="severity"
                      value={form.severity}
                      onChange={onFormChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Priority</label>
                    <select
                      name="priority"
                      value={form.priority}
                      onChange={onFormChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Status</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={onFormChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="open">open</option>
                      <option value="triaged">triaged</option>
                      <option value="in_progress">in_progress</option>
                      <option value="resolved">resolved</option>
                      <option value="closed">closed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Requirement ID (optional)</label>
                    <input
                      name="requirement_id"
                      value={form.requirement_id ?? ""}
                      onChange={onFormChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. 11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Environment (optional)</label>
                    <input
                      name="environment"
                      value={form.environment}
                      onChange={onFormChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. Chrome, Staging, iOS 17"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Steps to reproduce (optional)</label>
                  <textarea
                    name="steps_to_reproduce"
                    value={form.steps_to_reproduce}
                    onChange={onFormChange}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="1) ... 2) ... 3) ..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Expected result (optional)</label>
                    <textarea
                      name="expected_result"
                      value={form.expected_result}
                      onChange={onFormChange}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Actual result (optional)</label>
                    <textarea
                      name="actual_result"
                      value={form.actual_result}
                      onChange={onFormChange}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={createBug}
                    disabled={creating}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {creating ? "Creating…" : "Create"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenCreate(false)}
                    className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>

                <div className="text-xs text-slate-500">
                  Tip: you can also open bugs from failed executions later (auto-create).
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
