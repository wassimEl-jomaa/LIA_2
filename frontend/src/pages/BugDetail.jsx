import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

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

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">{children ?? "—"}</div>
    </div>
  );
}

function renderArtifacts(artifacts) {
  if (!artifacts) return "—";
  const links = Array.isArray(artifacts?.links) ? artifacts.links : [];
  if (!links.length) return "—";
  return (
    <div className="space-y-1">
      {links.map((link, idx) => (
        <a
          key={`${link}-${idx}`}
          href={link}
          target="_blank"
          rel="noreferrer"
          className="block text-blue-600 hover:underline"
        >
          {link}
        </a>
      ))}
    </div>
  );
}

export default function BugDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, bugId } = useParams();
  const isNew = !bugId || bugId === "new";
  const prefill = location.state || {};

  const [bug, setBug] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [err, setErr] = useState("");

  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  const [deleting, setDeleting] = useState(false);

  // optional triage endpoint
  const [triaging, setTriaging] = useState(false);
  const [aiReporting, setAiReporting] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [aiReportErr, setAiReportErr] = useState("");

  const [execution, setExecution] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionErr, setExecutionErr] = useState("");

  function formFromPrefill(src = {}) {
    return {
      title: src.title || "",
      description: src.description || "",
      steps_to_reproduce: src.steps || src.steps_to_reproduce || "",
      expected_result: src.expected || src.expected_result || "",
      actual_result: src.actual || src.actual_result || "",
      environment: src.environment || "",
      severity: (src.severity_hint || src.severity || "medium").toLowerCase(),
      priority: (src.priority || "medium").toLowerCase(),
      status: (src.status || "open").toLowerCase(),
      requirement_id: src.requirementId ?? src.requirement_id ?? "",
      test_case_id: src.testCaseId ?? src.test_case_id ?? "",
      test_execution_id: src.executionId ?? src.test_execution_id ?? "",
    };
  }

  function formFromBug(data = {}) {
    return {
      title: data?.title || "",
      description: data?.description || "",
      steps_to_reproduce: data?.steps_to_reproduce || "",
      expected_result: data?.expected_result || "",
      actual_result: data?.actual_result || "",
      environment: data?.environment || "",
      severity: (data?.severity || "medium").toLowerCase(),
      priority: (data?.priority || "medium").toLowerCase(),
      status: (data?.status || "open").toLowerCase(),
      requirement_id: data?.requirement_id ?? "",
      test_case_id: data?.test_case_id ?? "",
      test_execution_id: data?.test_execution_id ?? "",
    };
  }

  const [form, setForm] = useState(() => formFromPrefill(prefill));

  useEffect(() => {
    if (!getToken()) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (!projectId) return;
    if (isNew) {
      setLoading(false);
      setErr("");
      setBug(null);
      return;
    }
    if (!bugId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, bugId, isNew]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await apiFetch(`/api/bug_reports/${bugId}`);
      setBug(data || null);
      setForm(formFromBug(data));
    } catch (e) {
      setErr(e?.message || "Failed to load bug");
      setBug(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!projectId) return;
    const execId = bug?.test_execution_id || form?.test_execution_id;
    if (!execId) {
      setExecution(null);
      return;
    }
    loadExecution(Number(execId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, bug?.test_execution_id, form?.test_execution_id]);


  async function loadExecution(execId) {
    setExecutionErr("");
    setExecutionLoading(true);
    try {
      const list = await apiFetch(`/api/test_executions?project_id=${projectId}&limit=500`);
      const found = Array.isArray(list) ? list.find((ex) => Number(ex.id) === Number(execId)) : null;
      setExecution(found || null);
      if (!found) setExecutionErr("Execution not found in this project.");
    } catch (e) {
      setExecution(null);
      setExecutionErr(e?.message || "Failed to load execution");
    } finally {
      setExecutionLoading(false);
    }
  }

  const metaBadges = useMemo(() => {
    if (!bug) return [];
    return [
      { tone: toneFromSeverity(bug.severity), text: `Severity: ${(bug.severity || "—").toLowerCase()}` },
      { tone: "slate", text: `Priority: ${(bug.priority || "—").toLowerCase()}` },
      { tone: toneFromStatus(bug.status), text: `Status: ${(bug.status || "—").toLowerCase()}` },
      bug.environment ? { tone: "slate", text: `Env: ${bug.environment}` } : null,
    ].filter(Boolean);
  }, [bug]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function onSave() {
    setEditErr("");
    setSaving(true);
    try {
      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.description.trim()) throw new Error("Description is required.");

      const payload = {
        project_id: Number(projectId),
        title: form.title.trim(),
        description: form.description.trim(),
        steps_to_reproduce: form.steps_to_reproduce?.trim() || null,
        expected_result: form.expected_result?.trim() || null,
        actual_result: execution?.result ? String(execution.result) : form.actual_result?.trim() || null,
        environment: form.environment?.trim() || null,
        severity: form.severity,
        priority: form.priority,
        status: form.status,
        requirement_id: form.requirement_id !== "" ? Number(form.requirement_id) : null,
        test_case_id: form.test_case_id !== "" ? Number(form.test_case_id) : null,
        test_execution_id: form.test_execution_id !== "" ? Number(form.test_execution_id) : null,
      };

      if (isNew) {
        const created = await apiFetch(`/api/bug_reports`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setBug(created);
        navigate(`/projects/${projectId}/bugs/${created.id}`);
      } else {
        const updated = await apiFetch(`/api/bug_reports/${bugId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setBug(updated);
      }
    } catch (e) {
      setEditErr(e?.message || "Failed to update bug");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this bug report?")) return;
    setDeleting(true);
    setEditErr("");
    try {
      await apiFetch(`/api/bug_reports/${bugId}`, { method: "DELETE" });
      navigate(`/projects/${projectId}/bugs`);
    } catch (e) {
      setEditErr(e?.message || "Failed to delete bug");
    } finally {
      setDeleting(false);
    }
  }

  async function onTriageAI() {
    if (isNew || !bugId) return;
    setEditErr("");
    setTriaging(true);
    try {
      // Optional endpoint; if you haven’t created it yet you’ll get a nice error shown.
      const updated = await apiFetch(`/api/bug_reports/${bugId}/triage`, { method: "POST" });
      setBug(updated);
      setForm((s) => ({
        ...s,
        severity: (updated?.severity || s.severity).toLowerCase(),
        priority: (updated?.priority || s.priority).toLowerCase(),
        status: (updated?.status || s.status).toLowerCase(),
      }));
    } catch (e) {
      setEditErr(e?.message || "AI triage failed (endpoint missing?)");
    } finally {
      setTriaging(false);
    }
  }

  async function onAIReport() {
    setAiReportErr("");
    setAiReporting(true);
    try {
      let data = null;
      if (isNew || !bugId) {
        if (!form.title.trim() || !form.description.trim()) {
          throw new Error("Title and description are required for AI report.");
        }
        data = await apiFetch(`/api/bug_reports/ai_report`, {
          method: "POST",
          body: JSON.stringify({
            project_id: Number(projectId),
            title: form.title.trim(),
            description: form.description.trim(),
            steps_to_reproduce: form.steps_to_reproduce?.trim() || null,
            expected_result: form.expected_result?.trim() || null,
            actual_result: form.actual_result?.trim() || null,
          }),
        });
      } else {
        data = await apiFetch(`/api/bug_reports/${bugId}/ai_report`, { method: "POST" });
      }
      setAiReport(data || null);
    } catch (e) {
      setAiReportErr(e?.message || "AI report failed");
    } finally {
      setAiReporting(false);
    }
  }

  function selectToneClasses(kind, value) {
    const v = (value || "").toLowerCase();
    if (kind === "status") {
      switch (v) {
        case "open":
          return "bg-blue-50 text-blue-800 border-blue-200";
        case "triaged":
          return "bg-purple-50 text-purple-800 border-purple-200";
        case "in_progress":
          return "bg-amber-50 text-amber-800 border-amber-200";
        case "resolved":
          return "bg-emerald-50 text-emerald-800 border-emerald-200";
        case "closed":
          return "bg-slate-100 text-slate-700 border-slate-200";
        default:
          return "bg-white text-slate-800 border-slate-200";
      }
    }

    switch (v) {
      case "critical":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "high":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "medium":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "low":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      default:
        return "bg-white text-slate-800 border-slate-200";
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
                <h1 className="text-3xl font-bold text-slate-900">
                  {isNew ? "Create Bug" : "Bug Detail"}
                </h1>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="blue">Project: {projectId}</Badge>
                  <Badge tone="slate">Bug: {isNew ? "new" : bugId}</Badge>
                  {(bug?.requirement_id || form.requirement_id) ? (
                    <Badge tone="purple">Req: {bug?.requirement_id ?? form.requirement_id}</Badge>
                  ) : (
                    <Badge tone="slate">Req: —</Badge>
                  )}
                  {(bug?.test_case_id || form.test_case_id) ? (
                    <Badge tone="slate">TC: {bug?.test_case_id ?? form.test_case_id}</Badge>
                  ) : (
                    <Badge tone="slate">TC: —</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600 max-w-2xl">
                  {isNew
                    ? "Create a new bug report and optionally link a requirement or test case."
                    : "View and update bug details, link to requirement/test case, and track status."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => navigate(`/projects/${projectId}/bugs`)}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                >
                  ← Back to Bugs
                </button>

                {!isNew && (
                  <button
                    onClick={load}
                    disabled={loading}
                    className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loading ? "Refreshing…" : "Refresh"}
                  </button>
                )}

                {!isNew && (
                  <button
                    onClick={onTriageAI}
                    disabled={triaging}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-white font-semibold hover:bg-purple-700 disabled:opacity-60 shadow-sm"
                    title="Requires backend endpoint POST /api/bug_reports/{id}/triage"
                  >
                    {triaging ? "Triaging…" : "AI Triage"}
                  </button>
                )}

                {!isNew && (
                  <button
                    onClick={onAIReport}
                    disabled={aiReporting}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 shadow-sm"
                    title="Generate an AI report for this bug"
                  >
                    {aiReporting ? "Generating…" : "AI Report"}
                  </button>
                )}

                {!isNew && (
                  <button
                    onClick={onDelete}
                    disabled={deleting}
                    className="rounded-xl bg-white px-4 py-2 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </div>

            {err && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {err}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-5 w-2/3 bg-slate-200 rounded" />
              <div className="h-4 w-5/6 bg-slate-200 rounded" />
              <div className="h-4 w-4/6 bg-slate-200 rounded" />
            </div>
          </div>
        ) : !bug && !isNew ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 text-sm text-slate-600">
            Bug not found.
          </div>
        ) : (
          <div className={isNew ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 lg:grid-cols-3 gap-6"}>
            {!isNew && (
              <>
                {/* Left: read view */}
                <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {metaBadges.map((b, i) => (
                      <Badge key={i} tone={b.tone}>
                        {b.text}
                      </Badge>
                    ))}
                    <Badge tone="slate">Created: {formatDate(bug.created_at)}</Badge>
                    {bug.updated_at && <Badge tone="slate">Updated: {formatDate(bug.updated_at)}</Badge>}
                  </div>
                  <div className="mt-3 text-xl font-bold text-slate-900 break-words">{bug.title}</div>
                </div>

                <div className="p-6 space-y-5">
                  <Field label="Description">{bug.description}</Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Steps to reproduce">{bug.steps_to_reproduce || "—"}</Field>
                    <Field label="Environment">{bug.environment || "—"}</Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Expected result">{bug.expected_result || "—"}</Field>
                    <Field label="Actual result">{bug.actual_result || "—"}</Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <Field label="Requirement ID">{bug.requirement_id ?? "—"}</Field>
                    <Field label="Test Case ID">{bug.test_case_id ?? "—"}</Field>
                    <Field label="Execution ID">{bug.test_execution_id ?? "—"}</Field>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-800">Test Execution Details</div>
                  <div className="text-xs text-slate-500">From linked execution</div>
                </div>
                <div className="p-6 space-y-4">
                  {executionLoading && (
                    <div className="text-sm text-slate-500">Loading execution…</div>
                  )}
                  {executionErr && (
                    <div className="text-sm text-rose-700">{executionErr}</div>
                  )}
                  {!executionLoading && !executionErr && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <Field label="Status">{execution?.status || "—"}</Field>
                        <Field label="Build number">{execution?.build_number || "—"}</Field>
                        <Field label="Result">{execution?.result || "—"}</Field>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label="Job URL">
                          {execution?.job_url ? (
                            <a
                              href={execution.job_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Open
                            </a>
                          ) : (
                            "—"
                          )}
                        </Field>
                        <Field label="Artifacts">{renderArtifacts(execution?.artifacts)}</Field>
                      </div>

                      <Field label="Environment JSON">
                        {execution?.environment_json
                          ? JSON.stringify(execution.environment_json, null, 2)
                          : "—"}
                      </Field>
                    </>
                  )}
                </div>
              </div>
            </div>

            
              </>
            )}

            {/* Right: edit form */}
            <div>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900">
                    {isNew ? "Create Bug" : "Update Bug"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {isNew ? "Fill in fields and press Save." : "Edit fields and press Save."}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {editErr && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      {editErr}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Title</label>
                      <input
                        name="title"
                        value={form.title}
                        onChange={onChange}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Requirement ID</label>
                      <input
                        name="requirement_id"
                        value={form.requirement_id}
                        onChange={onChange}
                        className="mt-1 w-full rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-sm font-semibold text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="e.g. 11"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Test Case ID</label>
                      <input
                        name="test_case_id"
                        value={form.test_case_id}
                        onChange={onChange}
                        className="mt-1 w-full rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2 text-sm font-semibold text-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        placeholder="e.g. 22"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Execution ID</label>
                      <input
                        name="test_execution_id"
                        value={form.test_execution_id}
                        onChange={onChange}
                        className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm font-semibold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="e.g. 8"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Description</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={onChange}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Severity</label>
                      <select
                        name="severity"
                        value={form.severity}
                        onChange={onChange}
                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 ${selectToneClasses(
                          "severity",
                          form.severity
                        )}`}
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
                        onChange={onChange}
                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 ${selectToneClasses(
                          "priority",
                          form.priority
                        )}`}
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
                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 ${selectToneClasses(
                          "status",
                          form.status
                        )}`}
                      >
                        <option value="open">open</option>
                        <option value="triaged">triaged</option>
                        <option value="in_progress">in_progress</option>
                        <option value="resolved">resolved</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Environment</label>
                    <input
                      name="environment"
                      value={form.environment}
                      onChange={onChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. Staging / Chrome 121"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Steps to reproduce</label>
                    <textarea
                      name="steps_to_reproduce"
                      value={form.steps_to_reproduce}
                      onChange={onChange}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Expected result</label>
                    <textarea
                      name="expected_result"
                      value={form.expected_result}
                      onChange={onChange}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Actual result (from execution)</label>
                    <input
                      name="actual_result"
                      value={execution?.result ?? ""}
                      readOnly
                      placeholder="No execution result yet"
                      className="mt-1 w-full rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 placeholder:text-emerald-600/70"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={saving}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>

                    <button
                      type="button"
                      onClick={onAIReport}
                      disabled={aiReporting}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
                      title="Generate an AI triage report based on the current fields"
                    >
                      {aiReporting ? "Generating…" : "Generate AI Report"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // reset form to original values
                        setForm(isNew ? formFromPrefill(prefill) : formFromBug(bug));
                        setEditErr("");
                      }}
                      className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </div>

                  {aiReportErr && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      {aiReportErr}
                    </div>
                  )}

                  {aiReport && (
                    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 p-4 text-slate-800 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
                            AI
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">AI Report</div>
                            <div className="text-[11px] text-slate-500">Auto-generated insights</div>
                          </div>
                        </div>
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          Summary
                        </span>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-white">
                        {(() => {
                          const reportData = aiReport.parsed_json ?? aiReport;
                          if (!reportData || typeof reportData !== "object") {
                            return (
                              <div className="px-3 py-2 text-[12px] text-slate-700">
                                {String(reportData ?? "—")}
                              </div>
                            );
                          }

                          const entries = Object.entries(reportData);
                          if (!entries.length) {
                            return <div className="px-3 py-2 text-[12px] text-slate-500">No report data.</div>;
                          }

                          const severityValue = reportData.severity ?? reportData.Severity;
                          const priorityValue = reportData.priority ?? reportData.Priority;
                          const statusValue = reportData.status ?? reportData.Status;
                          const rows = entries.filter(
                            ([key]) => !["severity", "priority", "status"].includes(String(key).toLowerCase())
                          );

                          const getField = (name) =>
                            reportData[name] ??
                            reportData[
                              name.replace(/(^|_)([a-z])/g, (_, p1, p2) => `${p1}${p2.toUpperCase()}`)
                            ];
                          const toList = (value) => {
                            if (Array.isArray(value)) return value.filter(Boolean);
                            if (typeof value === "string") {
                              const trimmed = value.trim();
                              if (!trimmed) return [];
                              if (trimmed.includes("\n")) return trimmed.split("\n").map((v) => v.trim()).filter(Boolean);
                              if (trimmed.includes(",")) return trimmed.split(",").map((v) => v.trim()).filter(Boolean);
                              return [trimmed];
                            }
                            if (value == null) return [];
                            return [String(value)];
                          };

                          const rootCauses = toList(getField("suggested_root_causes"));
                          const nextSteps = toList(getField("suggested_next_steps"));
                          const duplicateTerms = toList(getField("duplicate_search_terms"));
                          const assumptions = toList(getField("assumptions"));

                          const specialKeys = new Set([
                            "suggested_root_causes",
                            "suggested_next_steps",
                            "duplicate_search_terms",
                            "assumptions",
                          ]);
                          const remainingRows = rows.filter(
                            ([key]) => !specialKeys.has(String(key).toLowerCase())
                          );

                          return (
                            <div className="divide-y divide-slate-100">
                              {(severityValue || priorityValue || statusValue) && (
                                <div className="px-3 py-2">
                                  <div className="flex flex-wrap items-center gap-16">
                                    {severityValue != null && (
                                      <div className="flex items-center gap-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          Severity
                                        </span>
                                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                          {String(severityValue)}
                                        </span>
                                      </div>
                                    )}
                                    {priorityValue != null && (
                                      <div className="flex items-center gap-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          Priority
                                        </span>
                                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                          {String(priorityValue)}
                                        </span>
                                      </div>
                                    )}
                                    {statusValue != null && (
                                      <div className="flex items-center gap-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          Status
                                        </span>
                                        <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
                                          {String(statusValue)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {(rootCauses.length || nextSteps.length || duplicateTerms.length || assumptions.length) && (
                                <div className="px-3 py-3">
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {rootCauses.length > 0 && (
                                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                          Suggested root causes
                                        </div>
                                        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-amber-900">
                                          {rootCauses.map((item, idx) => (
                                            <li key={`root-${idx}`}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {nextSteps.length > 0 && (
                                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                                          Suggested next steps
                                        </div>
                                        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-emerald-900">
                                          {nextSteps.map((item, idx) => (
                                            <li key={`next-${idx}`}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {duplicateTerms.length > 0 && (
                                      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                          Duplicate search terms
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {duplicateTerms.map((item, idx) => (
                                            <span
                                              key={`dup-${idx}`}
                                              className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                                            >
                                              {item}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {assumptions.length > 0 && (
                                      <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                                          Assumptions
                                        </div>
                                        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-purple-900">
                                          {assumptions.map((item, idx) => (
                                            <li key={`assump-${idx}`}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {remainingRows.map(([key, value]) => (
                                <div key={key} className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-[180px_1fr]">
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    {key.replace(/_/g, " ")}
                                  </div>
                                  <div className="text-[12px] text-slate-700 whitespace-pre-wrap break-words">
                                    {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                                      ? String(value)
                                      : JSON.stringify(value, null, 2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}






