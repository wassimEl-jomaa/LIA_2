import json
import os
import time
from typing import Any, Optional, Tuple
from fastapi import HTTPException
from openai import OpenAI
import openai as _openai_pkg
from dotenv import load_dotenv, find_dotenv

# Load environment variables from a .env file located in this folder or parent folders
dotenv_path = find_dotenv()
if dotenv_path:
  load_dotenv(dotenv_path)
else:
  load_dotenv()

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
    # Determine fallback early so we can return a safe mock if no API key is present
    fallback_to_mock = os.getenv("AI_FALLBACK_TO_MOCK", "1").lower() in ("1", "true", "yes")

    # Development mock mode: if AI_MOCK is set, return a canned response
    ai_mock = os.getenv("AI_MOCK", "").lower()
    if ai_mock in ("1", "true", "yes"):
      print("[AI] AI_MOCK enabled — returning mocked response")
      lower = user_prompt.lower()
      if "create high-quality test cases" in lower or "test cases" in lower:
        parsed = {
          "test_cases": [
            {
              "id": "TC-001",
              "title": "Mocked test case",
              "preconditions": [],
              "steps": ["Step 1: Do something"],
              "expected": "Expected behavior",
              "priority": "Medium",
              "type": "Functional",
            }
          ],
          "notes": ["This is a mocked response for local development."],
          "assumptions": [],
        }
        raw = json.dumps(parsed)
        return raw, parsed

      # Generic mock response
      parsed = {"mock": True, "prompt_preview": user_prompt[:200]}
      raw = json.dumps(parsed)
      return raw, parsed

    if not api_key:
      if fallback_to_mock:
        print("[AI] No OPENAI_API_KEY and AI_FALLBACK_TO_MOCK enabled — returning mocked response")
        parsed = {"mock": True, "reason": "no_api_key", "message": "No OPENAI_API_KEY set; fallback mock enabled.", "prompt_preview": user_prompt[:200]}
        return json.dumps(parsed, ensure_ascii=False), parsed
      raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing on backend")

    print(f"[AI] Using model: {MODEL}")
    
    # Detect obviously placeholder keys; if fallback enabled, return mock instead of error
    if api_key.lower().startswith("your-act") or "replace" in api_key.lower():
      if fallback_to_mock:
        print("[AI] OPENAI_API_KEY appears to be a placeholder and AI_FALLBACK_TO_MOCK is enabled — returning mocked response")
        parsed = {
          "mock": True,
          "reason": "placeholder_api_key",
          "message": "OPENAI_API_KEY is a placeholder; fallback mock enabled. Set a real key or set AI_FALLBACK_TO_MOCK=0 to disable.",
          "prompt_preview": user_prompt[:200],
        }
        return json.dumps(parsed, ensure_ascii=False), parsed
      raise HTTPException(status_code=500, detail="OPENAI_API_KEY appears to be a placeholder. Set a valid key in environment or backend/.env")

    # Retry/backoff and fallback configuration
    max_retries = int(os.getenv("OPENAI_RETRY_COUNT", "2"))
    backoff_base = float(os.getenv("OPENAI_RETRY_BACKOFF", "1"))
    # Fallback to a local mock response by default to avoid returning 5xx for quota/rate issues.
    # Set AI_FALLBACK_TO_MOCK=0/false to disable.
    fallback_to_mock = os.getenv("AI_FALLBACK_TO_MOCK", "1").lower() in ("1", "true", "yes")

    attempt = 0
    while True:
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

        ex_name = e.__class__.__name__
        lower_msg = str(e).lower()

        # Permanent quota exhaustion -> don't retry
        if "insufficient_quota" in lower_msg or ("quota" in lower_msg and "insufficient_quota" in lower_msg):
          if fallback_to_mock:
            print("[AI] Insufficient quota — falling back to mock response (AI_FALLBACK_TO_MOCK enabled by default)")
            parsed = {
              "mock": True,
              "reason": "insufficient_quota",
              "message": "OpenAI quota exceeded; returning a safe mock response. Set AI_FALLBACK_TO_MOCK=0 to disable.",
              "prompt_preview": user_prompt[:200],
            }
            return json.dumps(parsed, ensure_ascii=False), parsed
          raise HTTPException(status_code=503, detail="OpenAI quota/rate limit error: " + error_msg) from e

        # Transient rate-limit -> retry with exponential backoff
        if ex_name == "RateLimitError" or "rate limit" in lower_msg:
          if attempt < max_retries:
            sleep = backoff_base * (2 ** attempt)
            print(f"[AI] Rate limit detected; retrying in {sleep}s (attempt {attempt+1}/{max_retries})")
            time.sleep(sleep)
            attempt += 1
            continue
          # exhausted retries
          if fallback_to_mock:
            print("[AI] Rate limit persists — falling back to mock response (AI_FALLBACK_TO_MOCK enabled by default)")
            parsed = {
              "mock": True,
              "reason": "rate_limit",
              "message": "OpenAI rate limit persisted; returning a safe mock response. Set AI_FALLBACK_TO_MOCK=0 to disable.",
              "prompt_preview": user_prompt[:200],
              "retries": attempt,
            }
            return json.dumps(parsed, ensure_ascii=False), parsed
          raise HTTPException(status_code=503, detail="OpenAI quota/rate limit error: " + error_msg) from e

        # Other upstream errors -> optionally fallback or return 502
        if fallback_to_mock:
          print("[AI] Upstream error — falling back to mock response (AI_FALLBACK_TO_MOCK enabled by default)")
          parsed = {
            "mock": True,
            "reason": "upstream_error",
            "message": "Upstream OpenAI error; returning a safe mock response. Set AI_FALLBACK_TO_MOCK=0 to disable.",
            "prompt_preview": user_prompt[:200],
            "error": str(e),
          }
          return json.dumps(parsed, ensure_ascii=False), parsed

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
