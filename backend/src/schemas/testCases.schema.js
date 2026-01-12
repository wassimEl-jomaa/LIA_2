export const testCasesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    testCases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["Low", "Medium", "High"] },
          preconditions: { type: "array", items: { type: "string" } },
          steps: { type: "array", items: { type: "string" } },
          expected: { type: "string" }
        },
        required: ["title", "priority", "preconditions", "steps", "expected"]
      }
    },
    missingInfo: { type: "array", items: { type: "string" } }
  },
  required: ["testCases", "missingInfo"]
};
