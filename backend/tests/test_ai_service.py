import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import ai_service


def completion(text):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


def test_generate_text_uses_openai_model_and_preserves_messages(monkeypatch):
    create = AsyncMock(return_value=completion("SETU response"))
    monkeypatch.setattr(ai_service, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service._client.chat.completions, "create", create)

    result = asyncio.run(ai_service.generate_text("Where is shelter?", "Use official context."))

    assert result == "SETU response"
    kwargs = create.await_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    assert kwargs["messages"] == [
        {"role": "system", "content": "Use official context."},
        {"role": "user", "content": "Where is shelter?"},
    ]


def test_analyze_image_uses_openai_vision_message(monkeypatch):
    create = AsyncMock(return_value=completion("image analysis"))
    monkeypatch.setattr(ai_service, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service._client.chat.completions, "create", create)

    result = asyncio.run(ai_service.analyze_image("Classify this.", "abc123"))

    assert result == "image analysis"
    message = create.await_args.kwargs["messages"][1]
    assert message["content"][1] == {
        "type": "image_url",
        "image_url": {"url": "data:image/jpeg;base64,abc123"},
    }


def test_missing_key_is_clear_and_does_not_call_provider(monkeypatch):
    create = AsyncMock()
    monkeypatch.setattr(ai_service, "OPENAI_API_KEY", "")
    monkeypatch.setattr(ai_service._client.chat.completions, "create", create)

    with pytest.raises(ai_service.AIServiceError, match="not configured"):
        asyncio.run(ai_service.generate_text("hello"))
    create.assert_not_awaited()


def test_empty_response_is_rejected(monkeypatch):
    create = AsyncMock(return_value=completion("  "))
    monkeypatch.setattr(ai_service, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service._client.chat.completions, "create", create)

    with pytest.raises(ai_service.AIServiceError, match="empty response"):
        asyncio.run(ai_service.generate_text("hello"))


def test_malformed_provider_response_is_rejected(monkeypatch):
    create = AsyncMock(return_value=SimpleNamespace(choices=[]))
    monkeypatch.setattr(ai_service, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service._client.chat.completions, "create", create)

    with pytest.raises(ai_service.AIServiceError, match="empty response"):
        asyncio.run(ai_service.generate_text("hello"))


def test_provider_errors_are_safe_for_users():
    error = RuntimeError("secret provider details")
    assert ai_service.user_facing_error(error) == "AI Assistant is temporarily unavailable. Please try again."


def test_streaming_preserves_delta_order(monkeypatch):
    async def events():
        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="Hello"))])
        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=" SETU"))])

    create = AsyncMock(return_value=events())
    monkeypatch.setattr(ai_service, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(ai_service._client.chat.completions, "create", create)

    result = asyncio.run(collect(ai_service.stream_chat("session", "hello")))

    assert result == ["Hello", " SETU"]
    assert create.await_args.kwargs["model"] == "gpt-4o-mini"
    assert create.await_args.kwargs["stream"] is True


async def collect(stream):
    return [chunk async for chunk in stream]
