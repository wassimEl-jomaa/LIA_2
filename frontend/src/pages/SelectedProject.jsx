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

  const [loadingProject, setLoadingProject] = useState(true);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

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


  async function loadProjectMembers() {
    setLoadingMembers(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to load project members");
      }
      const data = await res.json();
      setProjectMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      // surface silently to keep page usable
      console.warn("SelectedProject: members load error", err);
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    loadProject();
    loadProjectMembers();
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.08),transparent_35%)]" />
          <div className="relative p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                
                
                {loadingProject ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-64"></div>
                    <div className="h-4 bg-gray-200 rounded w-96"></div>
                  </div>
                ) : project ? (
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                      {project.name}
                    </h1>
                    {project.description && (
                      <p className="text-slate-600 text-sm max-w-2xl mb-3">
                        {project.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        ID: {project.id}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Created: {new Date(project.created_at).toLocaleDateString()}
                      </span>
                      {project.organization_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Org ID: {project.organization_id}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-600">Project not found</div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => navigate("/projects")}
                  className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                >
                  ← Back
                </button>
                
                {project && (
                  <button
                    onClick={() => navigate("/testcases")}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 whitespace-nowrap shadow-sm"
                  >
                    Test Cases →
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Project Access card */}
        <div className="bg-white rounded-2xl shadow border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">Project Access</div>
              <div className="text-xs text-gray-500">Groups shared with this project</div>
            </div>
            <div className="text-xs text-gray-500">
              Total groups: <span className="font-semibold">{projectMembers.filter(m => Boolean(m.group_id || m.group_name)).length}</span>
            </div>
          </div>

          {loadingMembers ? (
            <div className="p-6 text-sm text-gray-500">Loading access…</div>
          ) : (
            <div className="p-6">
              {projectMembers.some(m => Boolean(m.group_id || m.group_name)) ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg bg-white">
                    <thead className="bg-gray-100 text-xs text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Group</th>
                        <th className="px-3 py-2 text-left font-semibold">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                      {projectMembers.filter(m => Boolean(m.group_id || m.group_name)).map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-semibold text-gray-800">{m.group?.name || m.group_name || `Group ${m.group_id}`}</td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border " +
                                (m.access_level === "editor"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-100 text-gray-700 border-gray-200")
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
                <div className="text-sm text-gray-500">No groups shared yet.</div>
              )}
            </div>
          )}
        </div>

        {/* RequestHistory removed */}
      </div>
    </div>
  );
}
