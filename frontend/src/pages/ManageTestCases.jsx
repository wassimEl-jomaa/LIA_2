import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  listTestCases,
  getTestCase,
  createTestCase,
  updateTestCase,
  deleteTestCase,
} from "../api";

export default function ManageTestCases() {
  const { projectId: routeProjectId } = useParams();
  const projectId = routeProjectId || localStorage.getItem("active_project_id");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();

  const [form, setForm] = useState({ title: "", description: "", steps: "", preconditions: "", expected_result: "" });
  const [editingId, setEditingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    fetchList();
  }, [projectId]);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTestCases({ projectId: parseInt(projectId, 10) });
      setItems(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function populateForEdit(tc) {
    // Only set editingId when the id is a numeric DB id.
    // Some parsed log testcases may include non-numeric ids (eg. "TC-001").
    // Using those as a path parameter caused 422 from the API. Treat them as
    // non-persisted items and open the form for Create instead.
    const numericId = Number(tc.id);
    if (Number.isInteger(numericId)) {
      setEditingId(numericId);
    } else {
      setEditingId(null);
    }
    setForm({
      title: tc.title || "",
      description: tc.description || "",
      steps: (tc.steps || []).join("\n"),
      preconditions: (tc.preconditions || []).join("\n"),
      expected_result: tc.expected_result || "",
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        project_id: parseInt(projectId, 10),
        title: form.title,
        description: form.description,
        steps: form.steps.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
        preconditions: form.preconditions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
        expected_result: form.expected_result,
      };

      if (editingId) {
        await updateTestCase(editingId, payload);
      } else {
        await createTestCase(payload);
      }

      setForm({ title: "", description: "", steps: "", expected_result: "" });
      setEditingId(null);
      await fetchList();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this test case?")) return;
    setLoading(true);
    setError(null);
    try {
      await deleteTestCase(id);
      await fetchList();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function importTestCaseFromLog(tc) {
    setLoading(true);
    setError(null);
    try {
      // Check existing test cases for this project to avoid duplicate title insertion
      const list = await listTestCases({ projectId: parseInt(projectId, 10) });
      const match = (list || []).find((existing) => (existing.title || "").trim().toLowerCase() === (tc.title || "").trim().toLowerCase());
      if (match) {
        // Already exists in DB — load the existing record instead of creating
        setItems([match]);
        setEditingId(match.id);
        return match;
      }

      const payload = {
        project_id: parseInt(projectId, 10),
        title: tc.title,
        description: tc.description,
        steps: Array.isArray(tc.steps) ? tc.steps : (tc.steps ? String(tc.steps).split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : []),
        preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : (tc.preconditions ? String(tc.preconditions).split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : []),
        expected_result: tc.expected_result || "",
      };

      const created = await createTestCase(payload);
      // replace displayed item with created one
      setItems([created]);
      setEditingId(created.id);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl font-bold">Manage Test Cases</h1>
        <div>
          {/* Back to project */}
          <button
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}`);
              } else {
                navigate("/projects");
              }
            }}
            className="rounded-md bg-white px-3 py-2 font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>

      {!projectId && <div className="text-red-600">No project selected.</div>}

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Existing Test Cases</h2>
            <div className="text-sm text-gray-600">{loading ? "Loading..." : `${items.length} items`}</div>
          </div>

          <div className="space-y-3">
            {items.map((tc) => (
              <div key={tc.id} className="p-3 border rounded">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{tc.title}</div>
                    <div className="text-sm text-gray-600">{tc.description}</div>
                  </div>
                  <div className="space-x-2">
                    <button className="text-sm text-blue-600" onClick={() => populateForEdit(tc)}>Edit</button>
                    <button className="text-sm text-red-600" onClick={() => onDelete(tc.id)}>Delete</button>
                  </div>
                </div>
                {tc.steps?.length > 0 && (
                  <div className="mt-2 text-sm">
                    <strong>Steps:</strong>
                    <ol className="list-decimal ml-5">
                      {tc.steps.map((s, idx) => <li key={idx}>{s}</li>)}
                    </ol>
                  </div>
                )}
                {tc.expected_result && <div className="mt-2 text-sm">Expected: {tc.expected_result}</div>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-2">{editingId ? "Edit" : "Create"} Test Case</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Title</label>
              <input name="title" value={form.title} onChange={onChange} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea name="description" value={form.description} onChange={onChange} className="w-full border rounded px-2 py-1" rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium">Steps (one per line)</label>
              <textarea name="steps" value={form.steps} onChange={onChange} className="w-full border rounded px-2 py-1" rows={5} />
            </div>
            <div>
              <label className="block text-sm font-medium">Preconditions (one per line)</label>
              <textarea name="preconditions" value={form.preconditions} onChange={onChange} className="w-full border rounded px-2 py-1" rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium">Expected result</label>
              <input name="expected_result" value={form.expected_result} onChange={onChange} className="w-full border rounded px-2 py-1" />
            </div>
            <div className="flex space-x-2">
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">{editingId ? "Update" : "Create"}</button>
              <button type="button" className="px-3 py-1 border rounded" onClick={() => { setEditingId(null); setForm({ title: "", description: "", steps: "", expected_result: "" }); }}>Clear</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
