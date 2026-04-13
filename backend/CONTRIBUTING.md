# Contributing to OBO Explorer

## Getting Started

1. Clone the repository
2. Set up the backend and frontend following the instructions in the README
3. Create a new branch for your changes

## Development Workflow

- Create a branch from `main` for each feature or fix
- Write clear, descriptive commit messages
- Open a pull request and request a review from a team member
- Ensure all tests pass before merging

## Code Style

### Backend Python

- Follow PEP 8 conventions
- Use [Ruff](https://docs.astral.sh/ruff/) for linting and formatting (configured in `backend/pyproject.toml`)
- Run from the `backend/` directory:

```bash
cd backend

# Check for lint errors
ruff check .

# Auto-fix lint errors where possible
ruff check --fix .

# Format code
ruff format .

# Check formatting without applying changes
ruff format --check .
```

## Reporting Issues

If you find a bug or have a feature request, please open a GitHub issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## License


By contributing, you agree that your contributions will be licensed under the MIT [License](LICENSE).