# Ontology Explorer Frontend

## Table of Contents

- [Ontology Explorer Frontend](#ontology-explorer-frontend)
  - [Table of Contents](#table-of-contents)
  - [1. Setup](#1-setup)
    - [1.1 Docker (Recommended)](#11-docker-recommended)
    - [1.2 Local Development](#12-local-development)
  - [2. Application URLs](#2-application-urls)
  - [3. Testing](#3-testing)
  - [4. Frontend Structure](#4-frontend-structure)

## 1. Setup

Frontend webapp runs at `http://localhost:5173`.

### 1.1 Docker (Recommended)

```bash
cd capstone/frontend
docker compose up --build                             # Production
docker compose -f docker-compose.dev.yml up --build   # Development (hot reload) 
docker compose down -v                                # Teardown
```

Note: please make sure the backend is running before running the docker compose up commands in the frontend folder.

### 1.2 Local Development

Requires Node 20+ and npm.

```bash
cd capstone/frontend
npm install                             # Install dependencies
npm run dev                             # Start development server

npm run build                           # Build for production
```

## 2. Application URLs

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:5173 | Application interface. |
| Backend API | http://localhost:8000 | REST API. |
| Backend API Documentation | http://localhost:8000/docs | Swagger interactive docs. |
| Memgraph Lab | http://localhost:7444 | Graph database interface. |

## 3. Testing

```bash
npx cypress open      # Run end-to-end tests with Cypress
npm run test          # Run component tests with Vitest
npm run lint          # ESLint checks
```

## 4. Frontend Structure

| Folder Path | Description |
|---|---|
| src/components | Shared UI components between features |
| src/lib | API helper functions and other general helper functions | 
| src/pages | Main pages in webapp (e.g., Dashboard, Data Manager, Graph Explorer, Settings) |
| src/store | Global Zustand store and app state/actions |
| src/\_\_test\_\_ | Component tests written with Vitest | 
| cypress/e2e | End-to-end tests written with Cypress |
| cypress/fixtures | Test ontology files used in Cypress tests |
