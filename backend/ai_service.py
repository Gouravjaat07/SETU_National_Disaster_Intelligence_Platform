"""Server-side OpenAI gateway for SETU text, streaming, and vision assistance."""
import os
from typing import AsyncGenerator, Optional

from openai import (APIConnectionError, APIStatusError, APITimeoutError,
                    AsyncOpenAI, AuthenticationError, RateLimitError)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL_NAME = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
_client = AsyncOpenAI(api_key=OPENAI_API_KEY, timeout=60.0, max_retries=0)

DISASTER_SYSTEM_PROMPT = (
    "You are 'Setu' — the official multilingual AI assistant of the National Disaster "
    "Response Intelligence Platform, Government of India. You help citizens, volunteers "
    "and government officials during floods and other disasters. "
    "Guidelines: (1) Respond in the same language the user writes in — Hindi, English, "
    "Bengali, Tamil, Malayalam, Marathi, etc. (2) Be concise, actionable and calm. "
    "(3) Prioritise safety over administrative detail. (4) Always suggest calling 1078 "
    "(NDMA) for life-threatening emergencies. (5) Cite official sources when possible. "
    "(6) Do not speculate about political or blame-oriented topics."
)


class AIServiceError(RuntimeError):
    """Safe, provider-independent error exposed to SETU routes."""


def user_facing_error(error: Exception) -> str:
    if isinstance(error, AuthenticationError):
        return "AI Assistant is temporarily unavailable. Please try again."
    if isinstance(error, RateLimitError):
        return "AI Assistant is busy right now. Please try again shortly."
    if isinstance(error, (APITimeoutError, APIConnectionError)):
        return "AI Assistant could not be reached. Please try again."
    if isinstance(error, APIStatusError):
        return "AI Assistant is temporarily unavailable. Please try again."
    if isinstance(error, AIServiceError):
        return str(error)
    return "AI Assistant is temporarily unavailable. Please try again."


def _check_configuration() -> None:
    if not OPENAI_API_KEY.strip():
        raise AIServiceError("AI Assistant is not configured on the server.")


def _extract_text(response) -> str:
    choices = getattr(response, "choices", None) or []
    value = choices[0].message.content if choices else ""
    value = (value or "").strip()
    if not value:
        raise AIServiceError("AI Assistant returned an empty response.")
    return value


async def stream_chat(session_id: str, text: str) -> AsyncGenerator[str, None]:
    del session_id  # The existing endpoint does not persist conversation history.
    _check_configuration()
    stream = await _client.chat.completions.create(
        model=MODEL_NAME,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": DISASTER_SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        stream=True,
    )
    async for event in stream:
        choices = getattr(event, "choices", None) or []
        delta = choices[0].delta.content if choices else None
        if delta:
            yield delta


async def generate_text(prompt: str, system: Optional[str] = None) -> str:
    _check_configuration()
    response = await _client.chat.completions.create(
        model=MODEL_NAME,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system or DISASTER_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )
    return _extract_text(response)


async def analyze_image(prompt: str, image_base64: str, system: Optional[str] = None) -> str:
    _check_configuration()
    data_url = image_base64 if image_base64.startswith("data:") else f"data:image/jpeg;base64,{image_base64}"
    response = await _client.chat.completions.create(
        model=MODEL_NAME,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system or DISASTER_SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ]},
        ],
    )
    return _extract_text(response)
