# OBO Explorer Backend

## Setup

```bash
# medgemma api keys
cp .env.example .env
make install
# start memgraph
make docker-up
# run the dev server
make dev
```

API will be available at `http://localhost:8000`.

## Makefile Commands

Read the makefile commands for shortcuts

## Project Structure

- main starts the app
- config settins from .env
- models pydantic schemas for ontology graph cypher query
- routers/ api endpoints to frontent
- services

## Environment Variables

See [`.env.example`](.env.example) for all available options:

- `MEMGRAPH_URI` — Bolt connection string (default: `bolt://localhost:7687`)
- `MEDGEMMA_API_URL` / `MEDGEMMA_API_KEY` — MedGemma endpoint credentials
- `CORS_ORIGINS` — Allowed origins list
- `DEBUG` — Enable debug mode
- `UPLOAD_MAX_SIZE_MB` — Max ontology file upload size
