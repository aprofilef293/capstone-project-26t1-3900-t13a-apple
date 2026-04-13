# Ontology Explorer

## 1. Abstract

> Ontology Explorer is an interactive web based application for visualizing and storing implementation science data using ontology in the Open Biomedical Ontologies (OBO) and Ontology Web Language (OWL) format. Implementation science studies generate complex and interconnected data, such as implementation scenarios, barriers, facilitators, strategies, settings, and outcomes. Systematically extracting and structuring these data can improve understanding of how and why implementation strategies succeed or fail. However, this extraction process is time consuming, and the resulting data are often not preserved in formats that support reuse or secondary analysis. This project shows all of the terms in the ontology in a two dimensional space, where the edges between terms reflect their relationships. Therefore, our application aims to improve the interactivity of implementation science data and to demonstrate how ontology data formats can support interactive data visualisation and reuse.

## Table of Contents

- [Ontology Explorer](#ontology-explorer)
  - [1. Abstract](#1-abstract)
  - [Table of Contents](#table-of-contents)
  - [2. Introduction](#2-introduction)
  - [3. Installation Manual](#3-installation-manual)
    - [3.1 Steps For Running Application](#31-steps-for-running-application)
      - [3.1.1 Prerequisites](#311-prerequisites)
      - [3.1.2 Windows Environment](#312-windows-environment)
      - [3.1.3 Linux and MacOS Environment](#313-linux-and-macos-environment)
    - [3.2 Application URLs](#32-application-urls)
    - [3.3 Backend Environment Variables](#33-backend-environment-variables)
    - [3.4 Local Hosting Embedding Model](#34-local-hosting-embedding-model)
    - [3.5 HuggingFace Inference Providers](#35-huggingface-inference-providers)
  - [4. Contributing](#4-contributing)
  - [5. License](#5-license)
  - [6. Acknowledgements](#6-acknowledgements)

## 2. Introduction

We intentionally structured this project as separate backend and frontend projects. This separation is reflected throughout our design process including independent Docker builds and documentation.

- See [backend README](backend/README.md) for more info.
- See [frontend README](frontend/README.md) for more info.


## 3. Installation Manual

### 3.1 Steps For Running Application

#### 3.1.1 Prerequisites

Must have Docker and Docker Compose installed. A HuggingFace account and API token, see section 3.5.

#### 3.1.2 Windows Environment

Install WSL 2 if not already installed. Once installed, run `wsl` in Command Prompt. In the WSL, follow the steps outlined in Section 3.1.3.

#### 3.1.3 Linux and MacOS Environment

**Running from Project Root**

This will build and start three services, Memgraph, backend and frontend. Wait until all services are running, until you see the log output of all three containers before using the application. There are two build options: a production build and a development build that support hot reloading. To run the Docker container from project root, follow these steps:

```bash
# 1. Open a terminal and change directory to project root.
cd capstone

# 2. Copy the environment file in the root directory and configure it. See Section 3.3 for required variables.
cd backend
cp .env.example .env
cd ..

# 3. Build and start the containers.
docker compose up --build                       # Production
docker compose -f docker-compose.dev.yml up     # Development

# 4. When finished, remove the containers.
docker compose down
docker compose down -v                          # Or to remove the volumes
```

**Running Frontend and Backend Separately**

To run frontend and backend as separate containers, it's similar to the steps previously. Open two terminals, and follow these commands:

```bash
# Terminal 1: Backend
cd capstone/backend
cp .env.example .env
docker compose up --build
# Or for development
docker compose -f docker-compose.dev.yml up --build

# Terminal 2: Frontend
cd capstone/frontend
docker compose up --build
# Or for development
docker compose -f docker-compose.dev.yml up --build
```

### 3.2 Application URLs

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:5173 | Application interface. |
| Backend API | http://localhost:8000 | REST API. |
| Backend API Documentation | http://localhost:8000/docs | Swagger interactive docs. |
| Memgraph Lab | http://localhost:7444 | Graph database interface. |

### 3.3 Backend Environment Variables

These environment variables are stored in the backend. Make sure you copy .env.example in the backend.

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

### 3.4 Local Hosting Embedding Model

The embedding model by default is run locally. The sentence-transformers library allows for different models to be downloaded and served on local machines. This requires a machine with sufficient GPU to run. To disable the embedding service, set `EMBEDDING_ENABLED=false` in `.env`.

### 3.5 HuggingFace Inference Providers

HuggingFace Inference Providers is a service that hosts sentence transformer models on GPU-accelerated infrastructure through an API. When Ontology Explorer processes an ontology, it sends term data to HuggingFace's servers, which runs one of the supported models to generate text embeddings for semantic search.

HuggingFace includes a monthly credit allowance that is drawn down with each inference request. Once credits run out, additional usage is billed on a pay-as-you-go basis at the same rate.

To use Inference Providers, a HuggingFace API token is required:

1. Create a HuggingFace account at https://huggingface.co/.
2. Go to https://huggingface.co/settings/tokens and create a new fine-grained token.
3. Under the Inference section, enable the "Make calls to Inference Providers" permission.
4. Copy the token and paste it into the `EMBEDDING_HF_TOKEN` variable in the `.env` file.
5. Set `EMBEDDING_ENABLED=true` in the `.env` file to enable the hosted embedding service.
6. Set `EMBEDDING_LOCAL=false` in the `.env` file to use the HuggingFace Inference.
7. Optionally, change the model by setting `EMBEDDING_MODEL_NAME` to a different sentence transformer model. Defaults to `BAAI/bge-small-en-v1.5`.

## 4. Contributing

See the contributing guides for each part of the project.
- [Backend Contributing Guide](backend/CONTRIBUTING.md)
- [Frontend Contributing Guide](frontend/CONTRIBUTING.md)

## 5. License

This project is licensed under the [MIT License](backend/LICENSE).
- [Backend Third Party Licenses](backend/THIRD_PARTY_LICENSES.md)
- [Frontend Third Party Licenses](frontend/THIRD_PARTY_LICENSES.md)

## 6. Acknowledgements

This project was developed by the COMP3900 T13A-APPLE team at UNSW Sydney.

We would like to thank our supervisors for their guidance throughout the project:
- **Dr Jeffery Chan**: Primary supervisor.
- **Prof Natalie Taylor**: Co-supervisor.
- **Dr Janna Hastings**: Co-supervisor.
- **Dr Shuang Liang**: Co-supervisor.