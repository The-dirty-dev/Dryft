# Contributing to Dryft

Thanks for contributing! This guide describes code style, testing expectations, and collaboration rules for the Dryft project.

## Code Style

### Go (backend)
- Format with `gofmt`.
- Prefer small, focused handlers and services.
- Keep request/response structs close to handlers.

### TypeScript (web/mobile/desktop)
- Follow existing lint rules in each app.
- Prefer explicit typing for public APIs and stores.
- Keep UI components and hooks well-documented.

## Pull Requests

1. Create a feature branch.
2. Keep PRs focused and reasonably scoped.
3. Include screenshots for UI changes (web/mobile/desktop).
4. Summarize behavioral changes and any migration steps.

## Testing Requirements

Run the relevant tests for the area you touched:

- **Backend**: `go test ./...`
- **Web**: `npm run test` (or `npm run test:coverage` if needed)
- **Mobile**: `npm test`

If you can't run tests locally, explain why in the PR description.

## Documentation Expectations

- Keep READMEs and API docs aligned with the code.
- Document new routes, events, and environment variables.
- Prefer examples for new endpoints or workflows.

## Agent Collaboration Rules

- Always append to `AGENTS_COLLAB.md` after each meaningful change (one line per entry).
- Before editing, log your intent (scope + short plan).
- If a task is blocked, log the reason and move to the next item.
- Don't rewrite or delete prior log entries - append only.

## Security & Privacy

- Never commit secrets or credentials.
- Use environment variables for configuration.
- For security changes, add a brief summary in the PR.
