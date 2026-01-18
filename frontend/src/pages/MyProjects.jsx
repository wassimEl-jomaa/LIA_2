import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

/** ---------- Security helpers (frontend MVP) ---------- */
function getToken() {
  return localStorage.getItem("token");
}
function getTokenExpiry() {
  return localStorage.getItem("token_expires_at");
}
function isTokenExpired() {
  const exp = getTokenExpiry();
  if (!exp) return false; // if backend doesn’t send it, don’t block
  const d = new Date(exp);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}
function safeLogout(navigate) {
  localStorage.removeItem("token");
  localStorage.removeItem("token_expires_at");
  localStorage.removeItem("active_project_id");
  navigate("/login");
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

  /** UX improvements */
  const [query, setQuery] = useState("");
  const filteredProjects = projects.filter((p) =>
    (p.name || "").toLowerCase().includes(query.toLowerCase())
  );

  /** ---------- Share (User management MVP - local storage) ---------- */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProject, setShareProject] = useState(null);
  const [shareUserEmail, setShareUserEmail] = useState("");
  const [shareGroupName, setShareGroupName] = useState("");
  const [shares, setShares] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("project_shares") || "{}");
    } catch {
      return {};
    }
  });

  function getProjectShares(projectId) {
    return shares[String(projectId)] || { users: [], groups: [] };
  }

  function persistShares(next) {
    setShares(next);
    localStorage.setItem("project_shares", JSON.stringify(next));
  }

  function openShareModal(project) {
    setShareProject(project);
    setShareUserEmail("");
    setShareGroupName("");
    setShareOpen(true);
  }

  function addShareUser() {
    if (!shareProject) return;
    const email = shareUserEmail.trim().toLowerCase();
    if (!email) return;

    const key = String(shareProject.id);
    const current = getProjectShares(key);

    if (current.users.includes(email)) {
      setShareUserEmail("");
      return;
    }

    const next = {
      ...shares,
      [key]: { ...current, users: [email, ...current.users] },
    };
    persistShares(next);
    setShareUserEmail("");
  }

  function addShareGroup() {
    if (!shareProject) return;
    const name = shareGroupName.trim();
    if (!name) return;

    const key = String(shareProject.id);
    const current = getProjectShares(key);

    if (current.groups.includes(name)) {
      setShareGroupName("");
      return;
    }

    const next = {
      ...shares,
      [key]: { ...current, groups: [name, ...current.groups] },
    };
    persistShares(next);
    setShareGroupName("");
  }

  function removeShareItem(type, value) {
    if (!shareProject) return;
    const key = String(shareProject.id);
    const current = getProjectShares(key);

    const next = {
      ...shares,
      [key]: {
        users:
          type === "users"
            ? current.users.filter((x) => x !== value)
            : current.users,
        groups:
          type === "groups"
            ? current.groups.filter((x) => x !== value)
            : current.groups,
      },
    };
    persistShares(next);
  }

  /** ---------- Authorized fetch wrapper ---------- */
  async function authFetch(url, options = {}) {
    const t = getToken();
    if (!t || isTokenExpired()) {
      safeLogout(navigate);
      throw new Error("Session expired. Please login again.");
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${t}`,
      },
    });

    if (res.status === 401) {
      // token invalid/expired in backend
      safeLogout(navigate);
      throw new Error("Unauthorized. Please login again.");
    }
    return res;
  }

  /** ---------- Guard ---------- */
  useEffect(() => {
    if (!token) navigate("/login");
    if (token && isTokenExpired()) safeLogout(navigate);
  }, [token, navigate]);

  async function fetchMe() {
    try {
      const res = await authFetch(`${API_BASE}/auth/me`);
      if (!res.ok) return;
      const data = await res.json();
      setUserName(data?.name || "");
      setUserEmail(data?.email || "");
    } catch {
      // ignore: we don't want to block UI
    }
  }

  async function fetchProjects() {
    setError("");
    setLoading(true);

    try {
      const res = await authFetch(`${API_BASE}/api/projects`, {
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to load projects");

      setProjects(Array.isArray(data) ? data : []);

      // If no active project selected yet, auto-select first
      if (!activeProjectId && Array.isArray(data) && data.length > 0) {
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
      const res = await authFetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim() }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to create project");

      setProjects((prev) => [data, ...prev]);
      setProjectName("");

      setActiveProjectId(data.id);
      localStorage.setItem("active_project_id", String(data.id));

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
    navigate(`/projects/${id}`);
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 to-white px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 font-bold">P</span>
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-slate-900 truncate">
                    My Projects
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Create a project, select it, and start generating test
                    assets with AI.
                  </p>
                </div>
              </div>

              {/* User info */}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-sm">
                <span className="font-semibold text-slate-800">
                  {userName ? `Hi, ${userName}` : "Hi"}
                </span>
                {userEmail && (
                  <span className="text-slate-600">• {userEmail}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={fetchProjects}
                className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                Refresh
              </button>

              <button
                onClick={() => safeLogout(navigate)}
                className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-black"
                title="Log out (clears token)"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">
                Active Project
              </div>
              <div className="mt-1 font-bold text-slate-900 truncate">
                {activeProject ? activeProject.name : "None selected"}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                project_id:{" "}
                <span className="font-semibold">{activeProjectId ?? "—"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Security</div>
              <div className="mt-1 text-sm text-slate-700">
                Token expiry is checked locally. If session expires you’ll be
                logged out automatically.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">
                User management (MVP)
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Share projects with users/groups (UI ready). Connect to backend
                later.
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create project */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:col-span-1">
            <h2 className="text-lg font-bold text-slate-900">Create Project</h2>
            <p className="text-sm text-slate-600 mt-1">
              Keep customer systems separated and track AI history per project.
            </p>

            <form onSubmit={createProject} className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="New project name (e.g. Customer A - QA)"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />

              <button
                type="submit"
                disabled={creating || !projectName.trim()}
                className="w-full rounded-lg bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800 disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </form>

            <div className="mt-5">
              <label className="text-xs font-semibold text-slate-500">
                Search projects
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Type to filter…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Active project is stored in your browser (localStorage).
            </div>
          </div>

          {/* Projects list */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Projects
                </div>
                <div className="text-xs text-slate-500">
                  Select a project to open details. Use Share to assign users/groups.
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Showing:{" "}
                <span className="font-semibold">{filteredProjects.length}</span>
                {" / "}
                <span className="font-semibold">{projects.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                {projects.length === 0
                  ? "No projects yet. Create one on the left."
                  : "No projects match your search."}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredProjects.map((p) => {
                  const isActive = p.id === activeProjectId;
                  const projectShares = getProjectShares(p.id);
                  const shareCount =
                    (projectShares.users?.length || 0) +
                    (projectShares.groups?.length || 0);

                  return (
                    <li
                      key={p.id}
                      className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900 truncate">
                            {p.name}
                          </div>
                          {isActive && (
                            <span className="text-xs font-semibold rounded-full bg-green-100 text-green-700 px-2 py-0.5">
                              Active
                            </span>
                          )}
                          {shareCount > 0 && (
                            <span className="text-xs font-semibold rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
                              Shared: {shareCount}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          id: {p.id} • created: {p.created_at}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openShareModal(p)}
                          className="rounded-lg bg-white px-3 py-2 text-slate-800 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
                          title="Share this project with users/groups (MVP UI)"
                        >
                          Share
                        </button>

                        <button
                          onClick={() => selectProject(p.id)}
                          className={
                            isActive
                              ? "rounded-lg bg-green-600 px-3 py-2 text-white text-sm font-semibold"
                              : "rounded-lg bg-blue-700 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-800"
                          }
                        >
                          Open
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Share modal */}
        {shareOpen && shareProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-lg border border-slate-100">
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-500">
                    Share Project
                  </div>
                  <div className="text-lg font-bold text-slate-900 truncate">
                    {shareProject.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    (MVP UI) Saved locally. Connect to backend later.
                  </div>
                </div>
                <button
                  onClick={() => setShareOpen(false)}
                  className="rounded-lg bg-white px-3 py-2 text-slate-800 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Add user */}
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Add user
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="user@email.com"
                      value={shareUserEmail}
                      onChange={(e) => setShareUserEmail(e.target.value)}
                    />
                    <button
                      onClick={addShareUser}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Add group */}
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Add group
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. QA Team"
                      value={shareGroupName}
                      onChange={(e) => setShareGroupName(e.target.value)}
                    />
                    <button
                      onClick={addShareGroup}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold hover:bg-black"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Current shares */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    Current access
                  </div>

                  <div className="mt-3 grid gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        Users
                      </div>
                      {getProjectShares(shareProject.id).users.length === 0 ? (
                        <div className="mt-1 text-sm text-slate-500">
                          No users added.
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getProjectShares(shareProject.id).users.map((u) => (
                            <span
                              key={u}
                              className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1 text-sm"
                            >
                              <span className="text-slate-800">{u}</span>
                              <button
                                onClick={() => removeShareItem("users", u)}
                                className="text-slate-500 hover:text-red-600 font-bold"
                                title="Remove"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        Groups
                      </div>
                      {getProjectShares(shareProject.id).groups.length === 0 ? (
                        <div className="mt-1 text-sm text-slate-500">
                          No groups added.
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getProjectShares(shareProject.id).groups.map((g) => (
                            <span
                              key={g}
                              className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1 text-sm"
                            >
                              <span className="text-slate-800">{g}</span>
                              <button
                                onClick={() => removeShareItem("groups", g)}
                                className="text-slate-500 hover:text-red-600 font-bold"
                                title="Remove"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Next backend step: create <span className="font-semibold">groups</span>,{" "}
                  <span className="font-semibold">group_members</span> and{" "}
                  <span className="font-semibold">project_members</span> tables + endpoints.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
