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
