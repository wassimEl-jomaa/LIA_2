import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { listTestCases } from "../api";

const API_BASE = "http://127.0.0.1:8000";
const getToken = () => localStorage.getItem("token");

// Map endpoint to readable feature name
const getFeatureName = (endpoint) => {
  const mapping = {
    testcases: "Test Cases Generation",
    risk: "Risk Analysis",
    regression: "Regression Testing",
    summary: "Test Summary",
  };
  return mapping[endpoint] || endpoint;
};
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function RequestLogDetails() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">RequestLog removed</h2>
      <p className="mt-2 text-sm text-gray-700">The RequestLog/history feature has been removed from this app.</p>
      <div className="mt-4">
        <button onClick={() => navigate(projectId ? `/projects/${projectId}` : '/projects')} className="px-3 py-1 bg-blue-600 text-white rounded">Back to Project</button>
      </div>
    </div>
  );
}
    async function load() {
