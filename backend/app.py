# app.py
import os
import streamlit as st
from openai import OpenAI

# ---------- Setup ----------
st.set_page_config(page_title="AI Assistant for Testers", page_icon="🧪", layout="wide")
st.title("🧪 AI Assistant for Testers (LIA Prototype)")
st.caption("Generate test cases • Identify risks • Suggest regression tests • Summarize results")

# Read API key from environment variable
# Windows (PowerShell):  setx OPENAI_API_KEY "your_key"
# Mac/Linux:            export OPENAI_API_KEY="your_key"
api_key = os.getenv("OPENAI_API_KEY", "").strip()

if not api_key:
    st.warning("Missing OPENAI_API_KEY environment variable. Add it and restart the app.")
    st.stop()

client = OpenAI(api_key=api_key)

# You can change the model if needed/allowed at your school/company.
DEFAULT_MODEL = "gpt-4o-mini"


def call_llm(system_prompt: str, user_prompt: str, model: str = DEFAULT_MODEL) -> str:
    """Call the LLM and return text output."""
    resp = client.chat.completions.create(
        model=model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return resp.choices[0].message.content.strip()


# ---------- Prompts ----------
SYSTEM_TESTER = (
    "You are a senior software test engineer and test lead. "
    "You write clear, structured, practical testing outputs. "
    "If input is unclear, list clarifying questions and assumptions."
)

PROMPT_TEST_CASES = """Requirement / User Story:
{req}

Task:
Create a set of high-quality test cases.

Rules:
- Include positive, negative, and edge cases.
- Include test data where relevant.
- Keep steps clear and reproducible.

Output format (Markdown):
### Assumptions / Questions
- ...

### Test Cases
For each test case use:
**ID:** TC-XXX
**Title:**
**Preconditions:**
**Steps:**
1.
2.
**Expected Result:**
**Priority:** High/Medium/Low
"""

PROMPT_RISK_ANALYSIS = """Requirement / User Story:
{req}

Task:
Identify testing risks and unclear areas.

Output format (Markdown):
### Risks
For each risk:
- **Risk:** ...
- **Level:** High/Medium/Low
- **Why it matters:** ...
- **Suggested tests / focus:** ...

### Missing / unclear information
- ...
"""

PROMPT_REGRESSION = """Changed component / feature:
{component}

Context (optional - past bugs, modules, notes):
{context}

Task:
Suggest a prioritized regression test list.

Output format (Markdown):
### Regression Test Suggestions (Prioritized)
1. **Test:** ...
   - **Why:** ...
   - **Priority:** High/Medium/Low

### Optional: Gaps / extra recommendations
- ...
"""

PROMPT_SUMMARY = """Raw test results / logs / bug list:
{text}

Task:
Summarize for a project manager / stakeholder.

Output format (Markdown):
### Summary
- **Overall status:** ...
- **Progress:** ...
- **Pass/Fail highlights:** ...
- **Top 3 risks:** ...
- **Blockers / critical issues:** ...
- **Recommended next actions:** ...
"""


# ---------- UI ----------
with st.sidebar:
    st.header("Settings")
    model = st.text_input("Model", value=DEFAULT_MODEL)
    st.markdown("---")
    st.write("Tip: Keep your input short and clean for best results.")
    st.write("This is a school prototype (PoC/MVP).")

col1, col2 = st.columns(2)

with col1:
    st.subheader("1) Requirement → Test cases / Risks")
    requirement_text = st.text_area(
        "Paste a requirement / user story",
        height=220,
        placeholder="Example: As a user, I want to reset my password using email OTP ...",
    )

    c1, c2 = st.columns(2)
    with c1:
        if st.button("✅ Generate Test Cases", use_container_width=True):
            if not requirement_text.strip():
                st.error("Please paste a requirement first.")
            else:
                with st.spinner("Generating test cases..."):
                    out = call_llm(SYSTEM_TESTER, PROMPT_TEST_CASES.format(req=requirement_text), model=model)
                st.markdown(out)

    with c2:
        if st.button("⚠️ Identify Risks", use_container_width=True):
            if not requirement_text.strip():
                st.error("Please paste a requirement first.")
            else:
                with st.spinner("Analyzing risks..."):
                    out = call_llm(SYSTEM_TESTER, PROMPT_RISK_ANALYSIS.format(req=requirement_text), model=model)
                st.markdown(out)

with col2:
    st.subheader("2) Regression suggestions / Summaries")
    component = st.text_input(
        "Changed component / module",
        placeholder="Example: Authentication service / Brake control module / Ticketing API",
    )
    regression_context = st.text_area(
        "Context (optional): past bugs, notes, related modules",
        height=120,
        placeholder="Example: Past issues: OTP timeout, email not sent under load, session token not refreshed...",
    )

    if st.button("🔁 Suggest Regression Tests", use_container_width=True):
        if not component.strip():
            st.error("Please write the changed component/module.")
        else:
            with st.spinner("Creating regression suggestions..."):
                out = call_llm(
                    SYSTEM_TESTER,
                    PROMPT_REGRESSION.format(component=component, context=regression_context),
                    model=model,
                )
            st.markdown(out)

    st.markdown("---")
    test_data = st.text_area(
        "Paste test results / bug reports / logs to summarize",
        height=160,
        placeholder="Example:\n- 120 tests executed: 110 passed, 10 failed\n- Bug #123: Login fails on iOS...\n...",
    )

    if st.button("🧾 Summarize Test Results", use_container_width=True):
        if not test_data.strip():
            st.error("Please paste some test results or bug reports.")
        else:
            with st.spinner("Summarizing..."):
                out = call_llm(SYSTEM_TESTER, PROMPT_SUMMARY.format(text=test_data), model=model)
            st.markdown(out)

st.markdown("---")
st.caption("Built for LIA: simple PoC showing AI support for testers.")
