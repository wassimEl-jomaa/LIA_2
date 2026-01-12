import express from "express";
import { openai } from "../openaiClient.js";
import { testCasesSchema } from "../schemas/testCases.schema.js";

export const aiRouter = express.Router();

// POST /api/ai/test-cases
aiRouter.post("/test-cases", async (req, res) => {
  try {
    const { requirementText, context } = req.body ?? {};

    if (!requirementText || typeof requirementText !== "string") {
      return res.status(400).json({ error: "requirementText is required (string)" });
    }

    const system = `
You are a senior QA engineer and test designer.
Return ONLY JSON that matches the provided schema.
Create practical, high-value test cases including negative and edge cases.
Keep steps clear and reproducible.
`;

    const user = `
Requirement/User story:
${requirementText}

Context (optional):
${context ? JSON.stringify(context) : "{}"}
`;

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system.trim() },
        { role: "user", content: user.trim() }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "test_cases_response",
          strict: true,
          schema: testCasesSchema
        }
      }
    });

    // Responses API provides output_text for the text output
    const jsonText = response.output_text;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return res.status(502).json({
        error: "Model did not return valid JSON",
        raw: jsonText
      });
    }

    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
