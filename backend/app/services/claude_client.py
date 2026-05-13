# backend/app/services/claude_client.py
"""Anthropic Claude client for SCHN+ Support Assistant."""
import json
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

import anthropic

from app.config import settings
from app.utils.prompts import (
    SCHN_RESPONSE_RULES,
    PARSE_CUSTOMER_MESSAGE_PROMPT,
    GENERATE_TECHNICAL_PROMPT,
    GENERATE_BILLING_PROMPT,
    THIRD_PARTY_REDIRECT_PROMPT,
    ANALYZE_TRENDS_PROMPT,
)
from app.schemas import ParsedData, TrendItem, TrendsResponse


def _image_block(image_base64: str, media_type: str = "image/png") -> dict:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": image_base64,
        },
    }


class ClaudeClient:
    PARSE_MODEL = "claude-haiku-4-5-20251001"
    GENERATE_MODEL = "claude-sonnet-4-6"

    def __init__(self, api_key: Optional[str] = None):
        self.client = anthropic.Anthropic(
            api_key=api_key or settings.ANTHROPIC_API_KEY
        )

    def parse_customer_message(
        self,
        message: str,
        images: Optional[List[dict]] = None,
    ) -> ParsedData:
        prompt = PARSE_CUSTOMER_MESSAGE_PROMPT.format(message=message)

        content: List[dict] = []
        if images:
            for img in images:
                content.append(_image_block(img["base64"], img.get("media_type", "image/png")))
            content.append({
                "type": "text",
                "text": (
                    f"The agent has attached {len(images)} screenshot(s) showing the error or issue the customer is experiencing. "
                    "Use the visual information in the image(s) to supplement the text below when filling in the JSON fields, "
                    "especially problem_summary and context.\n\n" + prompt
                ),
            })
        else:
            content.append({"type": "text", "text": prompt})

        response = self.client.messages.create(
            model=self.PARSE_MODEL,
            max_tokens=1024,
            temperature=0.1,
            messages=[{"role": "user", "content": content}],
        )

        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        parsed_dict = json.loads(raw)
        tokens = {"input": response.usage.input_tokens, "output": response.usage.output_tokens}
        return ParsedData(
            customer_name=parsed_dict.get("customer_name"),
            customer_email=parsed_dict.get("customer_email"),
            account_number=parsed_dict.get("account_number"),
            device=parsed_dict.get("device"),
            problem_summary=parsed_dict.get("problem_summary"),
            context=parsed_dict.get("context"),
            payment_handler=parsed_dict.get("payment_handler"),
            ticket_type=parsed_dict.get("ticket_type"),
        ), tokens

    _THIRD_PARTY_STEPS: Dict[str, str] = {
        "Google Play": (
            "1. Open the Google Play Store app on your device.\n"
            "2. Tap your profile icon in the top right corner.\n"
            "3. Tap \"Payments & subscriptions.\"\n"
            "4. Tap \"Subscriptions.\"\n"
            "5. Locate your subscription and tap \"Report a problem.\"\n"
            "If you cannot find this option within the app, visit play.google.com/store/account/subscriptions "
            "from a web browser and follow the same steps. For additional help, you can also contact Google Play "
            "support at support.google.com/googleplay."
        ),
        "Apple": (
            "1. Go to Settings on your device.\n"
            "2. Tap your name at the top.\n"
            "3. Tap \"Subscriptions.\"\n"
            "4. Find the subscription and follow the instructions to request a refund.\n"
            "You can also visit reportaproblem.apple.com to submit a refund request directly."
        ),
        "Roku": (
            "1. Visit roku.com/account and sign in.\n"
            "2. Navigate to your subscription and follow the steps to manage billing or request a refund."
        ),
        "Amazon": (
            "1. Sign in to your Amazon account.\n"
            "2. Go to Memberships & Subscriptions.\n"
            "3. Find your subscription and follow the instructions to manage billing or request a refund."
        ),
    }

    def generate_third_party_redirect(
        self,
        customer_name: Optional[str],
        problem_summary: Optional[str],
        third_party_handler: str,
        platform_name: str = "SCHN+",
    ) -> str:
        steps = self._THIRD_PARTY_STEPS.get(
            third_party_handler,
            f"Contact {third_party_handler} support directly to request a refund.",
        )
        prompt = THIRD_PARTY_REDIRECT_PROMPT.format(
            platform_name=platform_name,
            customer_name=customer_name or "there",
            problem_summary=problem_summary or "refund request",
            third_party_handler=third_party_handler,
            steps=steps,
        )
        response = self.client.messages.create(
            model=self.GENERATE_MODEL,
            max_tokens=1024,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text

    def generate_response(
        self,
        parsed_data: Dict[str, Any],
        faq_context: str,
        original_message: str,
        images: Optional[List[dict]] = None,
        rules: str = SCHN_RESPONSE_RULES,
        platform_name: str = "SCHN+",
        cms_url: Optional[str] = None,
        agent_notes: Optional[str] = None,
        override_rules: bool = False,
    ) -> str:
        cms_line = "\nCMS FOR THIS PLATFORM: " + cms_url if cms_url else ""
        platform_identity = (
            "PLATFORM IDENTITY (ABSOLUTE PRIORITY — overrides everything below):\n"
            "- You are responding on behalf of: " + platform_name + "\n"
            "- The app name is: " + platform_name + "\n"
            "- NEVER mention SCHN+, SCHN, or any other platform name in your response\n"
            "- NEVER mix instructions, branding, or app names from any other platform\n"
            "- If the FAQ context references a different app name, ignore that name and use "
            + platform_name + " only" + cms_line + "\n\n"
        )
        active_rules = platform_identity + rules

        ticket_type = parsed_data.get("ticket_type")
        prompt_template = GENERATE_TECHNICAL_PROMPT if ticket_type == "technical" else GENERATE_BILLING_PROMPT
        prompt = prompt_template.format(
            parsed_data=json.dumps(parsed_data, indent=2),
            faq_context=faq_context if faq_context else "No relevant FAQ context available.",
            original_message=original_message,
            cms_url=cms_url or "Not available",
        )

        notes = (agent_notes or "").strip()
        if notes:
            if override_rules:
                active_rules = (
                    "PRIORITY 0 — AGENT OVERRIDE (overrides ALL rules and FAQ below):\n"
                    + notes
                    + "\n\n---\n\n"
                    + active_rules
                )
            else:
                active_rules = (
                    active_rules
                    + "\n\n---\n\n"
                    "MANDATORY AGENT INSTRUCTIONS — these are hard rules set by the support agent. "
                    "They MUST be followed exactly and override the billing/technical prompt behavior where they conflict. "
                    "Do NOT violate these under any circumstances:\n"
                    + notes
                )

        content: List[dict] = []
        if images:
            for img in images:
                content.append(_image_block(img["base64"], img.get("media_type", "image/png")))
            content.append({
                "type": "text",
                "text": (
                    f"The agent has attached {len(images)} screenshot(s). "
                    "Use what is visible in the image(s) as additional context to generate a more accurate response. "
                    "Treat the images as supplementary — the FAQ and parsed data are the primary source.\n\n" + prompt
                ),
            })
        else:
            content.append({"type": "text", "text": prompt})

        response = self.client.messages.create(
            model=self.GENERATE_MODEL,
            max_tokens=2048,
            temperature=0.3,
            system=active_rules,
            messages=[{"role": "user", "content": content}],
        )

        tokens = {"input": response.usage.input_tokens, "output": response.usage.output_tokens}
        return response.content[0].text, tokens

    def analyze_trends(self, summaries_with_ids: List[tuple]) -> TrendsResponse:
        filtered = [(rid, s.strip()) for rid, s in summaries_with_ids if s and s.strip()]
        if not filtered:
            return TrendsResponse(
                trends=[],
                total_tickets_analyzed=0,
                generated_at=datetime.now(timezone.utc),
            )

        lines = [f"ID={rid}: {s}" for rid, s in filtered]
        prompt = ANALYZE_TRENDS_PROMPT.format(summaries="\n".join(lines))

        response = self.client.messages.create(
            model=self.PARSE_MODEL,  # Haiku — cost efficient
            max_tokens=1024,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.DOTALL).strip()

        try:
            items = json.loads(raw)
            if not isinstance(items, list):
                raise ValueError(f"Expected JSON array, got {type(items).__name__}")
        except (json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError(f"analyze_trends: failed to parse Claude response: {exc}") from exc
        trends = [
            TrendItem(
                title=item["title"],
                description=item["description"],
                count=item["count"],
                ticket_ids=item.get("ticket_ids", []),
            )
            for item in items
        ]

        return TrendsResponse(
            trends=trends,
            total_tickets_analyzed=len(filtered),
            generated_at=datetime.now(timezone.utc),
        )

    def analyze_daily_update(self, tickets: list) -> dict:
        """Analyze a list of Freshdesk ticket dicts from CSV and group by problem."""
        import json as _json

        # Build compact ticket list for the prompt
        lines = []
        for t in tickets:
            tid = t.get("Ticket ID", t.get("ticket_id", "?"))
            subject = t.get("Subject", "")
            desc = t.get("Description", "")[:400]
            tags = t.get("Tags", "")
            product = t.get("Product", "")
            client = t.get("Client Name", t.get("Full name", ""))
            platform = t.get("Platform", "")
            status = t.get("Status", "")
            lines.append(
                f"ID={tid} | Client={client} | Platform={platform} | Status={status} | "
                f"Tags=[{tags}] | Product={product} | Subject={subject} | Desc={desc}"
            )

        tickets_text = "\n".join(lines)

        prompt = f"""You are analyzing a Freshdesk daily ticket export. Group these tickets by similar problem type and return a JSON report.

TICKET DATA (use ONLY what is explicitly stated here — do NOT invent any information):
{tickets_text}

INSTRUCTIONS:
- Group tickets that share the same root problem or issue type
- Each ticket must belong to exactly one group
- For each group extract strictly from the data above:
  * title: short problem label (e.g. "Login Issues", "Video Playback Error")
  * description: 1-2 sentences describing the pattern
  * ticket_ids: list of Ticket ID numbers (integers) for tickets in this group
  * clients: list of unique client/contact names (from "Client=" field)
  * tags: combined unique tags from all tickets in this group (from "Tags=[...]" field, split by comma)
  * devices: device names ONLY if explicitly mentioned in Subject or Desc (e.g. iOS, Android, Roku, FireTV, Web, Samsung TV) — empty list if none mentioned
  * platforms: unique platform names from the "Platform=" field for tickets in this group — empty list if none
  * trend: volume indicator — "high" if 3 or more tickets, "medium" if exactly 2, "low" if 1

STRICT RULES:
- Only include devices, tags, clients, platforms that appear in the raw data above
- Do not add tags, devices, or names that are not present
- ticket_ids must be integers
- tags must be individual tag strings, not comma-separated
- trend must be exactly "high", "medium", or "low"

Return ONLY valid JSON, no markdown, no explanation:
{{
  "groups": [
    {{
      "title": "...",
      "description": "...",
      "ticket_ids": [12345, 12346],
      "clients": ["Name 1", "Name 2"],
      "tags": ["tag1", "tag2"],
      "devices": ["iOS", "Android"],
      "platforms": ["Fox One", "SCHN+"],
      "trend": "high"
    }}
  ]
}}"""

        response = self.client.messages.create(
            model=self.GENERATE_MODEL,
            max_tokens=4096,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.DOTALL).strip()

        try:
            data = _json.loads(raw)
            if "groups" not in data:
                raise ValueError("Missing 'groups' key")
            return data
        except (json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError(f"analyze_daily_update: failed to parse Claude response: {exc}") from exc
