import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Vite-safe base (and avoids hardcoding)
const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("token");
}

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data?.detail
        ? typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail)
        : text || "Request failed";
    throw new Error(msg);
  }

  return data;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function safeName(v) {
  const s = (v ?? "").toString().trim();
  return s || "—";
}

function Badge({ children, tone = "slate" }) {
  const base = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border";
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return <span className={`${base} ${tones[tone] || tones.slate}`}>{children}</span>;
}

export default function SelectedProject() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);

  const [loadingProject, setLoadingProject] = useState(true);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Requirements state
  const [requirements, setRequirements] = useState([]);
  const [loadingRequirements, setLoadingRequirements] = useState(true);
  const [requirementsError, setRequirementsError] = useState("");

  const [error, setError] = useState("");

  // small UX add-ons
  const [reqQuery, setReqQuery] = useState("");
  const [reqSort, setReqSort] = useState("newest"); // newest | oldest | title

  // If not logged in -> go login
  useEffect(() => {
    if (!getToken()) navigate("/login");
  }, [navigate]);

  async function loadProject() {
    setError("");
    setLoadingProject(true);

    try {
      const items = await apiFetch(`/api/projects`);
      const found = (items || []).find((p) => String(p.id) === String(projectId));
      if (!found) throw new Error("Project not found");

      setProject(found);
      localStorage.setItem("active_project_id", String(found.id));
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoadingProject(false);
    }
  }

  async function loadProjectMembers() {
    setLoadingMembers(true);
    try {
      const data = await apiFetch(`/api/projects/${projectId}/members`);
      setProjectMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("SelectedProject: members load error", err);
    } finally {
      setLoadingMembers(false);
    }
  }

  // Load requirements
  async function loadRequirements() {
    setRequirementsError("");
    setLoadingRequirements(true);
    try {
      const data = await apiFetch(`/api/requirements?project_id=${projectId}&limit=200`);
      setRequirements(Array.isArray(data) ? data : []);
    } catch (err) {
      setRequirementsError(err?.message || "Failed to load requirements");
      setRequirements([]);
    } finally {
      setLoadingRequirements(false);
    }
  }

  useEffect(() => {
    loadProject();
    loadProjectMembers();
    loadRequirements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const requirementsCount = useMemo(() => requirements.length, [requirements]);

  const filteredRequirements = useMemo(() => {
    const q = reqQuery.trim().toLowerCase();
    let list = Array.isArray(requirements) ? [...requirements] : [];

    if (q) {
      list = list.filter((r) => {
        const hay = `${r.title || ""} ${r.created_by_name || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const asTime = (v) => {
      const d = new Date(v);
      const t = d.getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    if (reqSort === "oldest") {
      list.sort((a, b) => asTime(a.created_at) - asTime(b.created_at));
    } else if (reqSort === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else {
      list.sort((a, b) => asTime(b.created_at) - asTime(a.created_at));
    }

    return list;
  }, [requirements, reqQuery, reqSort]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_86%_0%,rgba(16,185,129,0.10),transparent_35%)]" />
          <div className="relative p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                {loadingProject ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-8 bg-slate-200 rounded w-64" />
                    <div className="h-4 bg-slate-200 rounded w-96" />
                  </div>
                ) : project ? (
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge tone="blue">Project ID: {project.id}</Badge>
                      <Badge tone="slate">Created: {formatDate(project.created_at)}</Badge>
                      {project.organization_id && <Badge tone="purple">Org ID: {project.organization_id}</Badge>}
                      <Badge tone="green">Requirements: {requirementsCount}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-600">Project not found</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => navigate("/projects")}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                >
                  ← Back
                </button>

                {project && (
                  <>
                    <button
                      onClick={() => navigate("/testcases")}
                      className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
                    >
                      Generate Test Cases
                    </button>
                    <button
                      onClick={() => navigate(`/projects/${projectId}/testcases`)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 shadow-sm"
                    >
                      Manage Test Cases →
                    </button>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Requirements card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Requirements (Krav / User stories)</div>
              <div className="text-xs text-slate-500">All saved requirements for this project</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex items-center gap-2">
                <input
                  value={reqQuery}
                  onChange={(e) => setReqQuery(e.target.value)}
                  placeholder="Search title or creator…"
                  className="w-full sm:w-72 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <select
                  value={reqSort}
                  onChange={(e) => setReqSort(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  title="Sort"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="title">Title</option>
                </select>
              </div>

              <button
                onClick={loadRequirements}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {loadingRequirements ? (
            <div className="p-6">
              <div className="grid gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="h-4 w-2/3 bg-slate-200 rounded" />
                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : requirementsError ? (
            <div className="p-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {requirementsError}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Backend must provide:{" "}
                <code className="font-mono">GET /api/requirements?project_id=...&limit=...</code>{" "}
                returning requirement + created_by user name.
              </div>
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No requirements found{reqQuery ? " for this search." : " yet."}
            </div>
          ) : (
            <div className="p-6">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">ID</th>
                      <th className="px-4 py-3 text-left font-semibold">Title</th>
                      <th className="px-4 py-3 text-left font-semibold">Created</th>
                      <th className="px-4 py-3 text-left font-semibold">Created by</th>
                      <th className="px-4 py-3 text-right font-semibold">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredRequirements.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 align-top">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {r.title || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {safeName(r.created_by_name ?? r.creator_name ?? r.created_by ?? r.user_name)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/projects/${projectId}/testcases`, {
                                state: { requirementId: r.id },
                              })
                            }
                            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                            title="Manage test cases for this requirement"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredRequirements.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="slate">ID {r.id}</Badge>
                          <Badge tone="green">{formatDate(r.created_at)}</Badge>
                        </div>
                        <div className="mt-2 font-semibold text-slate-900 break-words">
                          {r.title || "—"}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Created by:{" "}
                          <span className="font-semibold">
                            {safeName(r.created_by_name ?? r.creator_name ?? r.created_by ?? r.user_name)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${projectId}/testcases?requirementId=${r.id}`)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                        title="Manage test cases for this requirement"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Tip: Requirements are created automatically when you click <b>Generate</b> in the Test Cases page.
              </div>
            </div>
          )}
        </div>

        {/* Project Access card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Project Access</div>
              <div className="text-xs text-slate-500">Groups shared with this project</div>
            </div>
            <div className="text-xs text-slate-500">
              Total groups:{" "}
              <span className="font-semibold">
                {projectMembers.filter((m) => Boolean(m.group_id || m.group_name)).length}
              </span>
            </div>
          </div>

          {loadingMembers ? (
            <div className="p-6 text-sm text-slate-500">Loading access…</div>
          ) : (
            <div className="p-6">
              {projectMembers.some((m) => Boolean(m.group_id || m.group_name)) ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Group</th>
                        <th className="px-4 py-3 text-left font-semibold">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {projectMembers
                        .filter((m) => Boolean(m.group_id || m.group_name))
                        .map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {m.group?.name || m.group_name || `Group ${m.group_id}`}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={
                                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border " +
                                  (m.access_level === "editor"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200")
                                }
                              >
                                {m.access_level || "viewer"}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No groups shared yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
