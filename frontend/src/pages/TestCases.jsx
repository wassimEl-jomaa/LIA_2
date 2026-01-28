import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateTestCases, predictRequirementCategory } from "../api";

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

export default function TestCases() {
  const navigate = useNavigate();

  const [requirementText, setRequirementText] = useState("");
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // ML prediction
  const [prediction, setPrediction] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);

  // Feature tabs
  const [feature, setFeature] = useState("testcases");

  // Active project
  const [activeProjectId, setActiveProjectId] = useState(
    localStorage.getItem("active_project_id")
  );

  // Optional UI feedback (saved ids)
  const [savedRequirementId, setSavedRequirementId] = useState(null);
  const [savedTestCaseIds, setSavedTestCaseIds] = useState([]);

  useEffect(() => {
    setActiveProjectId(localStorage.getItem("active_project_id"));
  }, []);

  const charCount = useMemo(() => requirementText.length, [requirementText]);

  function handleBack() {
    const pid = localStorage.getItem("active_project_id");
    if (!pid) return navigate("/projects");
    navigate(`/projects/${pid}`);
  }

  async function onGenerate() {
    setError("");
    setResult(null);
    setSavedRequirementId(null);
    setSavedTestCaseIds([]);
    setLoading(true);

    try {
      if (!activeProjectId) throw new Error("No active project selected. Please select a project first.");
      if (!requirementText.trim()) throw new Error("Please write a requirement first.");

      const projectId = Number(activeProjectId);
      if (!Number.isFinite(projectId)) throw new Error("Invalid project id.");

      // 1) ✅ Save requirement FIRST
      const requirementPayload = {
        project_id: projectId,
        title: buildRequirementTitle(requirementText),
        description: requirementText.trim(),
        // acceptance_criteria: null, // add if your schema supports it
        // source: "manual",
      };

      const createdRequirement = await apiFetch("/api/requirements", {
        method: "POST",
        body: JSON.stringify(requirementPayload),
      });

      const requirementId = createdRequirement?.id;
      if (!requirementId) throw new Error("Requirement saved but API did not return an id.");

      setSavedRequirementId(requirementId);

      // 2) Generate test cases with AI
      const context = { domain: "Automotive/Railway" };

      if (feature !== "testcases") {
        throw new Error("This feature is planned (backend not ready yet).");
      }

      const ai = await generateTestCases({
        requirementText,
        context: { ...context, style: "manual test cases" },
      });

      const jsonData = ai.parsed_json || {};
      const generated = (jsonData.test_cases || []).map((tc) => ({
        title: tc.title,
        priority: tc.priority || "medium",
        preconditions: tc.preconditions || [],
        steps: tc.steps || [],
        expected: tc.expected,
        type: tc.type,
        description: tc.description || null,
      }));

      // Show in UI immediately
      setResult({
        testCases: generated,
        missingInfo: jsonData.assumptions || jsonData.open_questions || [],
        notes: jsonData.notes || [],
      });

      // 3) ✅ Save test cases SECOND (linked to requirement_id)
      const createdIds = [];
      for (const tc of generated) {
        const tcPayload = {
          project_id: projectId,
          requirement_id: requirementId, // ✅ link to the saved requirement
          title: tc.title,
          description: tc.description || null,
          preconditions: tc.preconditions || [],
          steps: tc.steps || [],
          expected_result: tc.expected || null,
          // priority/status can be added only if your TestCaseCreateIn accepts them
          // priority: tc.priority || "medium",
          // status: "active",
        };

        const createdTc = await apiFetch("/api/test_cases", {
          method: "POST",
          body: JSON.stringify(tcPayload),
        });

        if (createdTc?.id) createdIds.push(createdTc.id);
      }

      setSavedTestCaseIds(createdIds);
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
          setSavedRequirementId(null);
          setSavedTestCaseIds([]);
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="relative p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900">Test Cases</h1>
                <p className="text-sm text-slate-600 max-w-2xl">
                  Write a requirement, generate test cases, and we’ll save both automatically.
                </p>

                {(savedRequirementId || savedTestCaseIds.length > 0) && (
                  <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    Saved ✅ Requirement ID: <b>{savedRequirementId}</b>
                    {savedTestCaseIds.length > 0 && (
                      <> · Test cases saved: <b>{savedTestCaseIds.length}</b></>
                    )}
                  </div>
                )}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Write your krave</div>
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
                {loading ? "Generating & saving..." : "Generate"}
              </button>

              <button
                onClick={() => {
                  setRequirementText("");
                  setResult(null);
                  setError("");
                  setPrediction(null);
                  setSavedRequirementId(null);
                  setSavedTestCaseIds([]);
                }}
                type="button"
                className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Test cases</div>
              {loading && <div className="text-xs text-slate-500">Working…</div>}
            </div>

            {!result && !loading && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Generated output will appear here.
              </div>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold text-blue-800">
                  Test cases ({result.testCases?.length || 0})
                </div>

                {result.testCases?.map((tc, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-900">
                      {tc.title}{" "}
                      <span className="font-normal text-slate-500">— {tc.priority}</span>
                    </div>

                    {!!tc.preconditions?.length && (
                      <div className="mt-3">
                        <div className="text-sm font-semibold text-slate-700">Preconditions</div>
                        <ul className="list-disc pl-5 text-sm text-slate-700">
                          {tc.preconditions.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!!tc.steps?.length && (
                      <div className="mt-3">
                        <div className="text-sm font-semibold text-slate-700">Steps</div>
                        <ol className="list-decimal pl-5 text-sm text-slate-700">
                          {tc.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="mt-3 text-sm text-slate-700">
                      <span className="font-semibold">Expected:</span> {tc.expected}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
