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

### Frontend TypeScript and React

- Use [ESLint](https://eslint.org/) for linting (configured in `frontend/eslint.config.js`)
- The project uses ESLint 9 flat config with `typescript-eslint`, `react-hooks`, and `react-refresh` plugins
- Run from the `frontend/` directory:

```bash
cd frontend

# Check for lint errors
npm run lint

# You can also run ESLint directly for more options
npx eslint .

# Auto-fix lint errors where possible
npx eslint --fix .

# Lint a specific file or directory
npx eslint src/components/MyComponent.tsx
```

## Reporting Issues

If you find a bug or have a feature request, please open a GitHub issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT [License](LICENSE).