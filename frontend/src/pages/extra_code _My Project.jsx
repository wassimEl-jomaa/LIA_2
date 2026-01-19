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
  if (!exp) return false;
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
  const [memberUsers, setMemberUsers] = useState({});
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

  /** ---------- Share modal state (backend-based) ---------- */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProject, setShareProject] = useState(null);

  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");

  // members of selected project (from backend)
  const [members, setMembers] = useState([]); // [{id, user_id, user_email?, group_id?, group_name?, access_level}]

  // groups list (from backend)
  const [groups, setGroups] = useState([]); // [{id, name}]

  // add user to project
  const [shareUserEmail, setShareUserEmail] = useState("");
  const [shareAccessLevel, setShareAccessLevel] = useState("viewer"); // viewer | editor

  // add group to project
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupAccessLevel, setGroupAccessLevel] = useState("viewer");

  // create group
  const [newGroupName, setNewGroupName] = useState("");

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
      // ignore
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

  /** ---------- Share modal functions (backend) ---------- */
  async function loadGroups() {
    const res = await authFetch(`${API_BASE}/api/groups`);
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.detail || "Failed to load groups");
    setGroups(Array.isArray(data) ? data : []);
  }

  async function loadMembers(projectId) {
  const res = await authFetch(`${API_BASE}/api/projects/${projectId}/members`);

  // Read response safely (might not be JSON on errors)
  let data = [];
  try {
    data = await res.json();
  } catch {
    data = [];
  }

  if (!res.ok) {
    const msg = data?.detail || "Failed to load members";
    throw new Error(msg);
  }

  const list = Array.isArray(data) ? data : [];
  setMembers(list);

  // Collect user ids that we actually need to fetch
  // (skip if backend already returns user_email / group_name)
  const userIds = [
    ...new Set(
      list
        .filter((m) => m.user_id && !m.user_email) // only fetch if we don't already have email
        .map((m) => m.user_id)
    ),
  ];

  if (userIds.length === 0) {
    setMemberUsers({});
    return;
  }

  // Fetch users in parallel
  const results = await Promise.all(
    userIds.map(async (id) => {
      try {
        const userRes = await authFetch(`${API_BASE}/api/users/${id}`);
        const userData = await userRes.json().catch(() => null);
        if (!userRes.ok || !userData) return null;
        return [id, userData];
      } catch (e) {
        console.error(`Failed to fetch user ${id}`);
        return null;
      }
    })
  );

  // Build map { userId: userData }
  const usersMap = {};
  for (const item of results) {
    if (!item) continue;
    const [id, userData] = item;
    usersMap[id] = userData;
  }

  setMemberUsers(usersMap);
}

  async function openShareModal(project) {
    setShareProject(project);
    setShareOpen(true);
    setShareError("");
    setMembers([]);
    setGroups([]);
    setShareUserEmail("");
    setShareAccessLevel("viewer");
    setSelectedGroupId("");
    setGroupAccessLevel("viewer");
    setNewGroupName("");

    setShareLoading(true);
    try {
      await Promise.all([loadGroups(), loadMembers(project.id)]);
    } catch (e) {
      setShareError(e?.message || "Failed to load sharing data");
    } finally {
      setShareLoading(false);
    }
  }

  async function createGroup() {
    setShareError("");
    const name = newGroupName.trim();
    if (!name) return;

    setShareLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to create group");

      setNewGroupName("");
      await loadGroups();
      // Auto-select new group
      if (data?.id) setSelectedGroupId(String(data.id));
    } catch (e) {
      setShareError(e?.message || "Failed to create group");
    } finally {
      setShareLoading(false);
    }
  }

 async function addUserMember() {
  if (!shareUserEmail.trim()) {
    setShareError("Email is required");
    return;
  }

  setShareLoading(true);
  setShareError("");

  try {
    const res = await authFetch(
      `${API_BASE}/api/projects/${shareProject.id}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: shareUserEmail.trim().toLowerCase(),
          access_level: shareAccessLevel,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = 
        typeof data.detail === "string" 
          ? data.detail 
          : data.detail?.[0]?.msg || "Failed to add member";
      setShareError(errorMsg);
      return;
    }

    setMembers([...members, data]);
    setShareUserEmail("");
    setShareError("");
  } catch (err) {
    setShareError(err.message || "Failed to add member");
  } finally {
    setShareLoading(false);
  }
}

// ← ADD THIS FUNCTION
async function addGroupMember() {
  if (!selectedGroupId) {
    setShareError("Please select a group");
    return;
  }

  setShareLoading(true);
  setShareError("");

  try {
    const res = await authFetch(
      `${API_BASE}/api/projects/${shareProject.id}/groups`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: parseInt(selectedGroupId),
          access_level: groupAccessLevel,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = 
        typeof data.detail === "string" 
          ? data.detail 
          : data.detail?.[0]?.msg || "Failed to add group";
      setShareError(errorMsg);
      return;
    }

    setMembers([...members, data]);
    setSelectedGroupId("");
    setShareError("");
  } catch (err) {
    setShareError(err.message || "Failed to add group");
  } finally {
    setShareLoading(false);
  }
}

  async function removeMember(memberId) {
    if (!shareProject) return;
    setShareError("");

    setShareLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE}/api/projects/${shareProject.id}/members/${memberId}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to remove member");

      await loadMembers(shareProject.id);
    } catch (e) {
      setShareError(e?.message || "Failed to remove member");
    } finally {
      setShareLoading(false);
    }
  }

  function memberLabel(m) {
  // If we have user data fetched, show name + email
  if (m.user_id && memberUsers[m.user_id]) {
    const user = memberUsers[m.user_id];
    return `${user.name || user.email}`;
  }
  // Fallback to email if backend returned it
  if (m.user_email) return `${m.user_email}`;
  // Groups
  if (m.group_name) return `Group: ${m.group_name}`;
  // Fallbacks for IDs
  if (m.user_id) return `User ID: ${m.user_id}`;
  if (m.group_id) return `Group ID: ${m.group_id}`;
  return "Member";
}

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
                Sharing
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Share projects with users and groups (backend).
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

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
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          id: {p.id} • created: {p.created_at}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openShareModal(p)}
                          className="rounded-lg bg-white px-3 py-2 text-slate-800 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
                          title="Share this project with users/groups"
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
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-500">
                    Share Project
                  </div>
                  <div className="text-lg font-bold text-slate-900 truncate">
                    {shareProject.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Add users or groups and set access level.
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
                {shareError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {shareError}
                  </div>
                )}

                {shareLoading && (
                  <div className="text-sm text-slate-600">Loading…</div>
                )}

                {/* Create group */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    Create group
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. QA Team"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <button
                      onClick={createGroup}
                      disabled={shareLoading || !newGroupName.trim()}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
                    >
                      Create
                    </button>
                  </div>
                </div>

                {/* Add user */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <div className="text-sm font-semibold text-slate-800">
                      Add user by email
                    </div>
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="user@email.com"
                      value={shareUserEmail}
                      onChange={(e) => setShareUserEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Access
                    </div>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      value={shareAccessLevel}
                      onChange={(e) => setShareAccessLevel(e.target.value)}
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button
                      onClick={addUserMember}
                      disabled={shareLoading || !shareUserEmail.trim()}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800 disabled:opacity-60"
                    >
                      Add User
                    </button>
                  </div>
                </div>

                {/* Add group */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <div className="text-sm font-semibold text-slate-800">
                      Add group
                    </div>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                      <option value="">Select group…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={String(g.id)}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Access
                    </div>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      value={groupAccessLevel}
                      onChange={(e) => setGroupAccessLevel(e.target.value)}
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button
                      onClick={addGroupMember}
                      disabled={shareLoading || !selectedGroupId}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
                    >
                      Add Group
                    </button>
                  </div>
                </div>

                {/* Current members */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    Current access
                  </div>

                  {members.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-500">
                      No members shared yet.
                    </div>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-200">
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="py-2 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">
                              {memberLabel(m)}
                            </div>
                            <div className="text-xs text-slate-500">
                              access:{" "}
                              <span className="font-semibold">
                                {m.access_level || "viewer"}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => removeMember(m.id)}
                            disabled={shareLoading}
                            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-60"
                            title="Remove access"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="text-xs text-slate-500">
                  Backend required: groups, group_members and project_members endpoints.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
