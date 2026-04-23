// src/components/ImportExportModal.jsx
import React, { useMemo, useState } from "react";
import { downloadExport, importRequirements } from "../api/impexp";

function cn(...c) { return c.filter(Boolean).join(" "); }

const ENTITY_OPTIONS = [
  { value: "requirements", label: "Requirements" },
  { value: "test_cases", label: "Test cases" },
];

const FORMAT_OPTIONS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
];

const CANON_FIELDS = [
  { key: "external_id", label: "External ID" },
  { key: "title", label: "Title (required)" },
  { key: "description", label: "Description" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "tags", label: "Tags" },
  { key: "source", label: "Source" },
];

export default function ImportExportModal({ open, onClose, projectId, onImported }) {
  const [tab, setTab] = useState("export");

  // export state
  const [exportEntity, setExportEntity] = useState("requirements");
  const [exportFormat, setExportFormat] = useState("csv");
  const [busyExport, setBusyExport] = useState(false);

  // import state
  const [file, setFile] = useState(null);
  const [importFormat, setImportFormat] = useState("auto");
  const [mode, setMode] = useState("upsert_external_id");
  const [onError, setOnError] = useState("continue");
  const [busyImport, setBusyImport] = useState(false);

  const [serverResult, setServerResult] = useState(null); // dry_run response
  const [mapping, setMapping] = useState(null); // {canon: header}

  const [error, setError] = useState("");

  const headers = serverResult?.headers || [];
  const autoMapping = serverResult?.auto_mapping || {};
  const effectiveMapping = serverResult?.effective_mapping || {};

  const mappingToShow = mapping || effectiveMapping || autoMapping;

  const preview = serverResult?.preview || [];
  const errors = serverResult?.errors || [];

  const canImport = useMemo(() => {
    if (!file) return false;
    // title must be mapped
    const t = mappingToShow?.title;
    return !!t;
  }, [file, mappingToShow]);

  if (!open) return null;

  async function handleDownload() {
    setBusyExport(true);
    setError("");
    try {
      const { blob, filename } = await downloadExport({
        projectId,
        entity: exportEntity,
        format: exportFormat,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || "Export failed");
    } finally {
      setBusyExport(false);
    }
  }

  async function runDryRun(nextMapping = null) {
    if (!file) return;
    setBusyImport(true);
    setError("");
    try {
      const res = await importRequirements({
        projectId,
        file,
        format: importFormat,
        mode,
        dryRun: true,
        onError,
        mapping: nextMapping,
      });
      setServerResult(res);
      // Om servern returnerar effective_mapping men user inte valt manuellt än:
      if (!mapping) setMapping(res.effective_mapping || res.auto_mapping || null);
    } catch (e) {
      setError(e?.message || "Dry run failed");
      setServerResult(null);
    } finally {
      setBusyImport(false);
    }
  }

  async function doImport() {
    if (!file) return;
    setBusyImport(true);
    setError("");
    try {
      const res = await importRequirements({
        projectId,
        file,
        format: importFormat,
        mode,
        dryRun: false,
        onError,
        mapping: mappingToShow,
      });
      setServerResult(res);
      onImported?.(res);
    } catch (e) {
      setError(e?.message || "Import failed");
    } finally {
      setBusyImport(false);
    }
  }

  function updateMappingField(canonKey, headerValue) {
    const next = { ...(mappingToShow || {}) };
    if (!headerValue) delete next[canonKey];
    else next[canonKey] = headerValue;
    setMapping(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-extrabold text-slate-900">Import / Export</div>
            <div className="text-xs text-slate-500">Project #{projectId}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b px-5 py-3">
          <button
            onClick={() => setTab("export")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold",
              tab === "export" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
            )}
          >
            Export
          </button>
          <button
            onClick={() => setTab("import")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold",
              tab === "import" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
            )}
          >
            Import requirements
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="p-5">
          {tab === "export" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-600">Entity</div>
                <select
                  value={exportEntity}
                  onChange={(e) => setExportEntity(e.target.value)}
                  className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                >
                  {ENTITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-600">Format</div>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                >
                  {FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4 flex items-end">
                <button
                  onClick={handleDownload}
                  disabled={busyExport}
                  className={cn(
                    "w-full rounded-xl px-4 py-2 text-sm font-semibold text-white",
                    "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700",
                    busyExport && "opacity-60"
                  )}
                >
                  {busyExport ? "Preparing…" : "Download"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Upload + options */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="md:col-span-2 rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">File</div>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.json,.yaml,.yml"
                    className="mt-2 block w-full text-sm"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setServerResult(null);
                      setMapping(null);
                    }}
                  />
                  <div className="mt-2 text-[11px] text-slate-500">
                    Supported: CSV, Excel, JSON, YAML
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Format</div>
                  <select
                    value={importFormat}
                    onChange={(e) => setImportFormat(e.target.value)}
                    className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    <option value="auto">Auto</option>
                    {FORMAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Mode</div>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    <option value="upsert_external_id">Upsert by external_id</option>
                    <option value="create_only">Create only</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={onError}
                  onChange={(e) => setOnError(e.target.value)}
                  className="rounded-xl border bg-white px-3 py-2 text-sm"
                >
                  <option value="continue">Continue on errors</option>
                  <option value="stop">Stop on first error</option>
                </select>

                <button
                  onClick={() => runDryRun(mappingToShow)}
                  disabled={!file || busyImport}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold text-white",
                    "bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700",
                    (!file || busyImport) && "opacity-60"
                  )}
                >
                  {busyImport ? "Checking…" : "Dry run (Preview)"}
                </button>

                <button
                  onClick={doImport}
                  disabled={!canImport || busyImport}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold text-white",
                    "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700",
                    (!canImport || busyImport) && "opacity-60"
                  )}
                  title={!canImport ? "Map at least Title" : ""}
                >
                  {busyImport ? "Importing…" : "Import"}
                </button>
              </div>

              {/* Mapping */}
              {serverResult && (
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Column mapping</div>
                      <div className="text-xs text-slate-500">
                        Auto mapping applied. Adjust if headers differ.
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">
                      Format: <span className="font-semibold">{serverResult.format}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {CANON_FIELDS.map((f) => (
                      <div key={f.key}>
                        <div className="text-[11px] font-semibold text-slate-600">{f.label}</div>
                        <select
                          value={mappingToShow?.[f.key] || ""}
                          onChange={(e) => updateMappingField(f.key, e.target.value)}
                          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        >
                          <option value="">(not mapped)</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Title måste vara mappad. External ID rekommenderas för “Upsert”.
                  </div>
                </div>
              )}

              {/* Result summary + preview */}
              {serverResult && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="text-sm font-bold text-slate-900">Summary</div>
                    <div className="mt-2 text-sm text-slate-700 space-y-1">
                      <div>Created: <b>{serverResult.created}</b></div>
                      <div>Updated: <b>{serverResult.updated}</b></div>
                      <div>Skipped: <b>{serverResult.skipped}</b></div>
                      <div>Errors: <b className={cn(errors.length ? "text-rose-700" : "")}>{errors.length}</b></div>
                      <div className="text-xs text-slate-500 mt-2">
                        Dry run visar vad som skulle hända.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-sm font-bold text-slate-900">Errors</div>
                    {errors.length ? (
                      <div className="mt-2 max-h-40 overflow-auto text-xs">
                        {errors.map((e, i) => (
                          <div key={i} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 mb-2">
                            Row {e.row}: {e.message}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">No errors.</div>
                    )}
                  </div>

                  <div className="md:col-span-2 rounded-2xl border p-4">
                    <div className="text-sm font-bold text-slate-900">Preview (first 20)</div>
                    {preview.length ? (
                      <div className="mt-2 overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="py-2 pr-3">external_id</th>
                              <th className="py-2 pr-3">title</th>
                              <th className="py-2 pr-3">priority</th>
                              <th className="py-2 pr-3">status</th>
                              <th className="py-2 pr-3">tags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((r, i) => (
                              <tr key={i} className="border-t">
                                <td className="py-2 pr-3 font-mono">{r.external_id || "—"}</td>
                                <td className="py-2 pr-3">{r.title}</td>
                                <td className="py-2 pr-3">{r.priority || "—"}</td>
                                <td className="py-2 pr-3">{r.status || "—"}</td>
                                <td className="py-2 pr-3">{(r.tags || []).join(", ")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">No preview rows.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Tips: använd <b>external_id</b> för stabil import (upsert).
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
