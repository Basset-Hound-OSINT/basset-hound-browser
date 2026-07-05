# Contributing to Rag Bootstrap

Thank you for your interest in contributing to Rag Bootstrap! This document provides guidelines and instructions for contributing code, documentation, and other improvements to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Commit Message Format](#commit-message-format)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Review Process](#review-process)
- [Common Issues](#common-issues)

## Getting Started

### Prerequisites

- Python 3.11+
- Git
- GitHub account with access to the ExudeAI organization

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/exudeai.git
   cd exudeai
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ExudeAI/exudeai.git
   ```

## Development Environment

### 1. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies
```

### 3. Install Pre-commit Hooks

```bash
pre-commit install
```

This ensures code quality checks run before each commit.

### 4. Verify Installation

```bash
pytest tests/ -v
```

All tests should pass before you start development.

## Code Style

### Python Style Guide

We follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) with the following tools:

**Linting**: `pylint`
```bash
pylint [project_name]/
```

**Formatting**: `black`
```bash
black [project_name]/
```

**Import Sorting**: `isort`
```bash
isort [project_name]/
```

**Type Checking**: `mypy`
```bash
mypy [project_name]/
```

### Run All Code Quality Checks

```bash
# Run linting
black --check [project_name]/
pylint [project_name]/
isort --check [project_name]/
mypy [project_name]/

# Or use the helper script (if available)
bash scripts/check-code-quality.sh
```

### Auto-format Code

```bash
black [project_name]/
isort [project_name]/
```

### Docstring Standards

All functions, classes, and modules must have docstrings. We follow Google-style docstrings:

```python
def example_function(arg1: str, arg2: int) -> bool:
    """Brief description of what the function does.

    Longer description if needed, explaining the logic, purpose, and any
    important notes about the function's behavior.

    Args:
        arg1: Description of arg1 parameter.
        arg2: Description of arg2 parameter.

    Returns:
        Description of return value.

    Raises:
        ValueError: When arg2 is negative.
        TypeError: When arg1 is not a string.

    Example:
        >>> result = example_function("test", 5)
        >>> assert result is True
    """
    if not isinstance(arg1, str):
        raise TypeError("arg1 must be a string")
    if arg2 < 0:
        raise ValueError("arg2 must be non-negative")
    return True
```

### Type Hints

Use type hints for all function parameters and return types:

```python
from typing import List, Optional, Dict, Tuple

def process_data(
    items: List[Dict[str, int]],
    filter_value: Optional[int] = None
) -> Tuple[List[str], int]:
    """Process items and return results."""
    ...
```

## Testing Requirements

### Test Coverage

- **Minimum coverage**: 80% of modified code
- **Target coverage**: 90%+

### Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_module.py -v

# Run specific test function
pytest tests/test_module.py::test_function -v

# Run with coverage report
pytest --cov=[project_name] --cov-report=html tests/

# Run only fast tests (skip integration tests)
pytest tests/ -m "not integration" -v
```

### Writing Tests

- Place tests in `tests/` directory
- Name test files as `test_*.py` or `*_test.py`
- Use descriptive test names: `test_<function>_<scenario>_<expected_result>`
- Each test should be independent and not rely on others

Example test structure:

```python
import pytest
from [project_name].module import function_to_test

class TestFunctionToTest:
    """Test cases for function_to_test."""

    def test_function_with_valid_input(self):
        """Test function behavior with valid input."""
        result = function_to_test("valid_input")
        assert result == "expected_output"

    def test_function_with_invalid_input(self):
        """Test function raises error with invalid input."""
        with pytest.raises(ValueError):
            function_to_test("invalid_input")

    @pytest.mark.parametrize("input,expected", [
        ("a", 1),
        ("b", 2),
        ("c", 3),
    ])
    def test_function_with_multiple_inputs(self, input, expected):
        """Test function with multiple input scenarios."""
        assert function_to_test(input) == expected
```

### Test Before PR

**IMPORTANT**: All tests must pass before creating a pull request:

```bash
pytest tests/ -v
```

## Making Changes

### Create a Feature Branch

```bash
git fetch upstream
git checkout -b feature/brief-description main
```

### Make Your Changes

1. Edit files as needed
2. Run code quality checks regularly:
   ```bash
   black [project_name]/
   pylint [project_name]/
   ```
3. Add/update tests for your changes
4. Run full test suite:
   ```bash
   pytest tests/ -v
   ```

### Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

### Commit Your Changes

See [Commit Message Format](#commit-message-format) below.

## Pull Request Process

### Before Submitting

1. ✅ All tests pass: `pytest tests/ -v`
2. ✅ Code quality checks pass: `black`, `pylint`, `isort`, `mypy`
3. ✅ Documentation is updated (docstrings, README, etc.)
4. ✅ CHANGELOG.md is updated (if applicable)
5. ✅ Commit messages follow format (see below)

### Create Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/brief-description
   ```

2. Go to GitHub and create a PR from your branch to `upstream/main`

3. Fill out the PR template completely:
   - **Title**: Brief description (50 chars max)
   - **Description**: What, why, and how
   - **Tests**: How to verify the change
   - **Checklist**: Confirm all items are done

### PR Template

```markdown
## Description
Briefly describe the changes and why they were made.

## Related Issues
Fixes #123 (or) Related to #456

## Changes Made
- Item 1
- Item 2
- Item 3

## Testing
How were these changes tested? Include steps to reproduce if applicable.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests pass (`pytest tests/ -v`)
- [ ] Code style passes (`black`, `pylint`)
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] CHANGELOG updated
- [ ] Commit messages follow format
```

### During Review

- Respond to feedback promptly
- Don't force-push unless requested
- Engage constructively with reviewers
- Ask for clarification if needed

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build, CI/CD, or dependency changes

### Scope (optional)

The scope should specify what part of the code changed:
- `api`: API-related changes
- `ui`: UI-related changes
- `database`: Database schema or queries
- `performance`: Performance optimizations
- `tests`: Test infrastructure

### Subject

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at end
- Maximum 50 characters

### Body (optional)

- Wrap at 72 characters
- Explain what and why, not how
- Separate from subject by blank line

### Footer (optional)

- Reference issues: `Fixes #123` or `Refs #456`
- Note breaking changes: `BREAKING CHANGE: description`

### Examples

```
feat(api): add user authentication endpoint

Add JWT-based authentication to the user API. Users can now obtain
tokens using email and password, and use tokens to access protected
endpoints.

Fixes #123
```

```
fix(tests): correct timeout in integration test

The test was timing out intermittently on slow CI runners. Increased
timeout from 5s to 10s and added retry logic.

Related to #456
```

```
docs: update README with setup instructions

Add detailed setup instructions for different OS platforms and
dependency installation options.
```

## Branch Naming Conventions

Follow this format for consistency:

```
<type>/<short-description>
```

### Types

- `feature/`: New feature
- `fix/`: Bug fix
- `docs/`: Documentation
- `refactor/`: Code refactoring
- `perf/`: Performance improvement
- `test/`: Test improvements
- `chore/`: Build/CI changes

### Examples

```
feature/user-authentication
fix/database-connection-timeout
docs/api-documentation
refactor/model-architecture
perf/cache-optimization
```

### Branch Rules

- Use lowercase letters, numbers, and hyphens
- Be descriptive but concise
- Delete branch after merge

## Review Process

### Reviewers

PRs require at least 1 approval before merging. Reviewers look for:

- ✅ Code quality and style
- ✅ Test coverage and passing tests
- ✅ Documentation completeness
- ✅ No obvious bugs or issues
- ✅ Alignment with project goals

### Review Feedback

- **Request changes**: Address before merge
- **Comment**: Discussion items, not blockers
- **Approve**: PR is ready to merge

### Addressing Feedback

1. Read feedback carefully
2. Discuss if you disagree
3. Make requested changes
4. Push to same branch (don't create new PR)
5. Mark conversations as resolved

## Common Issues

### My branch is out of date

```bash
git fetch upstream
git rebase upstream/main
git push origin feature/branch-name --force-with-lease
```

### I need to undo commits

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

### Tests are failing locally but not in CI

```bash
# Run tests in isolated environment
pytest tests/ -v --tb=short

# Check Python version matches CI
python --version

# Try running in clean virtual environment
deactivate
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest tests/ -v
```

### Pre-commit hook failing

```bash
# See what pre-commit is checking
pre-commit run --all-files

# Fix issues
black [project_name]/
isort [project_name]/

# Retry commit
git add .
git commit -m "message"
```

## Questions?

If you have questions:

1. Check existing issues and pull requests
2. Ask in discussions (if available)
3. Email the project maintainers
4. Review the main README.md for project overview

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code.

---

**Thank you for contributing!** Your work helps improve this project for everyone.
