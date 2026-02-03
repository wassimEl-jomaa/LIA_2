import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateTestCases } from "../api";

// Vite-safe API base (no "process is not defined")
const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token") || null;

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

function buildRequirementTitle(text) {
  const t = (text || "").trim();
  if (!t) return "Requirement";
  const firstLine = t.split("\n").find(Boolean) || t;
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function pickTestCaseList(jsonData) {
  if (!jsonData || typeof jsonData !== "object") return [];
  return (
    jsonData.test_cases ||
    jsonData.testCases ||
    jsonData.cases ||
    jsonData.items ||
    []
  );
}

function Pill({ children, tone = "slate" }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border";
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return <span className={`${base} ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Card({ className, children }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/70 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}
function CardHeader({ className, children }) {
  return <div className={cn("px-5 py-4 border-b border-slate-100", className)}>{children}</div>;
}
function CardBody({ className, children }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
function Button({ variant = "primary", className, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "bg-gradient-to-r from-blue-700 to-indigo-700 text-white hover:from-blue-800 hover:to-indigo-800 focus:ring-blue-200",
    secondary:
      "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 focus:ring-slate-200",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-200",
    purple: "bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-200",
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
function Notice({ tone = "error", children }) {
  const tones = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold border transition",
              isActive
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Disclosure({ title, right, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{title}</div>
          <div className="text-xs text-slate-500">{open ? "Click to collapse" : "Click to expand"}</div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {right}
          <span className="text-xs text-slate-400">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function TestCases() {
  const navigate = useNavigate();

  const [requirementText, setRequirementText] = useState("");
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // ML prediction
  const [prediction, setPrediction] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);

  // Requirement analysis (AI)
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Feature tabs (future)
  const [feature, setFeature] = useState("testcases");

  // Output tabs (what user is viewing)
  const [outputTab, setOutputTab] = useState("testcases"); // "testcases" | "analysis" | "classification"

  // Active project
  const [activeProjectId, setActiveProjectId] = useState(localStorage.getItem("active_project_id"));

  // Optional UI feedback (saved ids)
  const [savedRequirementId, setSavedRequirementId] = useState(null);
  const [savedTestCaseIds, setSavedTestCaseIds] = useState([]);
  const [saveIssues, setSaveIssues] = useState([]);

  useEffect(() => {
    setActiveProjectId(localStorage.getItem("active_project_id"));
  }, []);

  const charCount = useMemo(() => requirementText.length, [requirementText]);

  function handleBack() {
    const pid = localStorage.getItem("active_project_id");
    if (!pid) return navigate("/projects");
    navigate(`/projects/${pid}`);
  }

  async function ensureRequirementSaved() {
    if (!activeProjectId) throw new Error("No active project selected. Please select a project first.");
    if (!requirementText.trim()) throw new Error("Please write a requirement first.");
    if (savedRequirementId) return savedRequirementId;

    const projectId = Number(activeProjectId);
    if (!Number.isFinite(projectId)) throw new Error("Invalid project id.");

    const requirementPayload = {
      project_id: projectId,
      title: buildRequirementTitle(requirementText),
      description: requirementText.trim(),
    };

    const createdRequirement = await apiFetch("/api/requirements", {
      method: "POST",
      body: JSON.stringify(requirementPayload),
    });

    const requirementId = createdRequirement?.id;
    if (!requirementId) throw new Error("Requirement saved but API did not return an id.");

    setSavedRequirementId(requirementId);
    return requirementId;
  }

  async function onGenerate() {
    setError("");
    setResult(null);
    setAnalysis(null);
    setPrediction(null);
    setSavedRequirementId(null);
    setSavedTestCaseIds([]);
    setSaveIssues([]);
    setLoading(true);

    try {
      const projectId = Number(activeProjectId);
      if (!Number.isFinite(projectId)) throw new Error("Invalid project id.");

      const requirementId = await ensureRequirementSaved();

      const context = { domain: "Automotive/Railway" };
      if (feature !== "testcases") throw new Error("This feature is planned (backend not ready yet).");

      const ai = await generateTestCases({
        requirementText,
        context: { ...context, style: "manual test cases" },
      });

      const jsonData = ai.parsed_json || ai || {};
      console.log("[TestCases] AI raw response:", ai);
      console.log("[TestCases] AI parsed json:", jsonData);
      const generated = pickTestCaseList(jsonData).map((tc) => {
        const preconditions = normalizeStringList(
          tc.preconditions ?? tc.pre_conditions ?? tc.precondition ?? tc.preConditions
        );
        const steps = normalizeStringList(
          tc.steps ?? tc.test_steps ?? tc.testSteps ?? tc.step_list ?? tc.stepList
        );
        const expected =
          tc.expected_result ??
          tc.expected ??
          tc.expectedResult ??
          tc.expected_result_text ??
          null;

        return {
          title: tc.title,
          priority: (tc.priority || "medium").toLowerCase(),
          preconditions,
          steps,
          expected,
          type: tc.type,
          description: tc.description || null,
        };
      });

      setResult({
        testCases: generated,
        missingInfo: jsonData.assumptions || jsonData.open_questions || [],
        notes: jsonData.notes || [],
      });
      setOutputTab("testcases");

      const createdIds = [];
      const saveErrors = [];
      for (const [idx, tc] of generated.entries()) {
        const tcPayload = {
          project_id: projectId,
          requirement_id: requirementId,
          title: tc.title,
          description: tc.description || null,
          preconditions: tc.preconditions || [],
          steps: tc.steps || [],
          expected_result: tc.expected || null,
          priority: tc.priority || "medium",
          status: "active",
        };

        try {
          const createdTc = await apiFetch("/api/test_cases", {
            method: "POST",
            body: JSON.stringify(tcPayload),
          });

          if (createdTc?.id) createdIds.push(createdTc.id);
        } catch (err) {
          const message = err?.message || "Unknown error";
          saveErrors.push({ index: idx, title: tc.title, message });
          console.warn("[TestCases] Failed to save test case:", {
            index: idx,
            title: tc.title,
            message,
            payload: tcPayload,
          });
        }
      }

      setSavedTestCaseIds(createdIds);
      setSaveIssues(saveErrors);
      if (saveErrors.length) {
        setError(`Saved ${createdIds.length}/${generated.length} test cases. ${saveErrors.length} failed. Check console for details.`);
      }
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onAnalyzeRequirement() {
    setError("");
    setAnalysis(null);
    setAnalysisLoading(true);

    try {
      const requirementId = await ensureRequirementSaved();

      const data = await apiFetch("/api/requirement_analyses", {
        method: "POST",
        body: JSON.stringify({ requirement_id: Number(requirementId) }),
      });

      setAnalysis(data);
      setOutputTab("analysis");
    } catch (e) {
      setError(e?.message || "Requirement analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function onClassifyRequirement() {
    if (!requirementText.trim()) return;

    setError("");
    setPredictLoading(true);

    try {
      const projectId = Number(activeProjectId);
      if (!Number.isFinite(projectId)) throw new Error("Invalid project id.");

      const requirementId = await ensureRequirementSaved();

      const data = await apiFetch("/api/classify_requirements/generate", {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          requirement_id: Number(requirementId),
          force: false,
          include_recommendations: true,
        }),
      });

      setPrediction(data?.classification || null);
      setOutputTab("classification");
    } catch (e) {
      setError(e?.message || "Classification failed");
      setPrediction(null);
    } finally {
      setPredictLoading(false);
    }
  }

  function useExample() {
    setRequirementText(
`As a user, I want to reset my password using my email address,
so that I can regain access if I forget my password.

Acceptance criteria:
- User enters email on "Forgot password"
- If email exists: send reset link within 1 minute
- If email does not exist: show generic message
- Reset link expires after 30 minutes
- New password must be at least 12 chars`
    );
  }

  async function copyJson() {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  }

  async function copyReadable() {
    if (!result?.testCases?.length) return;

    const lines = result.testCases.map((tc, idx) => {
      const pre = (tc.preconditions || []).map((p) => `- ${p}`).join("\n");
      const steps = (tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join("\n");
      return `# ${idx + 1}. ${tc.title} (${tc.priority})\n\nPreconditions:\n${pre}\n\nSteps:\n${steps}\n\nExpected:\n${tc.expected}\n`;
    });

    await navigator.clipboard.writeText(lines.join("\n---\n\n"));
  }

  function resetAll() {
    setRequirementText("");
    setResult(null);
    setAnalysis(null);
    setError("");
    setPrediction(null);
    setSavedRequirementId(null);
    setSavedTestCaseIds([]);
    setOutputTab("testcases");
  }

  const canRun = Boolean(activeProjectId) && Boolean(requirementText.trim());
  const working = loading || analysisLoading || predictLoading;

  const statusBadges = (
    <div className="flex flex-wrap gap-2">
      <Pill tone={activeProjectId ? "green" : "amber"}>
        {activeProjectId ? `Project: ${activeProjectId}` : "No active project"}
      </Pill>
      <Pill tone={requirementText.trim() ? "blue" : "slate"}>{charCount} chars</Pill>
      {savedRequirementId && <Pill tone="purple">Saved req: #{savedRequirementId}</Pill>}
      {savedTestCaseIds.length > 0 && <Pill tone="green">Saved TCs: {savedTestCaseIds.length}</Pill>}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.10),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.08),transparent_40%)]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Sticky header */}
        <div className="sticky top-3 z-20">
          <Card className="overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                    Test Cases Generator
                  </h1>
                  <p className="text-sm text-slate-600">
                    Write a requirement, generate test cases, and we’ll save both automatically.
                  </p>
                  <div className="pt-2">{statusBadges}</div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="secondary" onClick={handleBack}>← Back</Button>

                  {result && (
                    <>
                      <Button variant="secondary" onClick={copyReadable}>Copy Test Cases</Button>
                      <Button variant="secondary" onClick={copyJson}>Copy JSON</Button>
                    </>
                  )}
                </div>
              </div>

              {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
              {!activeProjectId && (
                <div className="mt-4">
                  <Notice tone="warn">No active project selected. Go back and select a project first.</Notice>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 3-panel layout */}
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[420px_1fr_320px] gap-6 items-start">
          {/* LEFT: Requirement editor */}
          <div className="xl:sticky xl:top-[110px] space-y-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Requirement</div>
                  <div className="text-xs text-slate-500">Paste or write a user story</div>
                </div>
                <Pill tone="slate">{charCount} chars</Pill>
              </CardHeader>

              <CardBody>
                <textarea
                  value={requirementText}
                  onChange={(e) => {
                    setRequirementText(e.target.value);
                    setPrediction(null);
                    setAnalysis(null);
                  }}
                  rows={12}
                  placeholder="Paste requirement / user story here..."
                  className="w-full rounded-2xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-slate-50/60"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" type="button" onClick={useExample}>
                    Use example
                  </Button>
                  <Button
                    variant="success"
                    type="button"
                    onClick={onClassifyRequirement}
                    disabled={predictLoading || !canRun}
                  >
                    {predictLoading ? "Classifying..." : "🤖 Classify"}
                  </Button>
                  <Button
                    variant="purple"
                    type="button"
                    onClick={onAnalyzeRequirement}
                    disabled={analysisLoading || !canRun}
                    title={!activeProjectId ? "Select a project first" : ""}
                  >
                    {analysisLoading ? "Analyzing..." : "🔎 Analyze"}
                  </Button>
                  <Button
                    type="button"
                    onClick={onGenerate}
                    disabled={loading || !canRun}
                    title={!activeProjectId ? "Select a project first" : ""}
                  >
                    {loading ? "Generating & saving..." : "Generate"}
                  </Button>
                  <Button variant="secondary" type="button" onClick={resetAll}>
                    Clear
                  </Button>
                </div>

                {savedRequirementId || savedTestCaseIds.length > 0 ? (
                  <div className="mt-4">
                    <Notice tone="success">
                      Saved ✅ Requirement ID: <b>{savedRequirementId}</b>
                      {savedTestCaseIds.length > 0 && (
                        <> · Test cases saved: <b>{savedTestCaseIds.length}</b></>
                      )}
                    </Notice>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </div>

          {/* CENTER: Output */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Output</div>
                  <div className="text-xs text-slate-500">
                    {working ? "Working…" : "View generated results here"}
                  </div>
                </div>

                <Tabs
                  active={outputTab}
                  onChange={setOutputTab}
                  tabs={[
                    { id: "testcases", label: `Test cases${result?.testCases?.length ? ` (${result.testCases.length})` : ""}` },
                    { id: "analysis", label: "Analysis" },
                    { id: "classification", label: "Classification" },
                  ]}
                />
              </CardHeader>

              <CardBody className="space-y-4">
                {!analysis && !result && !prediction && !working && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    Generated output will appear here. Start by writing a requirement on the left.
                  </div>
                )}

                {/* TEST CASES TAB */}
                {outputTab === "testcases" && (
                  <>
                    {!result?.testCases?.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                        No test cases yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {result.testCases.map((tc, idx) => (
                          <Disclosure
                            key={idx}
                            title={`${idx + 1}. ${tc.title || "Untitled"}`}
                            right={
                              <span className="hidden sm:inline">
                                <Pill tone={tc.priority === "high" || tc.priority === "critical" ? "rose" : tc.priority === "low" ? "green" : "amber"}>
                                  {tc.priority || "medium"}
                                </Pill>
                              </span>
                            }
                          >
                            <div className="space-y-4 text-sm text-slate-700">
                              {tc.description && (
                                <div>
                                  <div className="text-xs font-semibold text-slate-600">Description</div>
                                  <div className="mt-1 whitespace-pre-wrap">{tc.description}</div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="font-semibold text-slate-700">Preconditions</div>
                                  {tc.preconditions?.length ? (
                                    <ul className="mt-2 list-disc pl-5">
                                      {tc.preconditions.map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="mt-2 text-slate-500">—</div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="font-semibold text-slate-700">Expected</div>
                                  <div className="mt-2">{tc.expected || "—"}</div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="font-semibold text-slate-700">Steps</div>
                                {tc.steps?.length ? (
                                  <ol className="mt-2 list-decimal pl-5">
                                    {tc.steps.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ol>
                                ) : (
                                  <div className="mt-2 text-slate-500">—</div>
                                )}
                              </div>
                            </div>
                          </Disclosure>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ANALYSIS TAB */}
                {outputTab === "analysis" && (
                  <>
                    {!analysis ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                        No analysis yet. Click <b>Analyze</b> on the left.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {analysis.category && <Pill tone="purple">Category: {analysis.category}</Pill>}
                          {analysis.risk_level && <Pill tone="amber">Risk: {analysis.risk_level}</Pill>}
                          {analysis.created_at && (
                            <Pill tone="slate">Created: {new Date(analysis.created_at).toLocaleString()}</Pill>
                          )}
                        </div>

                        {analysis.summary && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="font-semibold text-slate-800">Summary</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{analysis.summary}</div>
                          </div>
                        )}

                        {analysis.recommendations && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="font-semibold text-slate-800">Recommendations</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                              {analysis.recommendations}
                            </div>
                          </div>
                        )}

                        {analysis.raw_json && (
                          <details className="rounded-2xl border border-slate-200 bg-white p-4">
                            <summary className="cursor-pointer font-semibold text-slate-800">
                              Raw JSON
                            </summary>
                            <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs border border-slate-200">
                              {JSON.stringify(analysis.raw_json, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* CLASSIFICATION TAB */}
                {outputTab === "classification" && (
                  <>
                    {!prediction ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                        No classification yet. Click <b>Classify</b> on the left.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {prediction.category && <Pill tone="purple">Category: {prediction.category}</Pill>}
                          {prediction.risk_level && <Pill tone="amber">Risk: {prediction.risk_level}</Pill>}
                          {typeof prediction.confidence === "number" && (
                            <Pill tone="slate">Confidence: {(prediction.confidence * 100).toFixed(0)}%</Pill>
                          )}
                          {prediction.created_at && (
                            <Pill tone="slate">Created: {new Date(prediction.created_at).toLocaleString()}</Pill>
                          )}
                        </div>

                        {prediction.summary && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="font-semibold text-slate-800">Summary</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{prediction.summary}</div>
                          </div>
                        )}

                        {prediction.reasoning && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="font-semibold text-slate-800">Reasoning</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{prediction.reasoning}</div>
                          </div>
                        )}

                        {prediction.recommendations && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="font-semibold text-slate-800">Recommendations</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                              {prediction.recommendations}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          </div>

          {/* RIGHT: Quick actions / guidance */}
          <div className="xl:sticky xl:top-[110px] space-y-6">
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold text-slate-800">Quick actions</div>
                <div className="text-xs text-slate-500">Common next steps</div>
              </CardHeader>
              <CardBody className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setOutputTab("testcases");
                    if (!result) onGenerate();
                  }}
                  disabled={!canRun || working}
                >
                  {loading ? "Generating…" : "Generate test cases"}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setOutputTab("analysis");
                    if (!analysis) onAnalyzeRequirement();
                  }}
                  disabled={!canRun || working}
                >
                  {analysisLoading ? "Analyzing…" : "Analyze requirement"}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setOutputTab("classification");
                    if (!prediction) onClassifyRequirement();
                  }}
                  disabled={!canRun || working}
                >
                  {predictLoading ? "Classifying…" : "Classify requirement"}
                </Button>

                <div className="pt-2">
                  <Button variant="secondary" className="w-full" onClick={resetAll}>
                    Clear everything
                  </Button>
                </div>

                <div className="text-xs text-slate-500">
                  Tip: Use the output tabs to keep the screen clean while switching between
                  test cases, analysis, and classification.
                </div>
              </CardBody>
            </Card>

            {result && (
              <Card>
                <CardHeader>
                  <div className="text-sm font-semibold text-slate-800">Export</div>
                  <div className="text-xs text-slate-500">Copy to clipboard</div>
                </CardHeader>
                <CardBody className="flex flex-col gap-2">
                  <Button variant="secondary" onClick={copyReadable}>Copy test cases</Button>
                  <Button variant="secondary" onClick={copyJson}>Copy JSON</Button>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
