import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  listTestCases,
  listTestExecutions,
  createTestExecution,
  updateTestExecution,
} from "../api";

/** ---------- UI helpers (layout + colors) ---------- */
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
  return (
    <div className={cn("px-6 py-4 border-b border-slate-100/80", className)}>
      {children}
    </div>
  );
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
    case "pending":
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
    case "pending":
    default:
      return "from-blue-500 to-indigo-400";
  }
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
  const [notesByCase, setNotesByCase] = useState({});

  const [editingExecId, setEditingExecId] = useState(null);
  const [editResult, setEditResult] = useState("Pending");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!projectId) return;
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
    } catch (e) {
      setError(e?.message || "Failed to load test cases");
    } finally {
      setLoading(false);
    }
  }

  // NOTE: Your original logic keeps the *first* seen as "latest".
  // If your API returns newest-first, that's correct. Otherwise, sort by date.
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

  const visibleItems = useMemo(() => {
    if (!testCaseIdFilter || !Number.isFinite(testCaseIdFilter)) return items;
    return items.filter((tc) => Number(tc.id) === testCaseIdFilter);
  }, [items, testCaseIdFilter]);

  const selectedCase = useMemo(() => {
    if (!testCaseIdFilter || !Number.isFinite(testCaseIdFilter)) return null;
    return items.find((tc) => Number(tc.id) === testCaseIdFilter) || null;
  }, [items, testCaseIdFilter]);

  const resultButtons = [
    { label: "Passed", className: "from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 focus:ring-emerald-200" },
    { label: "Failed", className: "from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 focus:ring-rose-200" },
    { label: "Blocked", className: "from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 focus:ring-amber-200" },
    { label: "Skipped", className: "from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700 focus:ring-slate-200" },
    { label: "Pending", className: "from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-200" },
  ];

  async function handleExecute(testCaseId, result) {
    if (!projectId) return;
    setSavingId(testCaseId);
    setError("");
    try {
      const noteValue = (notesByCase[testCaseId] || "").trim();
      const payload = {
        project_id: Number(projectId),
        test_case_id: Number(testCaseId),
        result,
        notes: noteValue || null,
      };
      const created = await createTestExecution(payload);
      setExecutions((prev) => [created, ...prev]);
      if (noteValue) setNotesByCase((prev) => ({ ...prev, [testCaseId]: "" }));
    } catch (e) {
      setError(e?.message || "Failed to create execution");
    } finally {
      setSavingId(null);
    }
  }

  async function saveExecutionEdit(execution, projectIdValue) {
    setSavingId(execution.id);
    setError("");
    try {
      const payload = {
        project_id: Number(projectIdValue),
        test_case_id: Number(execution.test_case_id),
        result: editResult,
        notes: editNotes?.trim() || null,
      };
      const updated = await updateTestExecution(execution.id, payload);
      setExecutions((prev) => prev.map((ex) => (ex.id === updated.id ? updated : ex)));
      setEditingExecId(null);
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
                      Click a result to record a test execution for each test case.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">Project: {projectId || "—"}</Badge>
                  {testCaseIdFilter ? (
                    <Badge tone="purple">Filter: TestCase #{testCaseIdFilter}</Badge>
                  ) : (
                    <Badge tone="slate">All test cases</Badge>
                  )}
                  <Badge tone="green">{visibleItems.length} shown</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="secondary" onClick={fetchData} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </Button>
                <Button
                  onClick={() => navigate(projectId ? `/projects/${projectId}` : "/projects")}
                >
                  Back to Project
                </Button>
              </div>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </Card>

        {/* Selected test case detail */}
        {testCaseIdFilter && (
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-800">Selected test case</div>
                <div className="text-sm text-slate-700">
                  {selectedCase ? (
                    <span className="font-semibold">
                      #{selectedCase.id}: {selectedCase.title || "Untitled"}
                    </span>
                  ) : (
                    "Loading…"
                  )}
                </div>
              </div>

              {selectedCase && (
                <div className="flex items-center gap-2">
                  <Badge tone="indigo">
                    Executions: {executionsByCase.get(selectedCase.id)?.length || 0}
                  </Badge>
                </div>
              )}
            </CardHeader>

            {selectedCase && (
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
                      <div className="mt-1 text-sm text-slate-700">
                        {selectedCase.expected_result || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            )}
          </Card>
        )}

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
              const latestResult = latest?.result || "Pending";
              const history = executionsByCase.get(tc.id) || [];
              const tone = toneFromResult(latestResult);

              return (
                <Card key={tc.id} className="relative overflow-hidden">
                  {/* Left accent bar */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b",
                      accentFromLatestResult(latestResult)
                    )}
                  />

                  <CardHeader className="pl-7 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">
                          {tc.title || "Untitled"}
                        </div>
                        <Chip tone={tone}>Latest: {latestResult}</Chip>
                        <Badge tone="slate">Executions: {history.length}</Badge>
                      </div>

                      {tc.description ? (
                        <div className="text-sm text-slate-600">{tc.description}</div>
                      ) : (
                        <div className="text-xs text-slate-500">No description</div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {resultButtons.map((b) => (
                        <button
                          key={b.label}
                          onClick={() => handleExecute(tc.id, b.label)}
                          disabled={savingId === tc.id}
                          className={cn(
                            "rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition",
                            "bg-gradient-to-r focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
                            b.className
                          )}
                        >
                          {savingId === tc.id ? "Saving…" : b.label}
                        </button>
                      ))}
                    </div>
                  </CardHeader>

                  <CardBody className="pl-7 pt-4 space-y-4">
                    {/* Notes */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Notes</label>
                      <input
                        value={notesByCase[tc.id] || ""}
                        onChange={(e) =>
                          setNotesByCase((prev) => ({ ...prev, [tc.id]: e.target.value }))
                        }
                        placeholder="Add execution notes (optional)"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700
                                   focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* History */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-slate-600">Execution history</div>
                        {history.length > 10 && (
                          <Badge tone="slate">Showing 10 / {history.length}</Badge>
                        )}
                      </div>

                      {history.length ? (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-xs text-slate-700">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="py-2 pr-3">Executed by</th>
                                <th className="py-2 pr-3">Result</th>
                                <th className="py-2 pr-3">Started</th>
                                <th className="py-2 pr-3">Finished</th>
                                <th className="py-2 pr-3">Notes</th>
                                <th className="py-2 pr-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.slice(0, 10).map((ex) => (
                                <tr key={ex.id} className="border-t border-slate-200/70">
                                  <td className="py-2 pr-3">
                                    {ex.executed_by_user_name || ex.executed_by_user_id || "—"}
                                  </td>

                                  <td className="py-2 pr-3 font-semibold">
                                    {editingExecId === ex.id ? (
                                      <select
                                        value={editResult}
                                        onChange={(e) => setEditResult(e.target.value)}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                      >
                                        {["Passed", "Failed", "Blocked", "Skipped", "Pending"].map((r) => (
                                          <option key={r} value={r}>
                                            {r}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <Chip tone={toneFromResult(ex.result)} className="font-semibold">
                                        {ex.result || "Pending"}
                                      </Chip>
                                    )}
                                  </td>

                                  <td className="py-2 pr-3">
                                    {ex.started_at ? new Date(ex.started_at).toLocaleString() : "—"}
                                  </td>

                                  <td className="py-2 pr-3">
                                    {ex.finished_at ? new Date(ex.finished_at).toLocaleString() : "—"}
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
                                        <button
                                          onClick={() => saveExecutionEdit(ex, projectId)}
                                          disabled={savingId === ex.id}
                                          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white
                                                     hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingExecId(null)}
                                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setEditingExecId(ex.id);
                                          setEditResult(ex.result || "Pending");
                                          setEditNotes(ex.notes || "");
                                        }}
                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        Edit
                                      </button>
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
