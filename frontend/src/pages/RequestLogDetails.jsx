import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";
const getToken = () => localStorage.getItem("token");

export default function RequestLogDetails() {
  const navigate = useNavigate();
  const { projectId, logId } = useParams();

  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
      } catch (e) {
        setErr(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [logId]);

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
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-500">Endpoint</div>
                <div className="mt-1 font-bold text-gray-900">{log.endpoint}</div>

                <div className="mt-3 text-xs font-semibold text-gray-500">Created</div>
                <div className="mt-1 text-sm text-gray-800">{log.created_at}</div>

                <div className="mt-3 text-xs font-semibold text-gray-500">Project ID</div>
                <div className="mt-1 text-sm text-gray-800">{log.project_id}</div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-500">Input</div>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-900 bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-[320px]">
                  {log.input_text}
                </pre>

                <div className="mt-4 text-xs font-semibold text-gray-500">Output</div>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-900 bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-[320px]">
                  {log.output_text}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
