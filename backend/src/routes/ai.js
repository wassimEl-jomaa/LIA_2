import express from "express";
import { openai } from "../openaiClient.js";

import { testCasesSchema } from "../schemas/testCases.schema.js";
import { risksSchema } from "../schemas/risks.schema.js";
import { regressionSchema } from "../schemas/regression.schema.js";
import { summarySchema } from "../schemas/summary.schema.js";

export const aiRouter = express.Router();

/* =========================================================
   POST /api/ai/test-cases
   ========================================================= */
aiRouter.post("/test-cases", async (req, res) => {
  try {
    const { requirementText, context } = req.body ?? {};

    if (!requirementText || typeof requirementText !== "string") {
      return res
        .status(400)
        .json({ error: "requirementText is required (string)" });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `
You are a senior QA engineer and test designer.
Return ONLY JSON that matches the provided schema.
Create practical, high-value test cases including negative and edge cases.
Keep steps clear and reproducible.
          `.trim()
        },
        {
          role: "user",
          content: `
Requirement/User story:
${requirementText}

Context (optional):
${context ? JSON.stringify(context) : "{}"}
          `.trim()
        }
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

    return res.json(JSON.parse(response.output_text));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================================
   POST /api/ai/risks
   ========================================================= */
aiRouter.post("/risks", async (req, res) => {
  try {
    const { requirementText, context } = req.body ?? {};

    if (!requirementText || typeof requirementText !== "string") {
      return res
        .status(400)
        .json({ error: "requirementText is required (string)" });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a senior QA/test lead. Identify test risk areas and priorities. Return ONLY JSON matching schema."
        },
        {
          role: "user",
          content: `
Requirement:
${requirementText}

Context:
${context ? JSON.stringify(context) : "{}"}
          `.trim()
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "risk_analysis",
          strict: true,
          schema: risksSchema
        }
      }
    });

    return res.json(JSON.parse(response.output_text));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================================
   POST /api/ai/regression
   ========================================================= */
aiRouter.post("/regression", async (req, res) => {
  try {
    const { changedAreas, changeNotes, context } = req.body ?? {};

    if (!Array.isArray(changedAreas) || changedAreas.length === 0) {
      return res
        .status(400)
        .json({ error: "changedAreas is required (array of strings)" });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a senior QA engineer. Recommend regression tests based on code changes. Return ONLY JSON matching schema."
        },
        {
          role: "user",
          content: `
Changed areas:
${JSON.stringify(changedAreas)}

Change notes:
${changeNotes || ""}

Context:
${context ? JSON.stringify(context) : "{}"}
          `.trim()
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "regression_suggestions",
          strict: true,
          schema: regressionSchema
        }
      }
    });

    return res.json(JSON.parse(response.output_text));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================================
   POST /api/ai/summary
   ========================================================= */
aiRouter.post("/summary", async (req, res) => {
  try {
    const { rawText, context } = req.body ?? {};

    if (!rawText || typeof rawText !== "string") {
      return res
        .status(400)
        .json({ error: "rawText is required (string)" });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a test manager. Summarize test results and bug reports for stakeholders. Return ONLY JSON matching schema."
        },
        {
          role: "user",
          content: `
Raw test data:
${rawText}

Context:
${context ? JSON.stringify(context) : "{}"}
          `.trim()
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "test_summary",
          strict: true,
          schema: summarySchema
        }
      }
    });

    return res.json(JSON.parse(response.output_text));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
