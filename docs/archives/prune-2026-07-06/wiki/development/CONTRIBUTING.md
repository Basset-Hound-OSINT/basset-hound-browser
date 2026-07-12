# Contributing

Contribution guidelines and workflow.

## Before Starting

1. Check open issues and PRs
2. Comment on issue to claim it
3. Read [Architecture](ARCHITECTURE.md) for design overview
4. Setup [Development Environment](DEV-SETUP.md)

## Code Style

### JavaScript

- Use ES6+ syntax
- Use async/await (not callbacks)
- Use const/let (never var)
- Use camelCase for variables
- Use PascalCase for classes

### Comments

- Document public functions
- Explain "why" not "what"
- Keep comments current

### Commits

```bash
git commit -m "type: description

Longer explanation if needed.

Fixes #123"
```

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Test changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvement

## Pull Request Process

1. **Create branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes**
   - Keep commits focused
   - Write tests
   - Update documentation

3. **Test locally**
   ```bash
   npm test
   npm run lint
   ```

4. **Push to GitHub**
   ```bash
   git push origin feature/my-feature
   ```

5. **Create PR**
   - Link related issues
   - Describe changes
   - Request reviewers

6. **Address review comments**
   - Make requested changes
   - Commit and push again
   - Request re-review

7. **Merge**
   - Squash commits if requested
   - Delete feature branch

## Testing Requirements

- All tests pass: `npm test`
- New tests for new code
- Integration tests for new commands
- Performance benchmarks if applicable

## Documentation Updates

Update when:
- Adding new command
- Changing existing behavior
- Fixing documented bugs
- Improving clarity

Files to update:
- Relevant guide in `docs/wiki/`
- API reference if applicable
- Code comments for complex logic

## Large Changes

For major features:
1. Discuss in issue first
2. Create RFC (request for comments)
3. Get approval before starting
4. Break into multiple PRs if needed

## Questions?

- Comment on issue
- Ask in PR discussion
- Check [FAQ](../troubleshooting/FAQ.md)
- See [Architecture](ARCHITECTURE.md) for design questions

## Code Review Checklist

Reviewers check:
- Follows code style
- Tests included and passing
- Documentation updated
- No security issues
- Performance acceptable
- No breaking changes

## See Also

- **[Development Setup](DEV-SETUP.md)** - Environment setup
- **[Testing](TESTING.md)** - Test requirements
- **[Architecture](ARCHITECTURE.md)** - System design
