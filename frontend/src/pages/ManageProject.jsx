import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

/** ---------- Security helpers ---------- */
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

export default function ManageProject() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const token = getToken();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [memberUsers, setMemberUsers] = useState({});
  const [userGroups, setUserGroups] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [groupMembers, setGroupMembers] = useState({});

  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupForUser, setSelectedGroupForUser] = useState("");
  const [selectedUserForGroup, setSelectedUserForGroup] = useState("");
  const [selectedUserForProject, setSelectedUserForProject] = useState("");
  const [shareAccessLevel, setShareAccessLevel] = useState("viewer");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupAccessLevel, setGroupAccessLevel] = useState("viewer");

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

  useEffect(() => {
    if (!token) navigate("/login");
    if (token && isTokenExpired()) safeLogout(navigate);
  }, [token, navigate]);

  async function fetchProject() {
    try {
      const res = await authFetch(`${API_BASE}/api/projects`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.detail || "Failed to load projects");

      const list = Array.isArray(data) ? data : [];
      const proj = list.find((p) => p.id === parseInt(projectId, 10));
      
      if (!proj) {
        setError("Project not found");
        return;
      }
      
      setProject(proj);
    } catch (err) {
      setError(err.message || "Failed to load project");
    }
  }

  async function loadAllUsers() {
    const res = await authFetch(`${API_BASE}/api/users`);
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.detail || "Failed to load users");
    setAllUsers(Array.isArray(data) ? data : []);
  }

  async function loadGroups() {
    const res = await authFetch(`${API_BASE}/api/groups`);
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.detail || "Failed to load groups");
    setGroups(Array.isArray(data) ? data : []);
  }

  async function loadGroupMembers() {
    const membersMap = {};
    for (const group of groups) {
      try {
        const res = await authFetch(`${API_BASE}/api/groups/${group.id}/members`);
        const data = await res.json().catch(() => []);
        if (res.ok && Array.isArray(data)) {
          membersMap[group.id] = data;
        }
      } catch {
        membersMap[group.id] = [];
      }
    }
    setGroupMembers(membersMap);
  }

  async function loadMembers() {
    const res = await authFetch(`${API_BASE}/api/projects/${projectId}/members`);
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.detail || "Failed to load members");

    const arr = Array.isArray(data) ? data : [];
    setMembers(arr);

    const usersMap = {};
    const groupsMap = {};

    for (const m of arr) {
      if (m.user && m.user_id) {
        usersMap[m.user_id] = {
          ...m.user,
          role: m.user.role_name,
        };
        groupsMap[m.user_id] = m.user.groups || [];
      }
    }

    setMemberUsers(usersMap);
    setUserGroups(groupsMap);
  }

  useEffect(() => {
    if (!projectId) {
      navigate("/projects");
      return;
    }

    async function init() {
      setLoading(true);
      setError("");
      try {
        await fetchProject();
        await loadAllUsers();
        await loadGroups();
        await loadMembers();
      } catch (e) {
        setError(e?.message || "Failed to load project data");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [projectId]);

  useEffect(() => {
    if (groups.length > 0) {
      loadGroupMembers();
    }
  }, [groups]);

  async function createGroup(e) {
    e.preventDefault();
    setError("");
    const name = newGroupName.trim();
    if (!name) return;

    setLoading(true);
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
      if (data?.id) setSelectedGroupForUser(String(data.id));
    } catch (e) {
      setError(e?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  async function addUserToGroup(e) {
    e.preventDefault();
    if (!selectedGroupForUser || !selectedUserForGroup) {
      setError("Please select both a group and a user");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await authFetch(
        `${API_BASE}/api/groups/${selectedGroupForUser}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: parseInt(selectedUserForGroup, 10) }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.[0]?.msg || "Failed to add user to group";
        throw new Error(msg);
      }

      setSelectedUserForGroup("");
      await loadGroupMembers();
    } catch (e) {
      setError(e?.message || "Failed to add user to group");
    } finally {
      setLoading(false);
    }
  }

  async function removeUserFromGroup(groupId, userId) {
    setLoading(true);
    setError("");

    try {
      const res = await authFetch(
        `${API_BASE}/api/groups/${groupId}/members/${userId}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to remove user from group");

      await loadGroupMembers();
    } catch (e) {
      setError(e?.message || "Failed to remove user from group");
    } finally {
      setLoading(false);
    }
  }

  async function addUserMember(e) {
    e.preventDefault();
    if (!selectedUserForProject) {
      setError("Please select a user");
      return;
    }

    const selectedUser = allUsers.find(u => u.id === parseInt(selectedUserForProject, 10));
    if (!selectedUser) {
      setError("User not found");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await authFetch(
        `${API_BASE}/api/projects/${projectId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: selectedUser.email, access_level: shareAccessLevel }),
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

      setSelectedUserForProject("");
      await loadMembers();
    } catch (e) {
      setError(e?.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  }

  async function addGroupMember(e) {
    e.preventDefault();
    if (!selectedGroupId) {
      setError("Please select a group");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await authFetch(
        `${API_BASE}/api/projects/${projectId}/groups`,
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
      await loadMembers();
    } catch (e) {
      setError(e?.message || "Failed to add group");
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(memberId) {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(
        `${API_BASE}/api/projects/${projectId}/members/${memberId}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to remove member");

      await loadMembers();
    } catch (e) {
      setError(e?.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  }

  // Derived: Users and their active project groups (direct + via active groups)
  const accessRows = useMemo(() => {
    const activeProjectGroupIds = members
      .filter((m) => Boolean(m.group_id))
      .map((m) => m.group_id);

    const usersViaActiveGroups = new Map(); // userId -> Set(groupId)
    for (const gid of activeProjectGroupIds) {
      const gm = groupMembers?.[gid] || [];
      for (const entry of gm) {
        const uid = entry.user_id;
        if (!usersViaActiveGroups.has(uid)) usersViaActiveGroups.set(uid, new Set());
        usersViaActiveGroups.get(uid).add(gid);
      }
    }

    const directUserMembers = members.filter((m) => Boolean(m.user_id));
    const allAccessUserIds = new Set([
      ...directUserMembers.map((m) => m.user_id),
      ...usersViaActiveGroups.keys(),
    ]);

    return Array.from(allAccessUserIds)
      .map((uid) => {
        const direct = directUserMembers.find((m) => m.user_id === uid);
        const viaGroupIds = Array.from(usersViaActiveGroups.get(uid) || []);
        const viaGroups = viaGroupIds
          .map((gid) => groups.find((g) => g.id === gid))
          .filter(Boolean);
        const user =
          allUsers.find((u) => u.id === uid) ||
          memberUsers?.[uid] ||
          {};
        return {
          uid,
          user,
          directAccessLevel: direct?.access_level || null,
          viaGroups,
        };
      })
      .sort((a, b) => {
        const an = (a.user?.name || a.user?.email || "").toLowerCase();
        const bn = (b.user?.name || b.user?.email || "").toLowerCase();
        return an.localeCompare(bn);
      });
  }, [members, groupMembers, groups, allUsers, memberUsers]);

  if (loading && !project) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 to-white px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center text-slate-600">Loading project...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 to-white px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-500">
                Manage Project
              </div>
              <h1 className="text-2xl font-bold text-slate-900 truncate mt-1">
                {project?.name || "Unknown Project"}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Add users and groups, control viewer/editor access.
              </p>
            </div>

            <button
              onClick={() => navigate("/projects")}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-black"
            >
              Back to Projects
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold">1</span>
                <h2 className="text-lg font-bold text-slate-900">Create Group</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Create a new group to organize users.
              </p>

              <form onSubmit={createGroup} className="mt-4 space-y-3">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="e.g. QA Team"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={loading || !newGroupName.trim()}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
                >
                  Create Group
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold">2</span>
                <h2 className="text-lg font-bold text-slate-900">Add Users to Group</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Select a group and add users to it.
              </p>

              <form onSubmit={addUserToGroup} className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Select Group
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                    value={selectedGroupForUser}
                    onChange={(e) => setSelectedGroupForUser(e.target.value)}
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
                  <label className="text-sm font-semibold text-slate-800">
                    Select User
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                    value={selectedUserForGroup}
                    onChange={(e) => setSelectedUserForGroup(e.target.value)}
                  >
                    <option value="">Select user…</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedGroupForUser || !selectedUserForGroup}
                  className="w-full rounded-lg bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800 disabled:opacity-60"
                >
                  Add User to Group
                </button>
              </form>

              {selectedGroupForUser && groupMembers[selectedGroupForUser]?.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="text-sm font-semibold text-slate-800 mb-2">
                    Current members:
                  </div>
                  <div className="space-y-2">
                    {groupMembers[selectedGroupForUser].map((member) => {
                      const user = allUsers.find((u) => u.id === member.user_id);
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">
                            {user?.name || user?.email || `User ${member.user_id}`}
                          </span>
                          <button
                            onClick={() => removeUserFromGroup(selectedGroupForUser, member.user_id)}
                            disabled={loading}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold">3</span>
                <h2 className="text-lg font-bold text-slate-900">Add User to Project</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Add individual users to the project, remove them from the list.
              </p>

              <form onSubmit={addUserMember} className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Select User
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                    value={selectedUserForProject}
                    onChange={(e) => setSelectedUserForProject(e.target.value)}
                  >
                    <option value="">Select user…</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Access Level
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                    value={shareAccessLevel}
                    onChange={(e) => setShareAccessLevel(e.target.value)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedUserForProject}
                  className="w-full rounded-lg bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800 disabled:opacity-60"
                >
                  Add User
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-700 text-white text-xs font-bold">4</span>
                <h2 className="text-lg font-bold text-slate-900">Add Group to Project</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Share project access with an entire group.
              </p>

              <form onSubmit={addGroupMember} className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Select Group
                  </label>
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
                  <label className="text-sm font-semibold text-slate-800">
                    Access Level
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                    value={groupAccessLevel}
                    onChange={(e) => setGroupAccessLevel(e.target.value)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedGroupId}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-60"
                >
                  Add Group
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Current Access</h2>
              <p className="text-sm text-slate-600 mt-1">
                All users and groups with access to this project
              </p>
            </div>

            <div className="p-6">
              {loading && members.length === 0 ? (
                <div className="text-sm text-slate-500">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="text-sm text-slate-500">No members or groups shared yet.</div>
              ) : (
                <div className="space-y-6">
                  {/* Users x Active Groups Summary */}
                  {accessRows.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                        📋 Users and Active Groups ({accessRows.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-slate-200 rounded-lg bg-white">
                          <thead className="bg-slate-100 text-xs text-slate-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">User</th>
                              <th className="px-3 py-2 text-left font-semibold">Direct Access</th>
                              <th className="px-3 py-2 text-left font-semibold">Active Groups</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-sm">
                            {accessRows.map((row) => (
                              <tr key={row.uid} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-slate-900">{row.user?.name || row.user?.email || `User ${row.uid}`}</div>
                                  <div className="text-xs text-slate-600">{row.user?.email || "—"}</div>
                                </td>
                                <td className="px-3 py-2">
                                  {row.directAccessLevel ? (
                                    <span className={
                                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border " +
                                      (row.directAccessLevel === "editor"
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200")
                                    }>
                                      {row.directAccessLevel}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-500">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {row.viaGroups.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {row.viaGroups.map((g) => (
                                        <span key={g.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-200">
                                          {g.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500">No active groups</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Users Section */}
                  {members.some(m => Boolean(m.user_id)) && (
                    <div>
                      <div className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                        👤 Users ({members.filter(m => Boolean(m.user_id)).length})
                      </div>
                      <div className="space-y-3">
                        {members.filter(m => Boolean(m.user_id)).map((m) => {
                          const groupsForUser =
                            userGroups?.[m.user_id]
                              ? userGroups[m.user_id]
                              : [];

                          return (
                            <div key={m.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-900">
                                    {memberUsers[m.user_id]?.name || m.user?.name || "—"}
                                  </div>
                                  <div className="text-sm text-slate-600">
                                    {memberUsers[m.user_id]?.email || m.user?.email || "—"}
                                  </div>
                                </div>
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
                              </div>

                              <div className="text-xs text-slate-600 mb-2">
                                <span className="font-semibold">Role:</span> {memberUsers[m.user_id]?.role || m.user?.role_name || "User"}
                              </div>

                              <div className="mb-3">
                                <div className="text-xs font-semibold text-slate-700 mb-2">Groups:</div>
                                {groupsForUser.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {groupsForUser.map((g) => (
                                      <span key={g.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-200">
                                        {g.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 italic">Not member of any group</div>
                                )}
                              </div>

                              <div className="flex justify-end">
                                <button
                                  onClick={() => removeMember(m.id)}
                                  disabled={loading}
                                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Groups Section */}
                  {members.some(m => Boolean(m.group_id || m.group_name)) && (
                    <div>
                      <div className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                        👥 Groups ({members.filter(m => Boolean(m.group_id || m.group_name)).length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-slate-200 rounded-lg bg-white">
                          <thead className="bg-slate-100 text-xs text-slate-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Group Name</th>
                              <th className="px-3 py-2 text-left font-semibold">Members</th>
                              <th className="px-3 py-2 text-left font-semibold">Access</th>
                              <th className="px-3 py-2 text-right font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-sm">
                            {members.filter(m => Boolean(m.group_id || m.group_name)).map((m) => {
                              const groupName = m.group?.name || m.group_name || `Group ${m.group_id}`;
                              const groupMemberCount = groupMembers[m.group_id]?.length || 0;

                              return (
                                <tr key={m.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-semibold text-slate-800">
                                    {groupName}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {groupMemberCount} member{groupMemberCount !== 1 ? 's' : ''}
                                  </td>
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
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => removeMember(m.id)}
                                      disabled={loading}
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
