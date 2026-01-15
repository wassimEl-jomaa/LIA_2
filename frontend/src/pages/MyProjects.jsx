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
  const [name, setName] = useState("");
  const [activeProjectId, setActiveProjectId] = useState(
    Number(localStorage.getItem("active_project_id")) || null
  );

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // If not logged in -> go login
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

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

      // If no active project selected yet, auto-select first project
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
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProject(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setError("");
    setCreating(true);

    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to create project");
      }

      // Add to list + select it
      setProjects((prev) => [data, ...prev]);
      setName("");

      setActiveProjectId(data.id);
      localStorage.setItem("active_project_id", String(data.id));
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  function selectProject(id) {
    setActiveProjectId(id);
    localStorage.setItem("active_project_id", String(id));
  }

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Projects</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create a project and select it before generating test cases.
            </p>
          </div>

          <button
            onClick={() => navigate("/testcases")}
            className="rounded-md bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800"
          >
            Go to Test Cases
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Create project */}
        <form onSubmit={createProject} className="mt-6 flex gap-2">
          <input
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="New project name (e.g. Customer A - QA)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-gray-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>

        {/* Projects list */}
        <div className="mt-6 bg-white rounded-xl shadow border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Projects
            </span>
            <button
              onClick={fetchProjects}
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              No projects yet. Create one above.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {projects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <li key={p.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-500">
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
                      {isActive ? "Selected" : "Select"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Active project info */}
        <div className="mt-4 text-sm text-gray-600">
          Active project_id:{" "}
          <span className="font-semibold">{activeProjectId ?? "None"}</span>
        </div>
      </div>
    </div>
  );
}
