import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CreateProject() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectOrganization, setProjectOrganization] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:8000/api/organizations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setOrganizations(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch organizations:", err);
      } finally {
        setLoadingOrgs(false);
      }
    }

    fetchOrganizations();
  }, []);

  async function createProject(e) {
    e.preventDefault();
    if (!projectName.trim()) return;

    setError("");
    setCreating(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || null,
          organization: projectOrganization.trim() || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to create project");
      }

      const data = await res.json();
      
      // Navigate to the newly created project
      navigate(`/projects/${data.id}`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create New Project</h1>
            <p className="text-sm text-slate-600 mt-1">Set up a new project to start testing</p>
          </div>
          <button
            onClick={() => navigate("/projects")}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
          >
            Back to Projects
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Project Details</h2>
            <p className="text-sm text-slate-600 mt-1">
              Provide information about your project. Only the name is required.
            </p>
          </div>

          <form onSubmit={createProject} className="space-y-6">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Customer Portal QA"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500 mt-2">
                Use a clear, descriptive name for easy identification
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Brief description of the project purpose and scope..."
                rows={4}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-2">
                Add context about the project to help team members understand its purpose
              </p>
            </div>

            {/* Organization */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Organization <span className="text-slate-400">(optional)</span>
              </label>
              {loadingOrgs ? (
                <div className="w-full rounded-lg border border-slate-300 px-4 py-3 bg-slate-50 text-slate-500 text-sm">
                  Loading organizations...
                </div>
              ) : (
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  value={projectOrganization}
                  onChange={(e) => setProjectOrganization(e.target.value)}
                >
                  <option value="">Select an organization...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.name}>
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Select the organization or client this project belongs to
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={creating || !projectName.trim()}
                className="flex-1 rounded-lg bg-blue-700 px-6 py-3 text-white font-semibold hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {creating ? "Creating Project..." : "Create Project"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="rounded-lg bg-white px-6 py-3 text-slate-700 font-semibold border border-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Tips */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700 mb-1">💡 Naming Tips</div>
            <div className="text-xs text-slate-600">
              Use clear names like "Customer A – QA" or "E-commerce Platform Testing"
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700 mb-1">🔐 Access Control</div>
            <div className="text-xs text-slate-600">
              After creation, you can add team members and configure access levels
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
