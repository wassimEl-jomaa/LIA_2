export async function generateTestCases({ requirementText, context }) {
  const token = localStorage.getItem("token");
  const projectId = localStorage.getItem("active_project_id");
  
  if (!token) {
    throw new Error("Authentication required. Please login first.");
  }
  
  if (!projectId) {
    throw new Error("No active project. Please select a project first.");
  }

  const r = await fetch("/api/testcases", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ 
      project_id: parseInt(projectId),
      requirement: requirementText 
    })
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }

  return r.json();
}

export async function listTestCases({ projectId, limit = 50 }) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");
  const r = await fetch(`/api/test_cases?project_id=${projectId}&limit=${limit}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}

export async function getTestCase(testCaseId) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");
  const r = await fetch(`/api/test_cases/${testCaseId}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}

export async function createTestCase(payload) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");
  const r = await fetch("/api/test_cases", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}
export async function analyzeRequirement(payload) {
  return apiRequest("/api/requirements/analysis", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export async function updateTestCase(testCaseId, payload) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");
  const r = await fetch(`/api/test_cases/${testCaseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}

export async function deleteTestCase(testCaseId) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");
  const r = await fetch(`/api/test_cases/${testCaseId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}

export async function listTestExecutions({ projectId, testCaseId, limit = 200 }) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");

  const tcQuery = testCaseId ? `&test_case_id=${testCaseId}` : "";
  const r = await fetch(
    `/api/test_executions?project_id=${projectId}&limit=${limit}${tcQuery}`,
    {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    }
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}

export async function createTestExecution(payload) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");
  const r = await fetch("/api/test_executions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}

export async function updateTestExecution(executionId, payload) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required. Please login first.");
  const r = await fetch(`/api/test_executions/${executionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return r.json();
}
export async function listBugs({ projectId, requirementId }) {
  const q = new URLSearchParams({ project_id: projectId });
  if (requirementId) q.set("requirement_id", requirementId);
  return apiFetch(`/api/bug_reports?${q.toString()}`);
}

export async function getBug(bugId) {
  return apiFetch(`/api/bug_reports/${bugId}`);
}

export async function createBug(payload) {
  return apiFetch(`/api/bug_reports`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateBug(bugId, payload) {
  return apiFetch(`/api/bug_reports/${bugId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteBug(bugId) {
  return apiFetch(`/api/bug_reports/${bugId}`, { method: "DELETE" });
}
export async function predictRequirementCategory({ text }) {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Authentication required. Please login first.");
  }

  const r = await fetch("/api/requirements/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ text })
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Prediction failed");
  }

  return r.json();
}
export async function downloadExport({ projectId, entity, format }) {
  const res = await fetchWithAuth(`/api/projects/${projectId}/export/${entity}?format=${format}`, {
    method: "GET",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Export failed");
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `export.${format}`;
  return { blob, filename };
}

export async function importRequirements({
  projectId,
  file,
  format = "auto",
  mode = "upsert_external_id",
  dryRun = true,
  onError = "continue",
  mapping = null,
}) {
  const fd = new FormData();
  fd.append("file", file);
  if (mapping) fd.append("mapping_json", JSON.stringify(mapping));

  const res = await fetchWithAuth(
    `/api/projects/${projectId}/import/requirements?format=${format}&mode=${mode}&dry_run=${dryRun}&on_error=${onError}`,
    { method: "POST", body: fd }
  );

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    const msg = data?.detail || text || "Import failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}