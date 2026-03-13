# OBO Explorer Backend

For commands, read the Makefile.

Run the docker container instead of local. If running locally, copy the `.env.example` into `.env`.

## Setup

API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

```bash
# not needed
cp .env.example .env

# install dependencies
make install

# start the docker container
make docker-up

# runs the app with hot reload automatically restarts when changes are made
make dev
```

## Endpoints

- `POST /api/ontology/upload` — upload a `.obo` or `.owl` file
- `GET /api/ontology/list` — list uploaded ontologies
- `GET /api/graph/` — get the full graph
- `GET /api/graph/node/{node_id}` — get a node and its neighbors
- `GET /api/graph/search?q=` — search terms by name

## Structure

- `app/models/`: FastAPI validate data and serialises into JSON. For example, OntologyUploadResponse defines what fields the upload endpoint returns.
- `app/routers/`: API route handlers
- `app/services/memgraph.py`: Memgraph driver
- `app/services/ontology_parser.py`:  parses ontology files with Pronto
