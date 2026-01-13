
import { generateTestCases } from "../api";
import { useMemo, useState } from "react";
export default function TestCases() {
  const [requirementText, setRequirementText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const charCount = useMemo(() => requirementText.length, [requirementText]);

  async function onGenerate() {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const data = await generateTestCases({
        requirementText,
        context: { domain: "Automotive/Railway", style: "manual test cases" }
      });
      setResult(data);
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
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

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-800">Requirements → Test Cases</h2>
          <p className="text-sm text-slate-600">
            Paste a requirement/user story and generate structured, high-value test cases.
          </p>
        </div>
        {result && (
          <div className="flex gap-2">
            <button
              onClick={copyReadable}
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Copy Test Cases
            </button>
            <button
              onClick={copyJson}
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Copy JSON
            </button>
          </div>
        )}
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Input */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">Input</div>
            <div className="text-xs text-slate-500">{charCount} chars</div>
          </div>

          <textarea
            value={requirementText}
            onChange={(e) => setRequirementText(e.target.value)}
            rows={12}
            placeholder="Paste requirement / user story here..."
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={useExample}
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Use example
            </button>

            <button
              onClick={onGenerate}
              disabled={loading || !requirementText.trim()}
              type="button"
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate"}
            </button>

            <button
              onClick={() => {
                setRequirementText("");
                setResult(null);
                setError("");
              }}
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Clear
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Output */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800">Output</div>

          {!result && !loading && (
            <div className="mt-3 text-sm text-slate-500">
              Generated test cases will appear here.
            </div>
          )}

          {loading && (
            <div className="mt-3 text-sm text-slate-600">
              Generating… please wait.
            </div>
          )}

          {result && (
            <div className="mt-3 grid gap-3">
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
                    <span className="font-semibold">Expected:</span> {tc.expected}
                  </div>
                </div>
              ))}

              {!!result.missingInfo?.length && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                  <div className="font-semibold text-amber-900">Missing info</div>
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
  );
}

