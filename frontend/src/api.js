export async function generateTestCases({ requirementText, context }) {
  const r = await fetch("/api/ai/test-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirementText, context })
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }

  return r.json();
}
