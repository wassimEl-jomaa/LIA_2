import json
import os
from typing import Any, Optional, Tuple
from fastapi import HTTPException
from openai import OpenAI

MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

SYSTEM_BASE = """You are a senior QA engineer and test lead.
You help with test design, risk-based testing, regression selection, and reporting.
You MUST output valid JSON only. No markdown, no extra text.
If you are unsure, still output JSON with best effort and include a field "assumptions".
"""

def _try_parse_json(text: str) -> Optional[Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        return None

def call_ai_json(user_prompt: str) -> Tuple[str, Optional[Any]]:
    """
    Returns (raw_text, parsed_json_or_none)
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing on backend")

    print(f"[AI] Using model: {MODEL}")
    print(f"[AI] API key length: {len(api_key)}")
    
    try:
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_BASE},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        raw = resp.choices[0].message.content or ""
        parsed = _try_parse_json(raw)
        return raw, parsed
    except Exception as e:
        error_msg = f"OpenAI call failed: {str(e)}"
        print(f"[AI ERROR] {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=error_msg) from e

def prompt_testcases(requirement: str) -> str:
    return f"""
Create high-quality test cases from this requirement:

REQUIREMENT:
{requirement}

Return JSON with:
{{
  "test_cases": [
    {{
      "id": "TC-001",
      "title": "...",
      "preconditions": ["..."],
      "steps": ["..."],
      "expected": "...",
      "priority": "High|Medium|Low",
      "type": "Functional|Negative|Boundary|Regression|Security|Performance"
    }}
  ],
  "notes": ["..."],
  "assumptions": ["..."]
}}
"""

def prompt_risk(requirement: str) -> str:
    return f"""
Analyze this requirement and identify test risks and unclear areas.

REQUIREMENT:
{requirement}

Return JSON with:
{{
  "risks": [
    {{
      "risk": "...",
      "severity": "High|Medium|Low",
      "why_it_matters": "...",
      "test_ideas": ["..."]
    }}
  ],
  "open_questions": ["..."],
  "assumptions": ["..."]
}}
"""

def prompt_regression(change_description: str, changed_components: Optional[list[str]]) -> str:
    components_text = ""
    if changed_components:
        components_text = "CHANGED_COMPONENTS:\n" + "\n".join(f"- {c}" for c in changed_components)

    return f"""
You are selecting regression tests based on changes.

CHANGE_DESCRIPTION:
{change_description}

{components_text}

Return JSON with:
{{
  "regression_plan": [
    {{
      "area": "...",
      "recommended_tests": ["..."],
      "priority": "High|Medium|Low",
      "rationale": "..."
    }}
  ],
  "tests_to_consider_skipping": ["..."],
  "assumptions": ["..."]
}}
"""

def prompt_summary(test_results: str, bug_reports: Optional[str]) -> str:
    bug_text = f"\nBUG_REPORTS:\n{bug_reports}\n" if bug_reports else ""
    return f"""
Summarize testing status for stakeholders.

TEST_RESULTS:
{test_results}
{bug_text}

Return JSON with:
{{
  "overall_status": "Green|Yellow|Red",
  "highlights": ["..."],
  "risks_blockers": ["..."],
  "metrics": {{
    "executed_tests": "unknown_or_number",
    "passed": "unknown_or_number",
    "failed": "unknown_or_number",
    "blocked": "unknown_or_number"
  }},
  "top_bugs": [
    {{
      "title": "...",
      "severity": "Critical|High|Medium|Low",
      "impact": "...",
      "suggested_next_action": "..."
    }}
  ],
  "next_steps": ["..."],
  "assumptions": ["..."]
}}
"""
