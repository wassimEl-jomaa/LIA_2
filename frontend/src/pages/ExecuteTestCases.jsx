import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ExecuteTestCases() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Execute Test Cases</h2>
      <p className="mt-2 text-sm text-gray-700">This feature relied on stored request history which has been removed.</p>
      <div className="mt-4">
        <button onClick={() => navigate(projectId ? `/projects/${projectId}` : '/projects')} className="px-3 py-1 bg-blue-600 text-white rounded">Back to Project</button>
      </div>
    </div>
  );
}
