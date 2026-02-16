import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

function getToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token") || null;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
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

const COLUMNS = [
  { id: "new", title: "New", color: "bg-gray-100 border-gray-300" },
  { id: "triaged", title: "Triaged", color: "bg-blue-50 border-blue-300" },
  { id: "in_progress", title: "In Progress", color: "bg-yellow-50 border-yellow-300" },
  { id: "fixed", title: "Fixed", color: "bg-green-50 border-green-300" },
  { id: "retest_pending", title: "Retest Pending", color: "bg-purple-50 border-purple-300" },
  { id: "verified", title: "Verified", color: "bg-emerald-50 border-emerald-300" },
  { id: "reopened", title: "Reopened", color: "bg-red-50 border-red-300" },
];

const SEVERITY_COLORS = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-green-100 text-green-800 border-green-300",
};

const PRIORITY_COLORS = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-blue-100 text-blue-800",
};

export default function BugBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedBug, setDraggedBug] = useState(null);
  const [project, setProject] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Try to load project details, but don't fail if it doesn't work
      try {
        const proj = await apiFetch(`/api/projects/${projectId}`);
        setProject(proj);
      } catch (projErr) {
        console.warn("Could not load project details:", projErr);
        // Continue anyway, we can still show bugs
      }

      // Load bugs
      const bugData = await apiFetch(`/api/bug_reports?project_id=${projectId}`);
      setBugs(Array.isArray(bugData) ? bugData : []);
    } catch (err) {
      console.error("Error loading bugs:", err);
      setError(err.message || "Failed to load bugs");
    } finally {
      setLoading(false);
    }
  }

  async function updateBugStatus(bugId, newStatus, comment = null) {
    try {
      setUpdating(true);
      
      await apiFetch(`/api/bug_reports/${bugId}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: newStatus,
          comment: comment || `Status changed to ${newStatus}`,
        }),
      });

      // Update local state
      setBugs((prev) =>
        prev.map((bug) =>
          bug.id === bugId ? { ...bug, status: newStatus } : bug
        )
      );
    } catch (err) {
      console.error("Error updating bug status:", err);
      alert(`Failed to update bug status: ${err.message}`);
      // Reload to get correct state
      await loadData();
    } finally {
      setUpdating(false);
    }
  }

  function handleDragStart(e, bug) {
    setDraggedBug(bug);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("opacity-50");
  }

  function handleDragEnd(e) {
    e.currentTarget.classList.remove("opacity-50");
    setDraggedBug(null);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e, columnId) {
    e.preventDefault();
    
    if (!draggedBug) return;
    
    const newStatus = columnId;
    if (draggedBug.status !== newStatus) {
      updateBugStatus(draggedBug.id, newStatus);
    }
  }

  function getBugsByStatus(status) {
    return bugs.filter((bug) => bug.status === status);
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("sv-SE"); // YYYY-MM-DD format
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bug board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="text-gray-600 hover:text-gray-900 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Bug Board</h1>
                {project && (
                  <p className="text-sm text-gray-600">{project.name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{bugs.length}</span> total bugs
              </div>
              <button
                onClick={() => navigate(`/projects/${projectId}/bugs`)}
                className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition border border-gray-300"
              >
                📋 List View
              </button>
              <button
                onClick={() => navigate(`/projects/${projectId}/bugs/new`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm"
              >
                + New Bug
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="max-w-full px-6 py-6">
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const columnBugs = getBugsByStatus(column.id);
            
            return (
              <div
                key={column.id}
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className={`${column.color} border-2 rounded-t-lg px-4 py-3`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{column.title}</h3>
                    <span className="bg-white text-gray-700 text-sm font-semibold px-2 py-1 rounded">
                      {columnBugs.length}
                    </span>
                  </div>
                </div>

                {/* Column Content */}
                <div className="bg-gray-50 border-2 border-t-0 border-gray-200 rounded-b-lg min-h-[500px] max-h-[calc(100vh-300px)] overflow-y-auto p-3 space-y-3">
                  {columnBugs.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-8">
                      No bugs
                    </div>
                  ) : (
                    columnBugs.map((bug) => (
                      <BugCard
                        key={bug.id}
                        bug={bug}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(`/projects/${projectId}/bugs/${bug.id}`)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading Overlay */}
      {updating && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700 font-medium">Updating status...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BugCard({ bug, onDragStart, onDragEnd, onClick }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bug)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition cursor-pointer hover:border-blue-300"
    >
      {/* Bug ID and Severity */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-mono text-gray-500">#{bug.id}</span>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded ${
            SEVERITY_COLORS[bug.severity] || "bg-gray-100 text-gray-800"
          }`}
        >
          {bug.severity?.toUpperCase()}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm">
        {bug.title}
      </h4>

      {/* Priority */}
      <div className="flex items-center space-x-2 mb-3">
        <span
          className={`text-xs px-2 py-1 rounded font-medium ${
            PRIORITY_COLORS[bug.priority] || "bg-gray-100 text-gray-800"
          }`}
        >
          P: {bug.priority}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span>Created: {formatDate(bug.created_at)}</span>
        {bug.reported_by_user_id && (
          <span className="bg-gray-100 px-2 py-1 rounded">
            User #{bug.reported_by_user_id}
          </span>
        )}
      </div>
    </div>
  );
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("sv-SE");
}
