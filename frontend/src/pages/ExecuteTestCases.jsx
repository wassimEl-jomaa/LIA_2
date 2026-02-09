import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  listTestCases,
  listTestExecutions,
  createTestExecution,
  updateTestExecution,
} from "../api";

/** ---------- UI helpers ---------- */
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Card({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/40 bg-white/70 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, children }) {
  return <div className={cn("px-6 py-4 border-b border-slate-100/80", className)}>{children}</div>;
}

function CardBody({ className, children }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

function Badge({ tone = "slate", children }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border backdrop-blur";
  const tones = {
    slate: "bg-slate-50/70 text-slate-700 border-slate-200",
    blue: "bg-blue-50/70 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50/70 text-indigo-700 border-indigo-200",
    purple: "bg-purple-50/70 text-purple-700 border-purple-200",
    green: "bg-emerald-50/70 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50/70 text-amber-800 border-amber-200",
    red: "bg-rose-50/70 text-rose-700 border-rose-200",
  };
  return <span className={cn(base, tones[tone] || tones.slate)}>{children}</span>;
}

function Notice({ tone = "error", children }) {
  const map = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", map[tone])}>{children}</div>;
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
    danger:
      "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm hover:from-rose-700 hover:to-pink-700 focus:ring-rose-300",
  };

  return <button className={cn(base, variants[variant], className)} {...props} />;
}

function Chip({ tone = "slate", className, children }) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={cn("inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold", map[tone], className)}>
      {children}
    </span>
  );
}

function toneFromResult(result) {
  switch ((result || "").toLowerCase()) {
    case "passed":
      return "green";
    case "failed":
      return "red";
    case "blocked":
      return "amber";
    case "skipped":
      return "slate";
    default:
      return "blue";
  }
}

function accentFromLatestResult(result) {
  switch ((result || "").toLowerCase()) {
    case "passed":
      return "from-emerald-400 to-cyan-300";
    case "failed":
      return "from-rose-500 to-pink-400";
    case "blocked":
      return "from-amber-400 to-yellow-300";
    case "skipped":
      return "from-slate-400 to-slate-200";
    default:
      return "from-blue-500 to-indigo-400";
  }
}

function titleFromResultLower(resultLower) {
  switch ((resultLower || "").toLowerCase()) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "blocked":
      return "Blocked";
    case "skipped":
      return "Skipped";
    default:
      return "Pending";
  }
}

function formatEnvironmentSummary(env) {
  if (!env || typeof env !== "object") return "";
  const parts = [env.os, env.browser, env.device].filter(Boolean);
  return parts.join(" • ");
}

/** ---------- Page ---------- */
export default function ExecuteTestCases() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const testCaseIdParam = searchParams.get("testCaseId");
  const testCaseIdFilter = testCaseIdParam ? Number(testCaseIdParam) : null;

  const [items, setItems] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [globalNotes, setGlobalNotes] = useState("");
  const [globalStatus, setGlobalStatus] = useState("auto");
  const [testRunId, setTestRunId] = useState(null);

  // filters/search
  const [q, setQ] = useState("");
  const [resultFilter, setResultFilter] = useState("all"); // all/passed/failed/blocked/skipped/pending

  // global metadata: fill once for all cases (can override per case later)
  const [globalMeta, setGlobalMeta] = useState({
    build_number: "",
    git_sha: "",
    branch: "",
    ci_run_id: "",
    job_url: "",
    environment_json_text: "",
    artifacts_links: [],
  });

  // per-case metadata overrides
  const [metaByCase, setMetaByCase] = useState({});
  const [showMetaByCase, setShowMetaByCase] = useState({});

  // edit existing execution
  const [editingExecId, setEditingExecId] = useState(null);
  const [editResult, setEditResult] = useState("pending");
  const [editNotes, setEditNotes] = useState("");

  const [selectedExecutionByCase, setSelectedExecutionByCase] = useState({});

  const environmentPresets = [
    {
      key: "win_chrome",
      label: "Windows 11 • Chrome 121 • Desktop",
      value: {
        os: "Windows 11",
        browser: "Chrome 121",
        device: "Desktop",
        locale: "en-US",
      },
    },
    {
      key: "win_edge",
      label: "Windows 11 • Edge 121 • Desktop",
      value: {
        os: "Windows 11",
        browser: "Edge 121",
        device: "Desktop",
        locale: "en-US",
      },
    },
    {
      key: "mac_safari",
      label: "macOS 14 • Safari 17 • MacBook",
      value: {
        os: "macOS 14",
        browser: "Safari 17",
        device: "MacBook",
        locale: "en-US",
      },
    },
    {
      key: "android_chrome",
      label: "Android 14 • Chrome 121 • Pixel",
      value: {
        os: "Android 14",
        browser: "Chrome 121",
        device: "Pixel",
        locale: "en-US",
      },
    },
    {
      key: "ios_safari",
      label: "iOS 17 • Safari • iPhone",
      value: {
        os: "iOS 17",
        browser: "Safari",
        device: "iPhone",
        locale: "en-US",
      },
    },
  ];
  const [environmentPresetKey, setEnvironmentPresetKey] = useState("");

  function setMeta(testCaseId, patch) {
    setMetaByCase((prev) => ({
      ...prev,
      [testCaseId]: { ...(prev[testCaseId] || {}), ...patch },
    }));
  }

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2500);
  }

  useEffect(() => {
    if (!projectId) return;
    const key = `legacy_test_run_id_project_${projectId}`;
    const saved = localStorage.getItem(key);
    if (saved && Number(saved)) setTestRunId(Number(saved));
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const pid = Number(projectId);
      const [tcList, execList] = await Promise.all([
        listTestCases({ projectId: pid, limit: 200 }),
        listTestExecutions({ projectId: pid, limit: 500 }),
      ]);

      setItems(Array.isArray(tcList) ? tcList : []);
      setExecutions(Array.isArray(execList) ? execList : []);

      // default run from existing executions
      if (!testRunId && Array.isArray(execList) && execList.length) {
        const firstRun = execList.find((x) => x?.test_run_id)?.test_run_id;
        if (firstRun) {
          setTestRunId(firstRun);
          localStorage.setItem(`legacy_test_run_id_project_${projectId}`, String(firstRun));
        }
      }
    } catch (e) {
      setError(e?.message || "Failed to load test cases");
    } finally {
      setLoading(false);
    }
  }

  // Build an "attempt index": attempt = max+1 within the same (test_run_id, test_case_id)
  const nextAttemptByCase = useMemo(() => {
    const map = new Map();
    for (const ex of executions) {
      if (!ex?.test_case_id) continue;
      if (!testRunId) continue;
      if (Number(ex.test_run_id) !== Number(testRunId)) continue;

      const tcId = Number(ex.test_case_id);
      const attempt = Number(ex.attempt || 1);
      const cur = map.get(tcId) || 0;
      if (attempt > cur) map.set(tcId, attempt);
    }
    const next = new Map();
    for (const [tcId, maxAttempt] of map.entries()) {
      next.set(tcId, maxAttempt + 1);
    }
    return next;
  }, [executions, testRunId]);

  const latestByCase = useMemo(() => {
    const map = new Map();
    for (const ex of executions) {
      if (!ex?.test_case_id) continue;
      if (!map.has(ex.test_case_id)) map.set(ex.test_case_id, ex);
    }
    return map;
  }, [executions]);

  const executionsByCase = useMemo(() => {
    const map = new Map();
    for (const ex of executions) {
      if (!ex?.test_case_id) continue;
      const list = map.get(ex.test_case_id) || [];
      list.push(ex);
      map.set(ex.test_case_id, list);
    }
    return map;
  }, [executions]);

  const selectedCase = useMemo(() => {
    if (!testCaseIdFilter || !Number.isFinite(testCaseIdFilter)) return null;
    return items.find((tc) => Number(tc.id) === testCaseIdFilter) || null;
  }, [items, testCaseIdFilter]);

  const visibleItems = useMemo(() => {
    let list = items;

    // filter by URL testCaseId
    if (testCaseIdFilter && Number.isFinite(testCaseIdFilter)) {
      list = list.filter((tc) => Number(tc.id) === testCaseIdFilter);
    }

    // search
    const qq = (q || "").trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (tc) =>
          String(tc.title || "").toLowerCase().includes(qq) ||
          String(tc.description || "").toLowerCase().includes(qq) ||
          String(tc.id).includes(qq)
      );
    }

    // result filter (based on latest result)
    if (resultFilter !== "all") {
      list = list.filter((tc) => {
        const latest = latestByCase.get(tc.id);
        const lr = String(latest?.result || "pending").toLowerCase();
        return lr === resultFilter;
      });
    }

    return list;
  }, [items, testCaseIdFilter, q, resultFilter, latestByCase]);

  const resultButtons = [
    { value: "passed", label: "Passed", className: "from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 focus:ring-emerald-200" },
    { value: "failed", label: "Failed", className: "from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 focus:ring-rose-200" },
    { value: "blocked", label: "Blocked", className: "from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 focus:ring-amber-200" },
    { value: "skipped", label: "Skipped", className: "from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700 focus:ring-slate-200" },
    { value: "pending", label: "Pending", className: "from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-200" },
  ];

  function parseJsonOrNull(label, text) {
    const t = (text || "").trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      throw new Error(`${label} is not valid JSON`);
    }
  }

  function mergedMetaForCase(testCaseId) {
    const local = metaByCase[testCaseId] || {};
    // local overrides global; use *_text fields for JSON
    return {
      build_number: local.build_number ?? globalMeta.build_number,
      git_sha: local.git_sha ?? globalMeta.git_sha,
      branch: local.branch ?? globalMeta.branch,
      ci_run_id: local.ci_run_id ?? globalMeta.ci_run_id,
      job_url: local.job_url ?? globalMeta.job_url,
      environment_json_text: local.environment_json_text ?? globalMeta.environment_json_text,
      artifacts_links: local.artifacts_links ?? globalMeta.artifacts_links,
    };
  }

  async function handleExecute(testCaseId, resultLower) {
    if (!projectId) return;
    if (!testRunId) {
      setError("No test_run_id available. Create/choose a Test Run first.");
      return;
    }

    setSavingId(testCaseId);
    setError("");

    try {
      const noteValue = (globalNotes || "").trim();
      const meta = mergedMetaForCase(testCaseId);

      const environment_json = parseJsonOrNull("Environment JSON", meta.environment_json_text);
      const artifacts = Array.isArray(meta.artifacts_links) && meta.artifacts_links.length
        ? { links: meta.artifacts_links }
        : null;

      // ✅ auto attempt (max+1 per test case within same run)
      const attemptGuess = nextAttemptByCase.get(Number(testCaseId)) || 1;

      const payload = {
        project_id: Number(projectId),
        test_case_id: Number(testCaseId),
        test_run_id: Number(testRunId),

        status:
          globalStatus === "auto"
            ? resultLower === "pending"
              ? "running"
              : "completed"
            : globalStatus,
        result: resultLower,
        notes: noteValue || null,

        environment_json,
        build_number: meta.build_number || null,
        git_sha: meta.git_sha || null,
        branch: meta.branch || null,
        ci_run_id: meta.ci_run_id || null,
        job_url: meta.job_url || null,
        artifacts,
        attempt: attemptGuess,
      };

      const created = await createTestExecution(payload);
      setExecutions((prev) => [created, ...prev]);

      // keep metadata (global) but clear per-case overrides by default
      setMetaByCase((prev) => ({ ...prev, [testCaseId]: {} }));
      setShowMetaByCase((prev) => ({ ...prev, [testCaseId]: false }));

      showToast(`Saved execution: ${titleFromResultLower(resultLower)} (attempt ${created?.attempt ?? payload.attempt})`);
    } catch (e) {
      setError(e?.message || "Failed to create execution");
    } finally {
      setSavingId(null);
    }
  }

  async function saveExecutionEdit(execution) {
    setSavingId(execution.id);
    setError("");
    try {
      const payload = {
        result: editResult,
        notes: editNotes?.trim() || null,
        status: editResult === "pending" ? "running" : "completed",
      };
      const updated = await updateTestExecution(execution.id, payload);
      setExecutions((prev) => prev.map((ex) => (ex.id === updated.id ? updated : ex)));
      setEditingExecId(null);
      showToast("Execution updated");
    } catch (e) {
      setError(e?.message || "Failed to update execution");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 py-8 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.10),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.10),transparent_40%)]">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* HERO */}
        <Card className="relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-tr from-blue-200/40 to-indigo-200/40 blur-2xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-emerald-200/35 to-cyan-200/35 blur-2xl" />

          <div className="relative p-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm" />
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                      Execute Test Cases
                    </h2>
                    <p className="text-sm text-slate-600">
                      Faster runs: choose a Test Run, set global metadata once, then click results.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">Project: {projectId || "—"}</Badge>
                  {testRunId ? (
                    <Badge tone="indigo">Test Run: #{testRunId}</Badge>
                  ) : (
                    <Badge tone="amber">No Test Run selected</Badge>
                  )}
                  <Badge tone="green">{visibleItems.length} shown</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="secondary" onClick={fetchData} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </Button>
                <Button onClick={() => navigate(projectId ? `/projects/${projectId}` : "/projects")}>
                  Back to Project
                </Button>
              </div>
            </div>

            {/* Top controls */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                <div className="text-xs font-semibold text-slate-600">Test Run ID</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={testRunId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const n = v === "" ? null : Number(v);
                      setTestRunId(Number.isFinite(n) ? n : null);
                    }}
                    placeholder="e.g. 3"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (projectId && testRunId) {
                        localStorage.setItem(
                          `legacy_test_run_id_project_${projectId}`,
                          String(testRunId)
                        );
                        showToast("Saved Test Run ID");
                      }
                    }}
                    disabled={!projectId || !testRunId}
                  >
                    Save
                  </Button>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  (Temporary) Until you build a real Test Runs page.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                <div className="text-xs font-semibold text-slate-600">Search</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by title, description, id…"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                <div className="text-xs font-semibold text-slate-600">Filter by latest result</div>
                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                >
                  {["all", "passed", "failed", "blocked", "skipped", "pending"].map((v) => (
                    <option key={v} value={v}>
                      {v === "all" ? "All" : titleFromResultLower(v)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {toast && <Notice tone="success">{toast}</Notice>}
          </div>
        </Card>

        {/* Selected test case detail (kept) */}
        {testCaseIdFilter && selectedCase && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">Selected test case</div>
                <div className="text-sm text-slate-700 font-semibold">
                  #{selectedCase.id}: {selectedCase.title || "Untitled"}
                </div>
              </div>
              <Badge tone="indigo">
                Executions: {executionsByCase.get(selectedCase.id)?.length || 0}
              </Badge>
            </CardHeader>
            <CardBody className="pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                  <div className="text-xs font-semibold text-slate-600">Preconditions</div>
                  {selectedCase.preconditions?.length ? (
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                      {selectedCase.preconditions.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">—</div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 md:col-span-2">
                  <div className="text-xs font-semibold text-slate-600">Steps</div>
                  {selectedCase.steps?.length ? (
                    <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">
                      {selectedCase.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">—</div>
                  )}

                  <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
                    <div className="text-xs font-semibold text-slate-600">Expected Result</div>
                    <div className="mt-1 text-sm text-slate-700">{selectedCase.expected_result || "—"}</div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}


        {/* Global metadata */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Global metadata (applies to new executions)</div>
              <div className="text-xs text-slate-600">Fill once; you can override per test case.</div>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                setGlobalMeta({
                  build_number: "",
                  git_sha: "",
                  branch: "",
                  ci_run_id: "",
                  job_url: "",
                  environment_json_text: "",
                  artifacts_links: [],
                })
              }
            >
              Clear
            </Button>
          </CardHeader>
          <CardBody className="pt-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Build number</label>
                <input
                  value={globalMeta.build_number}
                  onChange={(e) => setGlobalMeta((p) => ({ ...p, build_number: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  placeholder="e.g. 1.4.2"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">Branch</label>
                <input
                  value={globalMeta.branch}
                  onChange={(e) => setGlobalMeta((p) => ({ ...p, branch: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  placeholder="e.g. main"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">Git SHA</label>
                <input
                  value={globalMeta.git_sha}
                  onChange={(e) => setGlobalMeta((p) => ({ ...p, git_sha: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  placeholder="e.g. a45f2d3"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">CI run id</label>
                <input
                  value={globalMeta.ci_run_id}
                  onChange={(e) => setGlobalMeta((p) => ({ ...p, ci_run_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  placeholder="e.g. 987654"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-slate-600">Job URL</label>
                <input
                  value={globalMeta.job_url}
                  onChange={(e) => setGlobalMeta((p) => ({ ...p, job_url: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-slate-600">Environment</label>
                <select
                  value={environmentPresetKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setEnvironmentPresetKey(key);
                    const selected = environmentPresets.find((p) => p.key === key);
                    if (selected) {
                      setGlobalMeta((p) => ({
                        ...p,
                        environment_json_text: JSON.stringify(selected.value, null, 2),
                      }));
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                >
                  <option value="">Select environment…</option>
                  {environmentPresets.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={globalMeta.environment_json_text}
                  onChange={(e) => setGlobalMeta((p) => ({ ...p, environment_json_text: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-mono"
                  placeholder='{"os":"Windows 11","browser":"Chrome 121"}'
                  rows={3}
                />
                <div className="mt-2 text-[11px] text-slate-500">
                  Pick from the list or edit the JSON.
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-slate-600">Artifacts</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="relative inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-white">
                    Add photo/video
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (!files.length) return;
                        const urls = files.map((f) => URL.createObjectURL(f));
                        setGlobalMeta((p) => ({
                          ...p,
                          artifacts_links: [...(p.artifacts_links || []), ...urls],
                        }));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {globalMeta.artifacts_links?.length ? (
                  <div className="mt-3 space-y-2">
                    {globalMeta.artifacts_links.map((link, idx) => (
                      <div key={`${link}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs">
                        <a href={link} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">
                          {link}
                        </a>
                        <Button
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() =>
                            setGlobalMeta((p) => ({
                              ...p,
                              artifacts_links: p.artifacts_links.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-slate-500">No artifacts added yet.</div>
                )}
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-slate-600">Notes (applies to new executions)</label>
                <input
                  value={globalNotes}
                  onChange={(e) => setGlobalNotes(e.target.value)}
                  placeholder="Add execution notes (optional)"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700
                             focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-slate-600">Status (applies to new executions)</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { value: "auto", label: "Auto" },
                    { value: "running", label: "Running" },
                    { value: "completed", label: "Completed" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      variant={globalStatus === opt.value ? "primary" : "secondary"}
                      className="h-8 px-3 text-xs"
                      onClick={() => setGlobalStatus(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Auto sets status to running for pending results, otherwise completed.
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-[11px] font-semibold text-slate-600">
                  Result (applies to selected test case)
                </label>
                {testCaseIdFilter && selectedCase ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {resultButtons.map((b) => (
                        <button
                          key={b.value}
                          onClick={() => handleExecute(selectedCase.id, b.value)}
                          disabled={savingId === selectedCase.id || !testRunId}
                          className={cn(
                            "rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition",
                            "bg-gradient-to-r focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
                            b.className
                          )}
                          title={!testRunId ? "No test_run_id selected" : ""}
                        >
                          {savingId === selectedCase.id ? "Saving…" : b.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      Selected: #{selectedCase.id} • Next attempt: {nextAttemptByCase.get(Number(selectedCase.id)) || 1}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Select a test case to run results here.
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* LIST */}
        {loading ? (
          <Card>
            <CardBody className="text-sm text-slate-600">Loading test cases…</CardBody>
          </Card>
        ) : visibleItems.length === 0 ? (
          <Card>
            <CardBody className="text-sm text-slate-600">No test cases found.</CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((tc) => {
              const latest = latestByCase.get(tc.id);
              const latestResult = (latest?.result || "pending").toLowerCase();
              const history = executionsByCase.get(tc.id) || [];
              const tone = toneFromResult(latestResult);
              const selectedExecutionId = selectedExecutionByCase[tc.id] ?? latest?.id ?? null;
              const selectedExecution = history.find((ex) => ex.id === selectedExecutionId) || latest || null;
              const selectedResult = (selectedExecution?.result || "pending").toLowerCase();
              const canReportBug = selectedResult === "failed";
              const nextAttempt = nextAttemptByCase.get(Number(tc.id)) || 1;

              return (
                <Card key={tc.id} className="relative overflow-hidden">
                  <div className={cn("absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b", accentFromLatestResult(latestResult))} />

                  <CardHeader className="pl-7 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{tc.title || "Untitled"}</div>
                        <Chip tone={tone}>Latest: {titleFromResultLower(latestResult)}</Chip>
                        <Badge tone="slate">Executions: {history.length}</Badge>
                        <Badge tone="indigo">Next attempt: {nextAttempt}</Badge>
                      </div>
                      {tc.description ? (
                        <div className="text-sm text-slate-600">{tc.description}</div>
                      ) : (
                        <div className="text-xs text-slate-500">No description</div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {history.length > 0 && (
                        <select
                          value={selectedExecutionId ?? ""}
                          onChange={(e) =>
                            setSelectedExecutionByCase((prev) => ({
                              ...prev,
                              [tc.id]: e.target.value ? Number(e.target.value) : null,
                            }))
                          }
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs"
                          title="Select execution for bug report"
                        >
                          {history.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              #{ex.id} • {titleFromResultLower(ex.result || "pending")} • Attempt {ex.attempt ?? "—"}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/projects/${projectId}/bugs/new`, {
                            state: {
                              projectId: Number(projectId),
                              requirementId: tc.requirement_id ?? null,
                              testCaseId: Number(tc.id),
                              executionId: selectedExecution?.id || null,
                              source: "test_execution",
                              title: `Bug: ${tc.title || "Untitled"}`,
                              description: tc.description || "",
                              steps: (tc.steps || []).join("\n"),
                              expected: tc.expected_result || "",
                              actual: (selectedExecution?.notes || globalNotes || "").trim(),
                              environment: formatEnvironmentSummary(selectedExecution?.environment_json) || "",
                              severity_hint: "medium",
                            },
                          })
                        }
                        disabled={!projectId}
                        className={cn(
                          "rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition border",
                          canReportBug
                            ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                        title={
                          canReportBug
                            ? "Create bug report from selected execution"
                            : "Create bug report (tip: select a Failed execution)"
                        }
                      >
                        🐞 Bug report
                      </button>

                      {!testCaseIdFilter &&
                        resultButtons.map((b) => (
                          <button
                            key={b.value}
                            onClick={() => handleExecute(tc.id, b.value)}
                            disabled={savingId === tc.id || !testRunId}
                            className={cn(
                              "rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition",
                              "bg-gradient-to-r focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
                              b.className
                            )}
                            title={!testRunId ? "No test_run_id selected" : ""}
                          >
                            {savingId === tc.id ? "Saving…" : b.label}
                          </button>
                        ))}
                    </div>
                  </CardHeader>

                  <CardBody className="pl-7 pt-4 space-y-4">
                    {/* Notes */}
                    {/* History */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-slate-600">Execution history</div>
                        {history.length > 10 && <Badge tone="slate">Showing 10 / {history.length}</Badge>}
                      </div>

                      {history.length ? (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-xs text-slate-700">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="py-2 pr-3">Run</th>
                                <th className="py-2 pr-3">Attempt</th>
                                <th className="py-2 pr-3">Executed by</th>
                                <th className="py-2 pr-3">Status</th>
                                <th className="py-2 pr-3">Result</th>
                                <th className="py-2 pr-3">Started</th>
                                <th className="py-2 pr-3">Finished</th>
                                <th className="py-2 pr-3">Job URL</th>
                                <th className="py-2 pr-3">Notes</th>
                                <th className="py-2 pr-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.slice(0, 10).map((ex) => (
                                <tr key={ex.id} className="border-t border-slate-200/70">
                                  <td className="py-2 pr-3">{ex.test_run_id ?? "—"}</td>
                                  <td className="py-2 pr-3">{ex.attempt ?? "—"}</td>

                                  <td className="py-2 pr-3">{ex.executed_by_user_name || ex.executed_by_user_id || "—"}</td>

                                  <td className="py-2 pr-3">
                                    <Chip tone={(ex.status || "").toLowerCase() === "completed" ? "green" : "blue"}>
                                      {ex.status || "—"}
                                    </Chip>
                                  </td>

                                  <td className="py-2 pr-3 font-semibold">
                                    {editingExecId === ex.id ? (
                                      <select
                                        value={editResult}
                                        onChange={(e) => setEditResult(e.target.value)}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                      >
                                        {["passed", "failed", "blocked", "skipped", "pending"].map((r) => (
                                          <option key={r} value={r}>
                                            {titleFromResultLower(r)}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <Chip tone={toneFromResult(ex.result)} className="font-semibold">
                                        {titleFromResultLower(ex.result || "pending")}
                                      </Chip>
                                    )}
                                  </td>

                                  <td className="py-2 pr-3">{ex.started_at ? new Date(ex.started_at).toLocaleString() : "—"}</td>
                                  <td className="py-2 pr-3">{ex.finished_at ? new Date(ex.finished_at).toLocaleString() : "—"}</td>

                                  <td className="py-2 pr-3">
                                    {ex.job_url ? (
                                      <a
                                        href={ex.job_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        Open
                                      </a>
                                    ) : (
                                      "—"
                                    )}
                                  </td>

                                  <td className="py-2 pr-3">
                                    {editingExecId === ex.id ? (
                                      <input
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                      />
                                    ) : (
                                      <span className="text-slate-600">{ex.notes || "—"}</span>
                                    )}
                                  </td>

                                  <td className="py-2 pr-3">
                                    {editingExecId === ex.id ? (
                                      <div className="flex gap-2">
                                        <Button variant="primary" onClick={() => saveExecutionEdit(ex)} disabled={savingId === ex.id}>
                                          Save
                                        </Button>
                                        <Button variant="secondary" onClick={() => setEditingExecId(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="secondary"
                                        onClick={() => {
                                          setEditingExecId(ex.id);
                                          setEditResult((ex.result || "pending").toLowerCase());
                                          setEditNotes(ex.notes || "");
                                        }}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">No executions yet.</div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
