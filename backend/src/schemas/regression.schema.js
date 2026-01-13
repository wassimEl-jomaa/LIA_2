export const regressionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendedRegression: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          test: { type: "string" },
          priority: { type: "string", enum: ["Low", "Medium", "High"] },
          reason: { type: "string" }
        },
        required: ["test", "priority", "reason"]
      }
    },
    notes: { type: "array", items: { type: "string" } }
  },
  required: ["recommendedRegression", "notes"]
};
