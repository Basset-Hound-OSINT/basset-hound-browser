"""Tests for file handlers and HandlerRegistry in app.ingestion."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from app.ingestion import (
    FileHandler,
    HandlerRegistry,
    JSONHandler,
    MarkdownHandler,
    TextHandler,
    YAMLHandler,
)


@pytest.mark.unit
class TestHandlerRegistry:
    def test_returns_correct_handler_for_each_extension(self):
        assert isinstance(HandlerRegistry.get(".md"), MarkdownHandler)
        assert isinstance(HandlerRegistry.get(".txt"), TextHandler)
        assert isinstance(HandlerRegistry.get(".log"), TextHandler)
        assert isinstance(HandlerRegistry.get(".json"), JSONHandler)
        assert isinstance(HandlerRegistry.get(".yaml"), YAMLHandler)
        assert isinstance(HandlerRegistry.get(".yml"), YAMLHandler)

    def test_pdf_handler_registered(self):
        handler = HandlerRegistry.get(".pdf")
        assert handler is not None
        assert isinstance(handler, FileHandler)

    def test_unsupported_extension_returns_none(self):
        assert HandlerRegistry.get(".exe") is None
        assert HandlerRegistry.get(".docx") is None
        assert HandlerRegistry.get(".xyz") is None

    def test_case_insensitive_lookup(self):
        # The code does extension.lower() so mixed case should work
        assert HandlerRegistry.get(".Md") is not None
        assert HandlerRegistry.get(".TXT") is not None
        assert HandlerRegistry.get(".Json") is not None

    def test_supported_extensions(self):
        exts = HandlerRegistry.supported_extensions()
        assert isinstance(exts, set)
        assert ".md" in exts
        assert ".txt" in exts
        assert ".json" in exts
        assert ".yaml" in exts
        assert ".yml" in exts
        assert ".pdf" in exts
        assert ".log" in exts
        assert len(exts) == 7


@pytest.mark.unit
class TestMarkdownHandler:
    def test_extracts_text(self, tmp_path: Path):
        f = tmp_path / "test.md"
        f.write_text("# Hello\n\nWorld", encoding="utf-8")
        handler = MarkdownHandler()
        text = handler.extract_text(f)
        assert "# Hello" in text
        assert "World" in text


@pytest.mark.unit
class TestTextHandler:
    def test_extracts_text(self, tmp_path: Path):
        f = tmp_path / "test.txt"
        content = "Line 1\nLine 2\n"
        f.write_text(content, encoding="utf-8")
        handler = TextHandler()
        assert handler.extract_text(f) == content


@pytest.mark.unit
class TestJSONHandler:
    def test_produces_indented_json(self, tmp_path: Path):
        f = tmp_path / "test.json"
        data = {"key": "value", "num": 42}
        f.write_text(json.dumps(data), encoding="utf-8")
        handler = JSONHandler()
        result = handler.extract_text(f)
        parsed = json.loads(result)
        assert parsed == data
        # Should be indented (multi-line)
        assert "\n" in result


@pytest.mark.unit
class TestYAMLHandler:
    def test_produces_yaml_dump(self, tmp_path: Path):
        f = tmp_path / "test.yaml"
        data = {"title": "test", "items": ["a", "b"]}
        f.write_text(yaml.dump(data), encoding="utf-8")
        handler = YAMLHandler()
        result = handler.extract_text(f)
        parsed = yaml.safe_load(result)
        assert parsed == data
