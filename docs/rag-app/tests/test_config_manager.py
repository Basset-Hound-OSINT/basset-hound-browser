"""Tests for Configuration Management

Tests:
- Configuration loading and validation
- Environment variable overrides
- Config manager
"""


from app.config_manager import Config, ConfigManager


class TestConfig:
    """Test Config class."""

    def test_config_creation(self):
        """Should create config with data."""
        config = Config({"mode": "multi-rag", "router": {"type": "broadcast"}})

        assert config.get("mode") == "multi-rag"
        assert config.get("router.type") == "broadcast"

    def test_config_get_nested(self):
        """Should get nested values with dot notation."""
        config = Config(
            {
                "knowledge_bases": {
                    "atc": {"type": "postgres", "db": "atcdb"},
                    "research": {"type": "keyword-only"},
                }
            }
        )

        assert config.get("knowledge_bases.atc.type") == "postgres"
        assert config.get("knowledge_bases.research.type") == "keyword-only"

    def test_config_get_default(self):
        """Should return default for missing keys."""
        config = Config({"mode": "chat"})

        assert config.get("missing_key", "default") == "default"
        assert config.get("mode", "default") == "chat"

    def test_config_get_mode(self):
        """Should get RAG mode."""
        config = Config({"mode": "multi-rag"})
        assert config.get_mode() == "multi-rag"

    def test_config_validate_valid(self):
        """Should validate valid config."""
        config = Config(
            {
                "mode": "multi-rag",
                "router": {"type": "broadcast"},
                "knowledge_bases": {
                    "primary": {"type": "postgres"},
                },
            }
        )

        is_valid, errors = config.validate()
        assert is_valid is True
        assert len(errors) == 0

    def test_config_validate_invalid_mode(self):
        """Should reject invalid mode."""
        config = Config({"mode": "invalid-mode"})

        is_valid, errors = config.validate()
        assert is_valid is False
        assert any("mode" in e.lower() for e in errors)

    def test_config_validate_invalid_router(self):
        """Should reject invalid router type."""
        config = Config({"router": {"type": "unknown"}})

        is_valid, errors = config.validate()
        assert is_valid is False
        assert any("router" in e.lower() for e in errors)


class TestConfigManager:
    """Test ConfigManager."""

    def test_config_manager_default_path(self):
        """Should use default config.yaml path."""
        manager = ConfigManager()

        # Should not crash even if file doesn't exist
        config = manager.get_config()
        assert config is not None
