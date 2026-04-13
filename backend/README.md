# Ontology Explorer Backend

## Table of Contents

- [Ontology Explorer Backend](#ontology-explorer-backend)
  - [Table of Contents](#table-of-contents)
  - [1. Setup](#1-setup)
    - [1.1 Docker (Recommended)](#11-docker-recommended)
    - [1.2 Local Development](#12-local-development)
  - [2. API Endpoints](#2-api-endpoints)
    - [2.1 Ontology](#21-ontology)
    - [2.2 Graph](#22-graph)
  - [3. Application URLs](#3-application-urls)
  - [4. Environment Variables](#4-environment-variables)
  - [5. Testing](#5-testing)
  - [6. Makefile Commands](#6-makefile-commands)

## 1. Setup

API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 1.1 Docker (Recommended)

```bash
cd capstone/backend
cp .env.example .env
# Edit .env with your configuration (see Section 4)

docker compose up --build                            # Production
docker compose -f docker-compose.dev.yml up --build  # Development (hot reload)
docker compose down -v                               # Teardown
```

### 1.2 Local Development

Requires Python >=3.12, Poetry, and a running Memgraph instance.

```bash
cd capstone/backend
cp .env.example .env

make install   # Install dependencies
make dev       # Start with hot reload
```

## 2. API Endpoints

Full interactive documentation is available at `http://localhost:8000/docs`.

### 2.1 Ontology

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ontology/upload` | Upload an `.obo` or `.owl` file. Returns a Server-Sent Events stream with progress updates. |
| GET | `/api/ontology/list` | List all uploaded ontologies with term counts. |

**Upload SSE Events**

The upload endpoint streams progress via Server-Sent Events:

| Progress | Stage | Description |
|---|---|---|
| 25 | `parsed` | File parsed successfully. |
| 50 | `preprocessed` | Graph preprocessing complete. |
| 75 | `terms_ingested` | Terms written to database. |
| 100 | `complete` | Upload complete. |

### 2.2 Graph

| Method | Endpoint | Description | Parameters |
|---|---|---|---|
| GET | `/api/graph/` | Get the full graph. | |
| GET | `/api/graph/node/{node_id}` | Get a node and its neighbors. | `depth` (1-3, default 1) |
| GET | `/api/graph/search` | Search nodes by name (substring match). | `q` |
| GET | `/api/graph/semantic-search` | Semantic vector search ranked by similarity. | `q`, `limit` (1-100), `threshold` (0.0-1.0) |
| GET | `/api/graph/path` | Shortest path between two nodes. | `source`, `target`, `max_depth` (1-50) |
| GET | `/api/graph/paths` | Shortest paths between multiple nodes. | `ids` (2-10 node IDs), `max_depth` (1-50) |
| GET | `/api/graph/paths/export` | Export paths and neighbors as CSV. | `path_ids`, `selected_ids` |

## 3. Application URLs

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:5173 | Application interface. |
| Backend API | http://localhost:8000 | REST API. |
| Backend API Documentation | http://localhost:8000/docs | Swagger interactive docs. |
| Memgraph Lab | http://localhost:7444 | Graph database interface. |

## 4. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `EMBEDDING_HF_TOKEN` | Yes | (empty) | Hugging Face API token for semantic search. |
| `EMBEDDING_MODEL_NAME` | No | `BAAI/bge-small-en-v1.5` | Sentence Transformer model used to generate embeddings. |
| `EMBEDDING_LOCAL` | No | `true` | Set to `false` to use remote Hugging Face inference instead of local model. |
| `EMBEDDING_ENABLED` | No | `true` | Set to `false` to disable semantic search. |
| `MEMGRAPH_URI` | No | `bolt://localhost:7687` | Bolt protocol URI for the Memgraph database. |
| `MEMGRAPH_USER` | No | (empty) | Memgraph authentication username. |
| `MEMGRAPH_PASSWORD` | No | (empty) | Memgraph authentication password. |
| `CORS_ORIGINS` | No | `["http://localhost:5173"]` | Allowed CORS origins JSON array. |
| `DEBUG` | No | `false` | Enable debug mode. |
| `UPLOAD_MAX_SIZE_MB` | No | `250` | Maximum ontology file upload size in MB. |

## 5. Testing

See the [Makefile commands](#6-makefile-commands) for all available commands.

```bash
make test                    # Unit tests
pytest -m integration        # Integration tests requires running Memgraph
```

## 6. Makefile Commands

| Command | Description |
|---|---|
| `make install` | Install dependencies via Poetry. |
| `make dev` | Run development server with hot reload. |
| `make format` | Format code with Ruff. |
| `make lint` | Lint code with Ruff. |
| `make fix` | Auto-fix linting issues. |
| `make check` | Run format and lint checks. |
| `make test` | Run test suite. |
| `make all` | Run format, fix, lint, and test. |
| `make docker-up` | Build and start Docker containers. |
| `make docker-down` | Stop and remove containers with volumes. |
| `make clean` | Remove cache directories. |
