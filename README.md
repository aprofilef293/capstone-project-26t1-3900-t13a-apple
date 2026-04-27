# OBO Explorer

### 1. Abstract

> OBO Explorer is an interactive web based application for visualizing and storing implementation science data using ontology in the Open Biomedical Ontologies (OBO) and Ontology Web Language (OWL) format. Implementation science studies generate complex and interconnected data, such as implementation scenarios, barriers, facilitators, strategies, settings, and outcomes. Systematically extracting and structuring these data can improve understanding of how and why implementation strategies succeed or fail. However, this extraction process is time consuming, and the resulting data are often not preserved in formats that support reuse or secondary analysis. This project shows all of the terms in the ontology in a two dimensional space, where the edges between terms reflect their relationships. Therefore, our application aims to improve the interactivity of implementation science data and to demonstrate how ontology data formats can support interactive data visualisation and reuse.

## Table of Contents

- [OBO Explorer](#obo-explorer)
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
    - [3.6 Gemini Query Expansion](#36-gemini-query-expansion)
    - [3.7 Ontology Data Files](#37-ontology-data-files)
  - [4. Contributing](#4-contributing)
  - [5. License](#5-license)
  - [6. Acknowledgements](#6-acknowledgements)

## 2. Introduction

We intentionally structured this project as separate backend and frontend projects. This separation is reflected throughout our design process including independent Docker builds and documentation. See [backend README](backend/README.md) and [frontend README](frontend/README.md) for more info.

## 3. Installation Manual

### 3.1 Steps For Running Application

#### 3.1.1 Prerequisites

Docker and Docker Compose must be installed. The application runs fully locally by default. A HuggingFace account and API token are only needed if you want to use the remote HuggingFace Inference API instead of local embeddings [Section 3.5](#35-huggingface-inference-providers). A Gemini API key is also optional, for query expansion [Section 3.6](#36-gemini-query-expansion).

#### 3.1.2 Windows Environment

Install WSL 2 if not already installed. Once installed, run `wsl` in Command Prompt. In the WSL, follow the steps in [Section 3.1.3](#313-linux-and-macos-environment).

#### 3.1.3 Linux and MacOS Environment

**Running from Project Root**

This will build and start three services, Memgraph, backend and frontend. Wait until all services are running, until you see the log output of all three containers before using the application. There are two build options: a production build and a development build that support hot reloading. To run the Docker container from project root, follow these steps:

```bash
# 1. In the project root, copy the environment file in the backend directory and configure it. See Section 3.3 for required variables.
cd backend
cp .env.example .env
cd ..

# 2. Build and start the containers.
docker compose up --build                       # Production
docker compose -f docker-compose.dev.yml up --build    # Development

# 3. When finished, remove the containers.
docker compose down
docker compose down -v                          # Or to remove the volumes
```

**Running Frontend and Backend Separately**

To run frontend and backend as separate containers, it's similar to the steps previously. Open two terminals, and follow these commands:

```bash
# Terminal 1: Backend, In project root
cd backend
cp .env.example .env
docker compose up --build
# Or for development
docker compose -f docker-compose.dev.yml up --build

# Terminal 2: Frontend, In project root
cd frontend
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
| `EMBEDDING_HF_TOKEN` | No | (empty) | Hugging Face API token. Only required when `EMBEDDING_LOCAL=false`. |
| `EMBEDDING_MODEL_NAME` | No | `aleynahukmet/bge-medical-small-en-v1.5` | Sentence Transformer model for embeddings. Local mode uses the medical fine-tune; for remote HF Inference use `BAAI/bge-small-en-v1.5` instead (the medical model is not hosted on HF Inference). |
| `EMBEDDING_LOCAL` | No | `true` | Set to `false` to use remote Hugging Face Inference instead of local model. |
| `EMBEDDING_ENABLED` | No | `true` | Set to `false` to disable semantic search. |
| `GEMINI_API_KEY` | No | (empty) | Google AI Studio API key for query expansion. Leave empty to disable. |
| `GEMINI_MODEL` | No | `gemini-3-flash-preview` | Gemini model ID used for query expansion. |
| `GEMINI_ENABLED` | No | `true` | Set to `false` to disable Gemini query expansion even when a key is set. |
| `MEMGRAPH_URI` | No | `bolt://localhost:7687` | Bolt protocol URI for the Memgraph database. |
| `MEMGRAPH_USER` | No | `memgraph` | Memgraph authentication username. |
| `MEMGRAPH_PASSWORD` | No | `memgraph` | Memgraph authentication password. |
| `CORS_ORIGINS` | No | `["http://localhost:5173"]` | Allowed CORS origins JSON array. |
| `DEBUG` | No | `false` | Enable debug mode. |
| `UPLOAD_MAX_SIZE_MB` | No | `250` | Maximum ontology file upload size in MB. |

### 3.4 Local Hosting Embedding Model

The embedding model by default is run locally using `aleynahukmet/bge-medical-small-en-v1.5`, a medical-domain fine-tune of BGE. The sentence-transformers library downloads the model on first startup and caches it for subsequent runs. To disable the embedding service, set `EMBEDDING_ENABLED=false` in `.env`.

### 3.5 HuggingFace Inference Providers

HuggingFace Inference Providers is a service that hosts sentence transformer models on GPU-accelerated infrastructure through an API. When OBO Explorer processes an ontology, it sends term data to HuggingFace's servers, which runs one of the supported models to generate text embeddings for semantic search.

HuggingFace includes a monthly credit allowance that is drawn down with each inference request. Once credits run out, additional usage is billed on a pay-as-you-go basis at the same rate.

To use Inference Providers, a HuggingFace API token is required:

1. Create a HuggingFace account at https://huggingface.co/.
2. Go to https://huggingface.co/settings/tokens and create a new fine-grained token.
3. Under the Inference section, enable the "Make calls to Inference Providers" permission.
4. Copy the token and paste it into the `EMBEDDING_HF_TOKEN` variable in the `.env` file.
5. Set `EMBEDDING_ENABLED=true` in the `.env` file to enable the hosted embedding service.
6. Set `EMBEDDING_LOCAL=false` in the `.env` file to use the HuggingFace Inference.
7. Set `EMBEDDING_MODEL_NAME=BAAI/bge-small-en-v1.5` — the default medical model (`aleynahukmet/bge-medical-small-en-v1.5`) is not hosted on HF Inference.

### 3.6 Gemini Query Expansion

When a user submits a natural-language question or medical query to the semantic search endpoint (e.g. "what are the signs of heart failure", "diabetes treatment options"), Gemini expands the query into formal MeSH terms and clinical descriptors. The search always runs the original query first; if Gemini returns expanded terms, they are also searched and the best scores from both are merged. Gemini only activates for questions (starting with "what", "how", etc.), queries containing function words ("the", "of", "between"), or medical intent words ("treatment", "symptoms", "diagnosis"). Plain keyword searches are never sent to Gemini.

Gemini query expansion is optional. To enable it:

1. Create a Google AI Studio account at https://aistudio.google.com/.
2. Go to https://aistudio.google.com/app/apikey and create an API key.
3. Set `GEMINI_API_KEY` to the key in the `.env` file.
4. Optionally, change the model by setting `GEMINI_MODEL`. Defaults to `gemini-3-flash-preview`.

To disable query expansion, either leave `GEMINI_API_KEY` empty or set `GEMINI_ENABLED=false`.

### 3.7 Ontology Data Files

OBO Explorer supports uploading `.obo` and `.owl` files. Download a `.owl` file from the [Behaviour Change Intervention Ontology](https://github.com/HumanBehaviourChangeProject/ontologies) (BCIO) repository and use the upload feature in the app.

The following `.owl` files can be uploaded directly into the application:

| File | Description |
|---|---|
| [`bcio.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/bcio.owl) | Complete BCIO with all lower-level ontologies. |
| [`bcio_behaviour.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/Behaviour/bcio_behaviour.owl) | Behaviour ontology. |
| [`bcto.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/BehaviourChangeTechniques/bcto.owl) | Behaviour Change Techniques ontology. |
| [`bcio_engagement.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/Engagement/bcio_engagement.owl) | Engagement ontology. |
| [`bcio_moa.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/MechanismOfAction/bcio_moa.owl) | Mechanism of Action ontology. |
| [`bcio_mode_of_delivery.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/ModeOfDelivery/bcio_mode_of_delivery.owl) | Mode of Delivery ontology. |
| [`bcio_population.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/Population/bcio_population.owl) | Population ontology. |
| [`bcio_schedule.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/Schedule/bcio_schedule.owl) | Schedule ontology. |
| [`bcio_setting.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/Setting/bcio_setting.owl) | Setting ontology. |
| [`bcio_source.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/Source/bcio_source.owl) | Source ontology. |
| [`bcio_style.owl`](https://github.com/HumanBehaviourChangeProject/ontologies/blob/master/StyleOfDelivery/bcio_style.owl) | Style of Delivery ontology. |

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