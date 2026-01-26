import { useEffect, useState } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";
const getToken = () => localStorage.getItem("token");

export default function ExecuteTestCases() {
  const navigate = useNavigate();
  const { projectId, logId } = useParams();

  const [log, setLog] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // executions state: { [tcIndex]: [{status, notes}] }
  const [executions, setExecutions] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedIdxs, setSelectedIdxs] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (!getToken()) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    async function load() {
      setErr("");
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/history/${logId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || "Failed to load log");
        setLog(data);
        try {
          setParsed(JSON.parse(data.output_text));
        } catch {
          setParsed(null);
        }
      } catch (e) {
        setErr(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [logId]);

  useEffect(() => {
    if (parsed && parsed.test_cases && parsed.test_cases.length > 0) setActiveIdx(0);
  }, [parsed]);

  // parse selected query param (comma separated indexes)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sel = params.get("selected");
    if (!sel) {
      setSelectedIdxs(null);
      return;
    }
    const arr = sel.split(",").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
    setSelectedIdxs(arr);
    if (arr.length > 0) setActiveIdx(arr[0]);
  }, [location.search]);

  const addExecutionRow = (tcIndex) => {
    setExecutions((prev) => {
      const arr = prev[tcIndex] ? [...prev[tcIndex]] : [];
      arr.push({ status: "Passed", notes: "" });
      return { ...prev, [tcIndex]: arr };
    });
  };

  const updateExecution = (tcIndex, idx, key, value) => {
    setExecutions((prev) => {
      const arr = prev[tcIndex] ? [...prev[tcIndex]] : [];
      arr[idx] = { ...arr[idx], [key]: value };
      return { ...prev, [tcIndex]: arr };
    });
  };

  const removeExecution = (tcIndex, idx) => {
    setExecutions((prev) => {
      const arr = prev[tcIndex] ? [...prev[tcIndex]] : [];
      arr.splice(idx, 1);
      return { ...prev, [tcIndex]: arr };
    });
  };

  const submitAll = async () => {
    // Flatten and submit executions. API may vary; we'll POST per execution to a reasonable endpoint.
    const payloads = [];
    Object.keys(executions).forEach((tcIndex) => {
      const tc = parsed?.test_cases?.[tcIndex];
      if (!tc) return;
      executions[tcIndex].forEach((exe) => {
        payloads.push({ test_case_id: tc.id || `${tcIndex}`, status: exe.status, notes: exe.notes });
      });
    });

    if (payloads.length === 0) {
      alert("No executions to submit.");
      return;
    }

    try {
      // Try a bulk endpoint first
      const res = await fetch(`${API_BASE}/api/logs/${logId}/executions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ executions: payloads }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Submit failed (${res.status})`);
      }
      alert("Executions submitted successfully.");
      navigate(`/projects/${projectId}/logs/${logId}`);
    } catch (e) {
      // If backend not available, show in-console fallback
      console.error(e);
      alert("Failed to submit to server. Check console for payloads and try again.");
      console.log("Prepared execution payloads:", payloads);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Execute Test Cases</h1>
              <p className="text-sm text-gray-600 mt-1">Add one or many execution records for generated test cases.</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/projects/${projectId}/logs/${logId}`} className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50">Back</Link>
            </div>
          </div>

          {err && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

          {/* Top test case navigator (only shows selected indexes if provided) */}
          {!loading && parsed && parsed.test_cases && parsed.test_cases.length > 0 && (
            <div className="mt-4">
              <div className="flex gap-2 overflow-x-auto py-2">
                {(selectedIdxs && selectedIdxs.length > 0 ? selectedIdxs : parsed.test_cases.map((_, i) => i)).map((idx) => {
                  const tc = parsed.test_cases[idx];
                  if (!tc) return null;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveIdx(idx);
                        const el = document.getElementById(`tc-${idx}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium border ${idx === activeIdx ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}
                    >
                      {tc.id || `TC-${idx + 1}`} - {tc.title.slice(0, 40)}{tc.title.length > 40 ? '…' : ''}
                      <span className="ml-2 text-xs text-gray-500">({(executions[idx] || []).length})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="mt-4 text-sm text-gray-500">Loading...</div>
          ) : parsed && parsed.test_cases && parsed.test_cases.length > 0 ? (
            <div className="mt-6 space-y-4">
              {/* Render only the selected test case */}
              {(() => {
                const tc = parsed.test_cases[activeIdx];
                const idx = activeIdx;
                if (!tc) return <div className="mt-4 text-sm text-gray-600">Selected test case not found.</div>;
                return (
                  <div id={`tc-${idx}`} key={idx} className={`border border-gray-200 rounded-lg p-4 bg-white ring-2 ring-blue-100`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{tc.id || `TC-${idx + 1}`}: {tc.title}</div>
                      <div className="text-sm text-gray-600">{tc.type || ""}</div>
                    </div>

                    <div className="mt-3 text-sm text-gray-700">
                      {tc.description && <div className="mb-2">{tc.description}</div>}

                      {/* Preconditions */}
                      {tc.preconditions && tc.preconditions.length > 0 ? (
                        <div className="mt-2">
                          <div className="text-sm font-semibold text-gray-700">Preconditions:</div>
                          <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-1">
                            {tc.preconditions.map((pre, i) => (
                              <li key={i}>{pre}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-gray-600">Preconditions: (none specified)</div>
                      )}

                      {/* Steps */}
                      {tc.steps && tc.steps.length > 0 ? (
                        <div className="mt-3">
                          <div className="text-sm font-semibold text-gray-700">Steps:</div>
                          <ol className="list-decimal list-inside text-sm text-gray-700 mt-1 space-y-1">
                            {tc.steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-gray-600">Steps: (none specified)</div>
                      )}

                      {/* Expected Result */}
                      <div className="mt-3">
                        <div className="text-sm font-semibold text-gray-700">Expected Result:</div>
                        <div className="text-sm text-gray-700 mt-1">{tc.expected || "Route history storage is enabled and the user receives a confirmation message."}</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex gap-2">
                        <button onClick={() => addExecutionRow(idx)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Add Execution</button>
                        <button onClick={() => { setExecutions(prev => ({ ...prev, [idx]: [] })); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">Clear Executions</button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {(executions[idx] || []).map((exe, i) => (
                          <div key={i} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                            <div className="flex items-center gap-3">
                              <select value={exe.status} onChange={(e)=>updateExecution(idx,i,'status',e.target.value)} className="text-sm rounded-md border px-2 py-1">
                                <option>Passed</option>
                                <option>Failed</option>
                                <option>Blocked</option>
                              </select>
                              <input value={exe.notes} onChange={(e)=>updateExecution(idx,i,'notes',e.target.value)} placeholder="Notes" className="flex-1 text-sm rounded-md border px-2 py-1" />
                              <button onClick={()=>removeExecution(idx,i)} className="text-sm text-red-600">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-4 border-t flex items-center justify-end gap-2">
                <button onClick={() => navigate(`/projects/${projectId}/logs/${logId}`)} className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50">Cancel</button>
                <button onClick={submitAll} className="rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">Save Executions</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-600">No test cases found in this log's output.</div>
          )}
        </div>
      </div>
    </div>
  );
}
