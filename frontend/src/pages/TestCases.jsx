import { useState } from "react";
import { generateTestCases } from "../api";

export default function TestCases() {
  const [requirementText, setRequirementText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function onGenerate() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await generateTestCases({
        requirementText,
        context: { domain: "Automotive/Railway", style: "manual test cases" },
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

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">Requirements → Test Cases</h2>

      <div className="grid gap-2">
        <textarea
          value={requirementText}
          onChange={(e) => setRequirementText(e.target.value)}
          rows={10}
          placeholder="Paste requirement / user story here..."
          className="w-full rounded-lg border border-slate-300 p-3 dark:border-slate-700 dark:bg-slate-950"
        />

        <div className="flex gap-2">
          <button
            onClick={useExample}
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Use example
          </button>

          <button
            onClick={onGenerate}
            disabled={loading || !requirementText.trim()}
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="grid gap-4">
          <h3 className="text-lg font-semibold">Test cases</h3>

          {result.testCases?.map((tc, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-semibold">
                {tc.title} <span className="font-normal text-slate-500">— {tc.priority}</span>
              </div>

              <div className="mt-3">
                <div className="text-sm font-medium">Preconditions:</div>
                <ul className="list-disc pl-5 text-sm">
                  {tc.preconditions?.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>

              <div className="mt-3">
                <div className="text-sm font-medium">Steps:</div>
                <ol className="list-decimal pl-5 text-sm">
                  {tc.steps?.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>

              <div className="mt-3 text-sm">
                <span className="font-medium">Expected:</span> {tc.expected}
              </div>
            </div>
          ))}

          {!!result.missingInfo?.length && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/40">
              <div className="font-semibold">Missing info</div>
              <ul className="mt-2 list-disc pl-5">
                {result.missingInfo.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
