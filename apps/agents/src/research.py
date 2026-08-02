"""Company research tool — web search + structured synthesis.

Given a company name and domain, runs OpenAI's hosted web_search tool and
forces the result into a fixed JSON schema. A single Responses API call does
both the searching (the model decides its own queries, typically 2-4) and the
synthesis, so there is no hand-rolled search/extract/summarise pipeline to
maintain.

The domain is required on purpose: names alone are ambiguous ("Apex" matches
dozens of companies), and scoping the prompt to the domain is what keeps the
search from wandering to the wrong company.
"""

import json
import os

from langchain_core.tools import tool
from langsmith import traceable
from openai import AsyncOpenAI

# Nano-tier is enough here: the work is retrieval + summarisation, and the
# search grounding matters far more than raw model strength.
RESEARCH_MODEL = os.environ.get("RESEARCH_MODEL", "gpt-5.6-luna")

# Every field is nullable on purpose — the schema is the guard against the
# model inventing funding rounds or headcounts it never saw in a search
# result. Unknown must stay null, never "filled in".
RESEARCH_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {
            "type": ["string", "null"],
            "description": "2-3 sentences: what the company does and for whom.",
        },
        "industry": {"type": ["string", "null"]},
        "headquarters": {"type": ["string", "null"]},
        "employee_count": {
            "type": ["string", "null"],
            "description": "Approximate range, e.g. '200-500'.",
        },
        "funding": {
            "type": ["string", "null"],
            "description": "Latest known stage/amount, e.g. 'Series B, $40M (2025)'.",
        },
        "recent_news": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Up to 3 recent, dated developments.",
        },
        "talking_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": (
                "Up to 3 specific, non-generic hooks a job seeker could "
                "reference in an outreach email."
            ),
        },
        "sources": {
            "type": "array",
            "items": {"type": "string"},
            "description": "URLs the facts above came from.",
        },
    },
    "required": [
        "summary",
        "industry",
        "headquarters",
        "employee_count",
        "funding",
        "recent_news",
        "talking_points",
        "sources",
    ],
    "additionalProperties": False,
}

RESEARCH_PROMPT = """\
Research the company "{name}" whose website is {domain}.

Search the web for: what the company does, industry, headquarters, size,
funding, and recent news (last 12 months). Only report facts that appear in
search results about THIS company — verify against the domain; if a result is
about a different company with a similar name, discard it. Set any field you
could not verify to null rather than guessing.

For talking_points, extract specifics a job seeker could mention in a short
outreach email (a launch, a hire, a funding round, an expansion) — never
generic flattery.
"""


@tool
@traceable(name="research_company")
async def research_company(name: str, domain: str) -> str:
    """Research a company on the live web by name and domain.

    Returns structured JSON: summary, industry, headquarters, employee_count,
    funding, recent_news, talking_points, and source URLs. Use this before
    personalising outreach for a lead, then store what you need in the lead's
    personalization via update_lead_in_list.
    """
    client = AsyncOpenAI()

    response = await client.responses.create(
        model=RESEARCH_MODEL,
        tools=[{"type": "web_search"}],
        input=RESEARCH_PROMPT.format(name=name, domain=domain),
        text={
            "format": {
                "type": "json_schema",
                "name": "company_research",
                "schema": RESEARCH_SCHEMA,
                "strict": True,
            }
        },
    )

    # output_text concatenates the message content; with a strict schema it is
    # exactly the JSON document.
    payload = json.loads(response.output_text)
    payload["company"] = name
    payload["domain"] = domain
    return json.dumps(payload, default=str)
