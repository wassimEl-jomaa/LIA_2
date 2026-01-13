export const risksSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["Low", "Medium", "High"] },
          rationale: { type: "string" },
          focusAreas: { type: "array", items: { type: "string" } },
          suggestedTests: { type: "array", items: { type: "string" } }
        },
        required: ["title", "severity", "rationale", "focusAreas", "suggestedTests"]
      }
    },
    missingInfo: { type: "array", items: { type: "string" } }
  },
  required: ["risks", "missingInfo"]
};
