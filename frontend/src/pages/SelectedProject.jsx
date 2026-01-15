import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token");
}

export default function SelectedProject() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);

  const [history, setHistory] = useState([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [error, setError] = useState("");

  // If not logged in -> go login
  useEffect(() => {
    if (!getToken()) navigate("/login");
  }, [navigate]);

  async function loadProject() {
    setError("");
    setLoadingProject(true);

    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to load projects");
      }

      const items = await res.json();
      const found = items.find((p) => String(p.id) === String(projectId));

      if (!found) throw new Error("Project not found");

      setProject(found);

      // Ensure active project is saved
      localStorage.setItem("active_project_id", String(found.id));
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoadingProject(false);
    }
  }

  async function loadHistory() {
    setError("");
    setLoadingHistory(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/history?project_id=${encodeURIComponent(projectId)}&limit=200`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to load history");
      }

      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadProject();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const endpointBadge = (endpoint) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border";
    switch ((endpoint || "").toLowerCase()) {
      case "testcases":
        return `${base} bg-blue-50 text-blue-700 border-blue-200`;
      case "risk":
        return `${base} bg-amber-50 text-amber-700 border-amber-200`;
      case "regression":
        return `${base} bg-purple-50 text-purple-700 border-purple-200`;
      case "summary":
        return `${base} bg-green-50 text-green-700 border-green-200`;
      default:
        return `${base} bg-gray-50 text-gray-700 border-gray-200`;
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header card */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Selected Project
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                This project is now active and will be used for AI requests.
              </p>
            </div>

            {/* ✅ Back to MyProjects.jsx */}
            <button
              onClick={() => navigate("/projects")}
              className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
            >
              Back
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loadingProject ? (
            <div className="mt-4 text-sm text-gray-500">Loading project...</div>
          ) : project ? (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:col-span-2">
                <div className="text-xs font-semibold text-gray-500">Project</div>
                <div className="mt-1 text-lg font-bold text-gray-900">
                  {project.name}
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  project_id:{" "}
                  <span className="font-semibold">{project.id}</span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  created:{" "}
                  <span className="font-semibold">{project.created_at}</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-500">Actions</div>

                <button
                  onClick={() => navigate("/testcases")}
                  className="mt-3 w-full rounded-md bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800"
                >
                  Go to Test Cases
                </button>

                <button
                  onClick={loadHistory}
                  className="mt-2 w-full rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
                >
                  Refresh History
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* History card */}
        <div className="bg-white rounded-2xl shadow border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Request History
              </div>
              <div className="text-xs text-gray-500">
                All AI requests (RequestLog) for this project.
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Total: <span className="font-semibold">{history.length}</span>
            </div>
          </div>

          {loadingHistory ? (
            <div className="p-6 text-sm text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No history yet. Generate something in Test Cases to create logs.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={endpointBadge(h.endpoint)}>
                        {h.endpoint}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        Request #{h.id}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      created_at: {h.created_at}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {/* ✅ NEW: View log details */}
                    <button
                      onClick={() =>
                        navigate(`/projects/${projectId}/logs/${h.id}`)
                      }
                      className="rounded-md bg-white px-3 py-2 text-gray-800 text-sm font-semibold border border-gray-200 hover:bg-gray-50"
                    >
                      View details
                    </button>

                    {/* Keep if you want */}
                    <button
                      onClick={() => navigate("/testcases")}
                      className="rounded-md bg-gray-100 px-3 py-2 text-gray-800 text-sm font-semibold hover:bg-gray-200"
                      title="Go to Test Cases page"
                    >
                      Open Test Cases
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
