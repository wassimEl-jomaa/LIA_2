export const summarySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } }
  },
  required: ["executiveSummary", "highlights", "blockers", "nextActions"]
};
