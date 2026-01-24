import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";
const getToken = () => localStorage.getItem("token");

// Map endpoint to readable feature name
const getFeatureName = (endpoint) => {
  const mapping = {
    testcases: "Test Cases Generation",
    risk: "Risk Analysis",
    regression: "Regression Testing",
    summary: "Test Summary",
  };
  return mapping[endpoint] || endpoint;
};

export default function RequestLogDetails() {
  const navigate = useNavigate();
  const { projectId, logId } = useParams();

  const [log, setLog] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [parsedOutput, setParsedOutput] = useState(null);

  useEffect(() => {
    if (!getToken()) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    async function load() {
      setErr("");
      setLoading(true);
      try {
        // Fetch log details
        const res = await fetch(`${API_BASE}/api/history/${logId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || "Failed to load log");

        setLog(data);

        // Try to parse output_text as JSON
        try {
          const parsed = JSON.parse(data.output_text);
          setParsedOutput(parsed);
        } catch {
          // If not JSON, leave as null
          setParsedOutput(null);
        }

        // Fetch project details
        const projRes = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        if (projRes.ok) {
          const projData = await projRes.json().catch(() => null);
          setProject(projData);
        }
      } catch (e) {
        setErr(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [logId, projectId]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Breadcrumbs */}
        <div className="text-sm text-gray-600">
          <Link className="hover:underline text-blue-700 font-semibold" to="/myprojects">
            My Projects
          </Link>
          <span className="mx-2">→</span>
          <Link
            className="hover:underline text-blue-700 font-semibold"
            to={`/projects/${projectId}`}
          >
            Selected Project
          </Link>
          <span className="mx-2">→</span>
          <span className="text-gray-800 font-semibold">Request #{logId}</span>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">RequestLog Details</h1>
              <p className="text-sm text-gray-600 mt-1">
                Shows the full input and output saved for this AI request.
              </p>
            </div>

            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
            >
              Back
            </button>
          </div>

          {err && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {loading ? (
            <div className="mt-4 text-sm text-gray-500">Loading...</div>
          ) : log ? (
            <div className="mt-6 space-y-6">
              {/* Summary Table */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Field
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Request ID
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {log.id}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Project
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {project ? project.name : `Project ${log.project_id}`}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Feature
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getFeatureName(log.endpoint)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Created At
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {log.created_at}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Input Section */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Input Text</h3>
                </div>
                <div className="bg-white p-6">
                  <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-96">
                    {log.input_text}
                  </pre>
                </div>
              </div>

              {/* Output Section */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Output Text</h3>
                </div>
                <div className="bg-white p-6">
                  {parsedOutput ? (
                    <div className="space-y-4">
                      {/* Test Cases */}
                      {parsedOutput.test_cases && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Test Cases ({parsedOutput.test_cases.length})</h4>
                          <div className="space-y-3">
                            {parsedOutput.test_cases.map((tc, idx) => (
                              <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-start justify-between">
                                  <div className="font-semibold text-gray-900">{tc.id || `TC-${idx + 1}`}: {tc.title}</div>
                                  {tc.priority && (
                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                      tc.priority === 'High' ? 'bg-red-100 text-red-800' :
                                      tc.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-blue-100 text-blue-800'
                                    }`}>
                                      {tc.priority}
                                    </span>
                                  )}
                                </div>
                                {tc.type && <div className="text-xs text-gray-600 mt-1">Type: {tc.type}</div>}
                                
                                {tc.preconditions && tc.preconditions.length > 0 && (
                                  <div className="mt-3">
                                    <div className="text-sm font-semibold text-gray-700">Preconditions:</div>
                                    <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-1">
                                      {tc.preconditions.map((pre, i) => <li key={i}>{pre}</li>)}
                                    </ul>
                                  </div>
                                )}
                                
                                {tc.steps && tc.steps.length > 0 && (
                                  <div className="mt-3">
                                    <div className="text-sm font-semibold text-gray-700">Steps:</div>
                                    <ol className="list-decimal list-inside text-sm text-gray-700 mt-1 space-y-1">
                                      {tc.steps.map((step, i) => <li key={i}>{step}</li>)}
                                    </ol>
                                  </div>
                                )}
                                
                                {tc.expected && (
                                  <div className="mt-3">
                                    <div className="text-sm font-semibold text-gray-700">Expected Result:</div>
                                    <div className="text-sm text-gray-700 mt-1">{tc.expected}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {parsedOutput.notes && parsedOutput.notes.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                            {parsedOutput.notes.map((note, i) => <li key={i}>{note}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Assumptions */}
                      {parsedOutput.assumptions && parsedOutput.assumptions.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Assumptions</h4>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                            {parsedOutput.assumptions.map((assumption, i) => <li key={i}>{assumption}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Risks (for risk analysis) */}
                      {parsedOutput.risks && parsedOutput.risks.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Identified Risks</h4>
                          <div className="space-y-3">
                            {parsedOutput.risks.map((risk, idx) => (
                              <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-start justify-between">
                                  <div className="font-semibold text-gray-900">{risk.risk}</div>
                                  {risk.severity && (
                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                      risk.severity === 'High' ? 'bg-red-100 text-red-800' :
                                      risk.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {risk.severity}
                                    </span>
                                  )}
                                </div>
                                {risk.why_it_matters && (
                                  <div className="text-sm text-gray-700 mt-2">{risk.why_it_matters}</div>
                                )}
                                {risk.test_ideas && risk.test_ideas.length > 0 && (
                                  <div className="mt-2">
                                    <div className="text-xs font-semibold text-gray-600">Test Ideas:</div>
                                    <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-1">
                                      {risk.test_ideas.map((idea, i) => <li key={i}>{idea}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Open Questions */}
                      {parsedOutput.open_questions && parsedOutput.open_questions.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Open Questions</h4>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                            {parsedOutput.open_questions.map((q, i) => <li key={i}>{q}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-96">
                      {log.output_text}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
