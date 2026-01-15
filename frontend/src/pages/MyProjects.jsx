import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token");
}

export default function MyProjects() {
  const navigate = useNavigate();
  const token = useMemo(() => getToken(), []);

  const [projects, setProjects] = useState([]);
  const [projectName, setProjectName] = useState("");

  const [activeProjectId, setActiveProjectId] = useState(
    Number(localStorage.getItem("active_project_id")) || null
  );

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  async function fetchMe() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUserName(data?.name || "");
      setUserEmail(data?.email || "");
    } catch {
      // ignore
    }
  }

  async function fetchProjects() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to load projects");
      }

      const data = await res.json();
      setProjects(data);

      if (!activeProjectId && data.length > 0) {
        const firstId = data[0].id;
        setActiveProjectId(firstId);
        localStorage.setItem("active_project_id", String(firstId));
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProject(e) {
    e.preventDefault();
    if (!projectName.trim()) return;

    setError("");
    setCreating(true);

    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: projectName.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.detail || "Failed to create project");

      setProjects((prev) => [data, ...prev]);
      setProjectName("");

      setActiveProjectId(data.id);
      localStorage.setItem("active_project_id", String(data.id));

      // ✅ Go directly to selected project page
      navigate(`/projects/${data.id}`);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  function selectProject(id) {
    setActiveProjectId(id);
    localStorage.setItem("active_project_id", String(id));

    // ✅ Navigate to selected project page
    navigate(`/projects/${id}`);
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
              <p className="text-sm text-gray-600 mt-1">
                Create a project and select it before generating test cases.
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm">
                <span className="font-semibold text-blue-800">
                  {userName ? `Hi, ${userName}` : "Hi"}
                </span>
                {userEmail && (
                  <span className="text-blue-700/80">• {userEmail}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={fetchProjects}
                className="rounded-md bg-white px-4 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-500">Active Project</div>
              <div className="mt-1 font-bold text-gray-900">
                {activeProject ? activeProject.name : "None selected"}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                project_id: <span className="font-semibold">{activeProjectId ?? "—"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-500">Tip</div>
              <div className="mt-1 text-sm text-gray-700">
                Use project names like <span className="font-semibold">Customer A - QA</span> or{" "}
                <span className="font-semibold">Train System - Regression</span>.
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-500">Next</div>
              <div className="mt-1 text-sm text-gray-700">
                Select a project to open its details page.
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 lg:col-span-1">
            <h2 className="text-lg font-bold text-gray-900">Create Project</h2>

            <form onSubmit={createProject} className="mt-4 space-y-3">
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="New project name (e.g. Customer A - QA)"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-md bg-gray-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </form>

            <div className="mt-4 text-xs text-gray-500">
              Active project is saved in your browser (localStorage).
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow border border-gray-100 lg:col-span-2">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-800">Projects</div>
                <div className="text-xs text-gray-500">
                  Click Select to open the project page.
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Total: <span className="font-semibold">{projects.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">Loading...</div>
            ) : projects.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                No projects yet. Create one on the left.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {projects.map((p) => {
                  const isActive = p.id === activeProjectId;
                  return (
                    <li key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                          {isActive && (
                            <span className="text-xs font-semibold rounded-full bg-green-100 text-green-700 px-2 py-0.5">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          id: {p.id} • created: {p.created_at}
                        </div>
                      </div>

                      <button
                        onClick={() => selectProject(p.id)}
                        className={
                          isActive
                            ? "rounded-md bg-green-600 px-3 py-2 text-white text-sm font-semibold"
                            : "rounded-md bg-gray-100 px-3 py-2 text-gray-800 text-sm font-semibold hover:bg-gray-200"
                        }
                      >
                        Select
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
