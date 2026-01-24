import { useEffect, useMemo, useRef, useState } from "react";
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

  // user
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // projects
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(
    Number(localStorage.getItem("active_project_id")) || null
  );

  // ui
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("created_desc"); // created_desc | created_asc | name_asc | name_desc

  // manage modal
  const [manageOpen, setManageOpen] = useState(false);
  const [manageProject, setManageProject] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState("");

  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [memberUsers, setMemberUsers] = useState({}); // map user_id -> user object

  // add user
  const [shareUserEmail, setShareUserEmail] = useState("");
  const [shareAccessLevel, setShareAccessLevel] = useState("viewer");

  // add group
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupAccessLevel, setGroupAccessLevel] = useState("viewer");
  // user groups cache
  const [userGroups, setUserGroups] = useState({}); // { [userId]: [{id,name}, ...] }
  // create group
  const [newGroupName, setNewGroupName] = useState("");
 
  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === "name_asc") {
      return (a.name || "").localeCompare(b.name || "");
    }
    if (sortBy === "name_desc") {
      return (b.name || "").localeCompare(a.name || "");
    }
    const ad = new Date(a.created_at || 0).getTime();
    const bd = new Date(b.created_at || 0).getTime();
    if (sortBy === "created_asc") return ad - bd;
    return bd - ad; // created_desc default
  });

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

  /** ---------- Load me + projects ---------- */
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

      const list = Array.isArray(data) ? data : [];
      setProjects(list);

      if (!activeProjectId && list.length > 0) {
        const firstId = list[0].id;
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

  /** ---------- Open project ---------- */
  function openProject(id) {
    setActiveProjectId(id);
    localStorage.setItem("active_project_id", String(id));
    navigate(`/projects/${id}`);
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);

  /** ---------- Manage/Share (backend) ---------- */
  async function loadGroups() {
    const res = await authFetch(`${API_BASE}/api/groups`);
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.detail || "Failed to load groups");
    setGroups(Array.isArray(data) ? data : []);
  }

  async function loadMembers(projectId) {
  const res = await authFetch(`${API_BASE}/api/projects/${projectId}/members`);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.detail || "Failed to load members");

  const arr = Array.isArray(data) ? data : [];
  setMembers(arr);

  // Extract user data from the members response (already includes role_name and groups)
  const usersMap = {};
  const groupsMap = {};

  for (const m of arr) {
    if (m.user && m.user_id) {
      usersMap[m.user_id] = {
        ...m.user,
        role: m.user.role_name, // Add role field for compatibility
      };
      groupsMap[m.user_id] = m.user.groups || [];
    }
  }

  setMemberUsers(usersMap);
  setUserGroups(groupsMap);
}


  function memberLabel(m) {
  // User member
  if (m.user_id) {
    const u = memberUsers[m.user_id];
    return u?.name || u?.email || m.user_email || `User ID: ${m.user_id}`;
  }

  // Group member (project shared with a group)
  if (m.group_name) return `Group: ${m.group_name}`;
  if (m.group_id) return `Group ID: ${m.group_id}`;

  return "Member";
}


  async function openManage(project) {
    setManageProject(project);
    setManageOpen(true);
    setManageError("");
    setMembers([]);
    setGroups([]);
    setMemberUsers({});

    setShareUserEmail("");
    setShareAccessLevel("viewer");

    setSelectedGroupId("");
    setGroupAccessLevel("viewer");

    setNewGroupName("");

    setManageLoading(true);
    try {
      await Promise.all([loadGroups(), loadMembers(project.id)]);
    } catch (e) {
      setManageError(e?.message || "Failed to load project access");
    } finally {
      setManageLoading(false);
    }
  }

  async function createGroup() {
    setManageError("");
    const name = newGroupName.trim();
    if (!name) return;

    setManageLoading(true);
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
      if (data?.id) setSelectedGroupId(String(data.id));
    } catch (e) {
      setManageError(e?.message || "Failed to create group");
    } finally {
      setManageLoading(false);
    }
  }

  async function addUserMember() {
    if (!manageProject) return;
    const email = shareUserEmail.trim();
    if (!email) {
      setManageError("Email is required");
      return;
    }

    setManageLoading(true);
    setManageError("");

    try {
      const res = await authFetch(
        `${API_BASE}/api/projects/${manageProject.id}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, access_level: shareAccessLevel }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.[0]?.msg || "Failed to add member";
        throw new Error(msg);
      }

      setShareUserEmail("");
      await loadMembers(manageProject.id);
    } catch (e) {
      setManageError(e?.message || "Failed to add member");
    } finally {
      setManageLoading(false);
    }
  }

  async function addGroupMember() {
    if (!manageProject) return;
    if (!selectedGroupId) {
      setManageError("Please select a group");
      return;
    }

    setManageLoading(true);
    setManageError("");

    try {
      const res = await authFetch(
        `${API_BASE}/api/projects/${manageProject.id}/groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_id: parseInt(selectedGroupId, 10),
            access_level: groupAccessLevel,
          }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.[0]?.msg || "Failed to add group";
        throw new Error(msg);
      }

      setSelectedGroupId("");
      await loadMembers(manageProject.id);
    } catch (e) {
      setManageError(e?.message || "Failed to add group");
    } finally {
      setManageLoading(false);
    }
  }

  async function removeMember(memberId) {
    if (!manageProject) return;

    setManageLoading(true);
    setManageError("");
    try {
      const res = await authFetch(
        `${API_BASE}/api/projects/${manageProject.id}/members/${memberId}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to remove member");

      await loadMembers(manageProject.id);
    } catch (e) {
      setManageError(e?.message || "Failed to remove member");
    } finally {
      setManageLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 to-white px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 truncate">
                My Projects
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Create and manage projects. Share access with users and groups.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-sm">
                <span className="font-semibold text-slate-800">
                  {userName ? `Hi, ${userName}` : "Hi"}
                </span>
                {userEmail && <span className="text-slate-600">• {userEmail}</span>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Refresh */}
              <button
                onClick={fetchProjects}
                className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                Refresh
              </button>

              {/* New Project CTA */}
              <button
                onClick={() => navigate("/projects/new")}
                className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
              >
                New Project
              </button>

              {/* Logout */}
              <button
                onClick={() => safeLogout(navigate)}
                className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-black"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Active Project</div>
              <div className="mt-1 font-bold text-slate-900 truncate">
                {activeProject ? activeProject.name : "None selected"}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                project_id: <span className="font-semibold">{activeProjectId ?? "—"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Manage your project</div>
              <div className="mt-1 text-sm text-slate-700">
                Add users/groups and control viewer/editor access.
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Projects List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">Projects</div>
                <div className="text-xs text-slate-500">
                  Buttons: Manage your project • Share • Open
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500">
                  Total: <span className="font-semibold">{sortedProjects.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600">Sort</label>
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="created_desc">Newest</option>
                    <option value="created_asc">Oldest</option>
                    <option value="name_asc">Name A→Z</option>
                    <option value="name_desc">Name Z→A</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="h-4 w-2/3 bg-slate-200 rounded" />
                    <div className="mt-2 h-3 w-1/2 bg-slate-200 rounded" />
                    <div className="mt-4 h-8 w-full bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : sortedProjects.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No projects found.</div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedProjects.map((p) => {
                  const isActive = p.id === activeProjectId;
                  return (
                    <div key={p.id} className="rounded-xl border border-slate-200 bg-white hover:shadow-sm transition p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            id: {p.id} • created: {p.created_at}
                          </div>
                        </div>
                        {isActive && (
                          <span className="text-xs font-semibold rounded-full bg-green-100 text-green-700 px-2 py-0.5">Active</span>
                        )}
                      </div>

                      {p.organization_id && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-slate-700">Org ID:</span>
                          <span className="text-xs text-slate-600 ml-1">{p.organization_id}</span>
                        </div>
                      )}

                      {p.description && (
                        <div className="mb-3">
                          <p className="text-xs text-slate-600">{p.description}</p>
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/projects/${p.id}/manage`)}
                          className="rounded-lg bg-white px-3 py-2 text-slate-800 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => openProject(p.id)}
                          className={
                            isActive
                              ? "rounded-lg bg-green-600 px-3 py-2 text-white text-sm font-semibold"
                              : "rounded-lg bg-blue-700 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-800"
                          }
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Manage modal */}
        {manageOpen && manageProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-500">
                    Manage your project
                  </div>
                  <div className="text-lg font-bold text-slate-900 truncate">
                    {manageProject.name}
                  </div>
                </div>
                <button
                  onClick={() => setManageOpen(false)}
                  className="rounded-lg bg-white px-3 py-2 text-slate-800 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="p-5 space-y-5">
                {manageError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {manageError}
                  </div>
                )}

                {manageLoading && <div className="text-sm text-slate-600">Loading…</div>}

                {/* Create group */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Create group</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. QA Team"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <button
                      onClick={createGroup}
                      disabled={manageLoading || !newGroupName.trim()}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
                    >
                      Create
                    </button>
                  </div>
                </div>

                {/* Add user */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <div className="text-sm font-semibold text-slate-800">Add user</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="user@email.com"
                      value={shareUserEmail}
                      onChange={(e) => setShareUserEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Access</div>
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
                      disabled={manageLoading || !shareUserEmail.trim()}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800 disabled:opacity-60"
                    >
                      Share (add user)
                    </button>
                  </div>
                </div>

                {/* Add group */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <div className="text-sm font-semibold text-slate-800">Add group</div>
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
                    <div className="text-sm font-semibold text-slate-800">Access</div>
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
                      disabled={manageLoading || !selectedGroupId}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
                    >
                      Share (add group)
                    </button>
                  </div>
                </div>

                {/* Current members */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800 mb-3">
                    Current access
                  </div>

                  {members.length === 0 ? (
                    <div className="text-sm text-slate-500">No members shared yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-slate-200 rounded-lg bg-white">
                        <thead className="bg-slate-100 text-xs text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Name</th>
                            <th className="px-3 py-2 text-left font-semibold">Type</th>
                            <th className="px-3 py-2 text-left font-semibold">Groups</th>
                            <th className="px-3 py-2 text-left font-semibold">Access</th>
                            <th className="px-3 py-2 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200 text-sm">
                          {members.map((m) => {
                            const isUser = Boolean(m.user_id);
                            const isGroup = Boolean(m.group_id || m.group_name);

                            const groupsForUser =
                              isUser && userGroups?.[m.user_id]
                                ? userGroups[m.user_id].map((g) => g.name).join(", ")
                                : "—";

                            return (
                              <tr key={m.id} className="hover:bg-slate-50">
                                {/* Name */}
                                <td className="px-3 py-2 font-semibold text-slate-800">
                                  {isUser ? (
                                    memberUsers[m.user_id]?.name || 
                                    memberUsers[m.user_id]?.email || 
                                    m.user?.name || 
                                    m.user?.email || 
                                    `User ID: ${m.user_id}`
                                  ) : isGroup ? (
                                    m.group?.name || m.group_name || `Group ${m.group_id}`
                                  ) : (
                                    "Member"
                                  )}
                                </td>

                                {/* Type */}
                                <td className="px-3 py-2">
                                  {isUser ? (
                                    memberUsers[m.user_id]?.role || 
                                    m.user?.role_name || 
                                    "User"
                                  ) : (
                                    "Group"
                                  )}
                                </td>

                                {/* Groups */}
                                <td className="px-3 py-2 text-slate-600">
                                  {isUser ? (
                                    groupsForUser || "—"
                                  ) : isGroup ? (
                                    m.group_name || `Group ${m.group_id}`
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                {/* Access */}
                                <td className="px-3 py-2">
                                  <span
                                    className={
                                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border " +
                                      (m.access_level === "editor"
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200")
                                    }
                                  >
                                    {m.access_level || "viewer"}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => removeMember(m.id)}
                                    disabled={manageLoading}
                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-60"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>



                <div className="text-xs text-slate-500">
                  Tip: “Manage your project” and “Share” open the same panel (you can keep both
                  buttons or remove one later).
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
