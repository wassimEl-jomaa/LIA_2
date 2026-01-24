
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateTestCases, predictRequirementCategory } from "../api";

export default function TestCases() {
  const navigate = useNavigate();

  const [requirementText, setRequirementText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  
  // ML prediction state
  const [prediction, setPrediction] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);

  // Feature tabs
  const [feature, setFeature] = useState("testcases"); // testcases | risks | regression | summary

  // Active project
  const [activeProjectId, setActiveProjectId] = useState(
    localStorage.getItem("active_project_id")
  );

  useEffect(() => {
    // If user refreshes, ensure state stays in sync
    setActiveProjectId(localStorage.getItem("active_project_id"));
  }, []);

  const charCount = useMemo(() => requirementText.length, [requirementText]);

  function handleBack() {
    const pid = localStorage.getItem("active_project_id");
    if (!pid) return navigate("/projects"); // fallback to MyProjects
    navigate(`/projects/${pid}`);
  }

  async function onGenerate() {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      if (!activeProjectId) {
        throw new Error("No active project selected. Please select a project first.");
      }

      const context = { domain: "Automotive/Railway" };

      if (feature === "testcases") {
        const data = await generateTestCases({
          requirementText,
          context: { ...context, style: "manual test cases" },
        });
        
        // Backend returns AIOut with parsed_json containing the actual data
        const jsonData = data.parsed_json || {};
        
        // Transform to match frontend expected format
        setResult({
          testCases: (jsonData.test_cases || []).map(tc => ({
            title: tc.title,
            priority: tc.priority,
            preconditions: tc.preconditions || [],
            steps: tc.steps || [],
            expected: tc.expected,
            type: tc.type
          })),
          missingInfo: jsonData.assumptions || jsonData.open_questions || [],
          notes: jsonData.notes || []
        });
      }

      if (feature !== "testcases") {
        throw new Error("This feature is planned (backend not ready yet).");
      }
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onClassifyRequirement() {
    if (!requirementText.trim()) return;
    
    setError("");
    setPredictLoading(true);

    try {
      const data = await predictRequirementCategory({ text: requirementText });
      setPrediction(data);
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

  function FeatureButton({ id, label }) {
    const active = feature === id;
    return (
      <button
        type="button"
        onClick={() => {
          setFeature(id);
          setResult(null);
          setError("");
        }}
        className={
          active
            ? "rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
            : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top header card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.08),transparent_35%)]" />
          <div className="relative p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                  QA Copilot
                  <span className="text-[11px] font-semibold text-blue-600">v1</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Test Cases</h1>
                <p className="text-sm text-slate-600 max-w-2xl">
                  Turn requirements into structured, high-value test cases. Classify scope, generate cases, and copy results in one place.
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold">
                    Active project: <span className="text-slate-900">{activeProjectId || "None"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold">
                    Characters: <span className="text-slate-900">{charCount}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={handleBack}
                  className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                >
                  Back
                </button>

                {result && (
                  <>
                    <button
                      onClick={copyReadable}
                      type="button"
                      className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                    >
                      Copy Test Cases
                    </button>
                    <button
                      onClick={copyJson}
                      type="button"
                      className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                    >
                      Copy JSON
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Feature tabs */}
            <div className="mt-5 flex flex-wrap gap-2">
              <FeatureButton id="testcases" label="Requirements → Test Cases" />
              <FeatureButton id="risks" label="Risk Areas (Soon)" />
              <FeatureButton id="regression" label="Regression (Soon)" />
              <FeatureButton id="summary" label="Summary (Soon)" />
            </div>

            {!activeProjectId && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No active project selected. Go back and select a project first.
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Input</div>
              <div className="text-xs text-slate-500">{charCount} chars</div>
            </div>

            <textarea
              value={requirementText}
              onChange={(e) => {
                setRequirementText(e.target.value);
                setPrediction(null);
              }}
              rows={12}
              placeholder="Paste requirement / user story here..."
              className="mt-3 w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-slate-50/50"
            />

            {/* ML Prediction Display */}
            {prediction && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-green-900">
                    🎯 ML Classification Result
                  </div>
                  <button
                    onClick={() => setPrediction(null)}
                    className="text-green-700 hover:text-green-900 text-xs"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="mt-3">
                  <div className="text-base font-bold text-green-900">
                    Category: {prediction.predicted_category}
                  </div>
                  <div className="text-sm text-green-800 mt-1">
                    Confidence: {(prediction.confidence * 100).toFixed(2)}%
                  </div>
                </div>

                {prediction.probabilities && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-green-900 mb-2">
                      All Categories:
                    </div>
                    <div className="space-y-1">
                      {Object.entries(prediction.probabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([category, prob]) => (
                          <div key={category} className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs text-green-800">
                                <span>{category}</span>
                                <span className="font-mono">{(prob * 100).toFixed(2)}%</span>
                              </div>
                              <div className="mt-1 h-1.5 bg-green-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-600 rounded-full"
                                  style={{ width: `${prob * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={useExample}
                type="button"
                className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
              >
                Use example
              </button>

              <button
                onClick={onClassifyRequirement}
                disabled={predictLoading || !requirementText.trim()}
                type="button"
                className="rounded-md bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {predictLoading ? "Classifying..." : "🤖 Classify (ML)"}
              </button>

              <button
                onClick={onGenerate}
                disabled={loading || !requirementText.trim() || !activeProjectId}
                type="button"
                className="rounded-md bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800 disabled:opacity-60"
                title={!activeProjectId ? "Select a project first" : ""}
              >
                {loading ? "Generating..." : "Generate"}
              </button>

              <button
                onClick={() => {
                  setRequirementText("");
                  setResult(null);
                  setError("");
                  setPrediction(null);
                }}
                type="button"
                className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Output card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Output</div>
              {loading && (
                <div className="text-xs text-slate-500">Generating…</div>
              )}
            </div>

            {!result && !loading && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Generated output will appear here.
              </div>
            )}

            {loading && (
              <div className="mt-4 grid gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="h-4 w-1/2 bg-slate-200 rounded" />
                    <div className="h-3 w-2/3 bg-slate-200 rounded" />
                    <div className="h-3 w-5/6 bg-slate-200 rounded" />
                    <div className="h-3 w-3/4 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold text-blue-800">
                  Test cases ({result.testCases?.length || 0})
                </div>

                {result.testCases?.map((tc, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="font-semibold text-slate-900">
                      {tc.title}{" "}
                      <span className="font-normal text-slate-500">
                        — {tc.priority}
                      </span>
                    </div>

                    {!!tc.preconditions?.length && (
                      <div className="mt-3">
                        <div className="text-sm font-semibold text-slate-700">
                          Preconditions
                        </div>
                        <ul className="list-disc pl-5 text-sm text-slate-700">
                          {tc.preconditions.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!!tc.steps?.length && (
                      <div className="mt-3">
                        <div className="text-sm font-semibold text-slate-700">
                          Steps
                        </div>
                        <ol className="list-decimal pl-5 text-sm text-slate-700">
                          {tc.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="mt-3 text-sm text-slate-700">
                      <span className="font-semibold">Expected:</span>{" "}
                      {tc.expected}
                    </div>
                  </div>
                ))}

                {!!result.missingInfo?.length && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                    <div className="font-semibold text-amber-900">
                      Missing info
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-amber-900">
                      {result.missingInfo.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
