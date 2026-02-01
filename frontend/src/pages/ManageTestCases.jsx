import React, { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  listTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  analyzeRequirement,
} from "../api";

// Vite-safe base (and avoids hardcoding)
const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

function getToken() {
  return localStorage.getItem("token");
}

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
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

function safeName(v) {
  const s = (v ?? "").toString().trim();
  return s || "—";
}

function Badge({ children, tone = "gray" }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border";
  const tones = {
    gray: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return <span className={`${base} ${tones[tone] || tones.gray}`}>{children}</span>;
}

export default function ManageTestCases() {
  const { projectId: routeProjectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const projectId = routeProjectId || localStorage.getItem("active_project_id");

  // ✅ single, unified requirement id (NO duplicates)
  const requirementIdFromState = location.state?.requirementId ?? null;
  const requirementIdFromQuery = searchParams.get("requirementId");
  const requirementId = requirementIdFromQuery ?? requirementIdFromState; // final

  // requirement header card state
  const [requirement, setRequirement] = useState(null);
  const [loadingRequirement, setLoadingRequirement] = useState(false);
  const [requirementError, setRequirementError] = useState("");

  // list + form state
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // analysis state
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const [query, setQuery] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    steps: "",
    preconditions: "",
    expected_result: "",
    priority: "medium",
    status: "active",
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Load ONE requirement for header (if requirementId exists)
  useEffect(() => {
    if (!projectId || !requirementId) {
      setRequirement(null);
      setRequirementError("");
      return;
    }
    loadRequirement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, requirementId]);

  async function runAnalysis() {
  setAnalysisLoading(true);
  setAnalysisError("");
  try {
    const res = await analyzeRequirement({
      project_id: Number(projectId),
      requirement: requirement?.title || "", // or full requirement text
      context: { page: "ManageTestCases" },
    });
    setAnalysis(res);
  } catch (e) {
    setAnalysisError(e.message || String(e));
  } finally {
    setAnalysisLoading(false);
  }
}
  async function loadRequirement() {
    setLoadingRequirement(true);
    setRequirementError("");
    try {
      // Using list endpoint to find the selected requirement (works with your backend)
      const list = await apiFetch(`/api/requirements?project_id=${projectId}&limit=200`);
      const r = (Array.isArray(list) ? list : []).find(
        (x) => String(x.id) === String(requirementId)
      );
      if (!r) throw new Error("Requirement not found (or not in this project).");
      setRequirement(r);
    } catch (e) {
      setRequirement(null);
      setRequirementError(e?.message || "Failed to load requirement");
    } finally {
      setLoadingRequirement(false);
    }
  }

  async function fetchList() {
    setLoadingList(true);
    setError("");
    try {
      const data = await listTestCases({ projectId: parseInt(projectId, 10) });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoadingList(false);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function clearForm() {
    setEditingId(null);
    setForm({
      title: "",
      description: "",
      steps: "",
      preconditions: "",
      expected_result: "",
      priority: "medium",
      status: "active",
    });
  }

  function populateForEdit(tc) {
    const numericId = Number(tc.id);
    setEditingId(Number.isInteger(numericId) ? numericId : null);

    setForm({
      title: tc.title || "",
      description: tc.description || "",
      steps: (tc.steps || []).join("\n"),
      preconditions: (tc.preconditions || []).join("\n"),
      expected_result: tc.expected_result || "",
      priority: tc.priority || "medium",
      status: tc.status || "active",
    });
  }

  function toneFromPriority(priority) {
    switch ((priority || "").toLowerCase()) {
      case "high":
      case "critical":
        return "red";
      case "medium":
        return "amber";
      case "low":
        return "green";
      default:
        return "gray";
    }
  }

  function toneFromStatus(status) {
    switch ((status || "").toLowerCase()) {
      case "active":
        return "blue";
      case "deprecated":
      case "inactive":
        return "gray";
      case "draft":
        return "purple";
      default:
        return "gray";
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        project_id: parseInt(projectId, 10),
        requirement_id: requirementId ? Number(requirementId) : null, // ✅ link correctly
        title: form.title.trim(),
        description: form.description?.trim() || null,
        steps: form.steps
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        preconditions: form.preconditions
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        expected_result: form.expected_result?.trim() || null,
        priority: form.priority,
        status: form.status,
      };

      if (!payload.title) throw new Error("Title is required.");

      if (editingId) await updateTestCase(editingId, payload);
      else await createTestCase(payload);

      clearForm();
      await fetchList();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this test case?")) return;
    setSaving(true);
    setError("");
    try {
      await deleteTestCase(id);
      await fetchList();
      if (editingId === id) clearForm();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  // ✅ filter list by requirementId (if provided) AND search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = Array.isArray(items) ? items : [];

    if (requirementId) {
      const rid = Number(requirementId);
      base = base.filter((tc) => Number(tc.requirement_id) === rid);
    }

    if (!q) return base;

    return base.filter((tc) => {
      const hay = `${tc.title || ""} ${tc.description || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, requirementId]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.10),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.10),transparent_35%)]" />
          <div className="relative p-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900">Manage Test Cases</h1>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="blue">Project: {projectId || "—"}</Badge>
                  {requirementId ? (
                    <Badge tone="purple">Requirement: {requirementId}</Badge>
                  ) : (
                    <Badge tone="gray">All project test cases</Badge>
                  )}
                  <Badge tone="green">{filtered.length} shown</Badge>
                </div>

                <p className="text-sm text-slate-600 max-w-2xl">
                  Create, edit, and remove test cases. If opened from a requirement, this page shows only its test cases.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => {
                    if (projectId) navigate(`/projects/${projectId}`);
                    else navigate("/projects");
                  }}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                >
                  ← Back
                </button>
                

                <button
                  onClick={fetchList}
                  disabled={loadingList}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingList ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            {/* Requirement summary */}
            {requirementId && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {loadingRequirement ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 w-2/3 bg-slate-200 rounded" />
                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  </div>
                ) : requirementError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {requirementError}
                  </div>
                ) : requirement ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="purple">Requirement #{requirement.id}</Badge>
                      <Badge tone="gray">Created: {formatDate(requirement.created_at)}</Badge>
                      <Badge tone="blue">
                        Created by:{" "}
                        {safeName(
                          requirement.created_by_name ??
                            requirement.creator_name ??
                            requirement.user_name
                        )}
                      </Badge>
                    </div>
                    <div className="text-base font-semibold text-slate-900">
                      {requirement.title || "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Showing only test cases linked to this requirement.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">Requirement not found.</div>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {requirementId ? "Test Cases for Requirement" : "Existing Test Cases"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {loadingList ? "Loading…" : `${filtered.length} total`}
                  </div>
                </div>

                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title/description…"
                  className="w-full sm:w-72 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="p-6">
                {loadingList ? (
                  <div className="grid gap-3">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                      >
                        <div className="h-4 w-2/3 bg-slate-200 rounded" />
                        <div className="h-3 w-5/6 bg-slate-200 rounded" />
                        <div className="h-3 w-3/5 bg-slate-200 rounded" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    {requirementId
                      ? "No test cases linked to this requirement yet."
                      : "No test cases found."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((tc) => (
                      <div
                        key={tc.id}
                        className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/40 transition"
                      >
                        <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-slate-900">
                                {tc.title || "Untitled"}
                              </div>

                              <Badge tone={toneFromPriority(tc.priority)}>
                                Priority: {tc.priority || "medium"}
                              </Badge>

                              <Badge tone={toneFromStatus(tc.status)}>
                                Status: {tc.status || "active"}
                              </Badge>
                            </div>

                            {tc.description && (
                              <div className="mt-1 text-sm text-slate-600">{tc.description}</div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => populateForEdit(tc)}
                              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Update
                            </button>

                            <button
                              type="button"
                              onClick={() => onDelete(tc.id)}
                              className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="px-4 pb-4">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <div>
                              <div className="text-sm font-semibold text-slate-700">
                                Preconditions
                              </div>
                              {tc.preconditions?.length ? (
                                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                                  {tc.preconditions.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="mt-1 text-sm text-slate-500">—</div>
                              )}
                            </div>

                            <div>
                              <div className="text-sm font-semibold text-slate-700">Steps</div>
                              {tc.steps?.length ? (
                                <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">
                                  {tc.steps.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ol>
                              ) : (
                                <div className="mt-1 text-sm text-slate-500">—</div>
                              )}
                            </div>

                            <div>
                              <div className="text-sm font-semibold text-slate-700">
                                Expected Result
                              </div>
                              <div className="mt-1 text-sm text-slate-700">
                                {tc.expected_result || "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {editingId ? "Edit Test Case" : "Create Test Case"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {requirementId
                      ? "New items will be linked to the selected requirement."
                      : "Creates test cases for the project."}
                  </div>
                </div>

                {editingId && <Badge tone="blue">ID: {editingId}</Badge>}
              </div>

              <form onSubmit={onSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Title</label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={onChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Priority</label>
                    <select
                      name="priority"
                      value={form.priority}
                      onChange={onChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
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
                      onChange={onChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
                    >
                      <option value="active">active</option>
                      <option value="draft">draft</option>
                      <option value="inactive">inactive</option>
                      <option value="deprecated">deprecated</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={onChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Preconditions (one per line)
                  </label>
                  <textarea
                    name="preconditions"
                    value={form.preconditions}
                    onChange={onChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Steps (one per line)
                  </label>
                  <textarea
                    name="steps"
                    value={form.steps}
                    onChange={onChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Expected result
                  </label>
                  <input
                    name="expected_result"
                    value={form.expected_result}
                    onChange={onChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving || !projectId}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : editingId ? "Update" : "Create"}
                  </button>

                  <button
                    type="button"
                    onClick={clearForm}
                    className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>

                {requirementId && (
                  <div className="text-xs text-slate-500">
                    Opened from Requirement <span className="font-mono">{requirementId}</span>.
                    New test cases will be linked automatically.
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        {requirementId && (
          <div className="text-xs text-slate-500">
            If you still see all test cases, make sure the backend returns{" "}
            <code className="font-mono">requirement_id</code> in the test case list response.
          </div>
        )}
      </div>
    </div>
  );
}
