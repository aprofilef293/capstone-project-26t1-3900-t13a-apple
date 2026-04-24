# Third-Party Licenses

This project depends on the following open-source software.
We gratefully acknowledge their authors and contributors for making this project possible.

## Dependencies

| Package | Version | License |
|---------|---------|---------|
| fastapi | 0.135.1 | MIT |
| uvicorn | 0.41.0 | BSD-3-Clause |
| pydantic | 2.12.5 | MIT |
| pydantic-settings | 2.13.1 | MIT |
| neo4j | 6.1.0 | Apache-2.0 AND Python-2.0 |
| pronto | 2.7.3 | MIT |
| python-multipart | 0.0.22 | Apache-2.0 |
| httpx | 0.28.1 | BSD-3-Clause |
| numpy | 2.4.3 | BSD-3-Clause |
| scipy | 1.17.1 | BSD-3-Clause |
| networkx | 3.6 | BSD-3-Clause |
| pandas | 3.0.1 | BSD-3-Clause |
| dask | 2026.1.2 | BSD-3-Clause |
| numba | 0.64.0 | BSD-2-Clause |
| pyfftw | 0.15.1 | BSD-3-Clause [1] |
| numba-kdtree | 0.6.0 | MIT |
| pygments | 2.20.0 | BSD-2-Clause |
| torch | 2.11.0+cpu | BSD-3-Clause |
| sentence-transformers | 5.3.0 | Apache-2.0 |
| google-genai | 1.72.0 | Apache-2.0 |

## Development

| Package | Version | License |
|---------|---------|---------|
| pytest | 9.0.2 | MIT |
| pytest-asyncio | 1.3.0 | Apache-2.0 |
| ruff | 0.15.5 | MIT |

## Vendored Source Code

The following third-party source is copied into this repository and
distributed as part of the backend.

| Component | Location | Upstream | Notes |
|-----------|----------|----------|-------|
| t-FDP | `app/services/t-fdp/` | https://github.com/Ideas-Laboratory/t-fdp | Python solver for "Force-directed graph layouts revisited: a new force based on the t-Distribution". No license file is present in the upstream source; redistribution terms should be clarified with the authors before public release. [2] |

## Pre-downloaded Models

The production Docker image bakes in a Sentence Transformers model via
the `EMBEDDING_MODEL_NAME` build argument. Model weights are subject to
the license on each model card:

| Model | License | Source |
|-------|---------|--------|
| `BAAI/bge-small-en-v1.5` | MIT | https://huggingface.co/BAAI/bge-small-en-v1.5 |
| `aleynahukmet/bge-medical-small-en-v1.5` | See model card | https://huggingface.co/aleynahukmet/bge-medical-small-en-v1.5 |

---

[1] pyfftw wraps FFTW3, which is GPL-2.0-or-later. The combined work at
runtime may be subject to GPL terms. See
https://www.fftw.org/doc/License-and-Copyright.html

[2] The t-FDP reference implementation (`Ideas-Laboratory/t-fdp`) ships
without an explicit `LICENSE` file. This project uses it in good faith
under the understanding that the upstream authors intend it for research
and academic use. If you plan to redistribute this backend, confirm the
licensing terms with the upstream authors.
