"""Centralized configuration module for the OBO Explorer backend.

Uses ``pydantic-settings`` to declare every tuneable value in a single
``Settings`` class.  All values can be overridden via environment
variables (case-insensitive) or through a ``.env`` file placed at the
project root.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App-wide configuration, auto-populated from environment variables or a ``.env`` file.

    All settings can be overridden by setting the corresponding environment
    variable (case-insensitive).  For example, ``MEMGRAPH_URI=bolt://db:7687``.

    Groups:
        Memgraph
            Connection details for the Memgraph graph database.

            - ``memgraph_uri`` — Bolt protocol URI (default ``bolt://localhost:7687``).
            - ``memgraph_user`` — Username for Memgraph authentication.
            - ``memgraph_password`` — Password for Memgraph authentication.

        Embedding / Semantic Search
            Configures the HuggingFace Inference API used for vector-based
            semantic search over ontology terms.

            - ``embedding_local`` — Set to ``true`` for local inference via
              sentence-transformers, ``false`` for remote inference via the
              HuggingFace Inference API.
            - ``embedding_model_name`` — Model ID used for embeddings
              (default ``BAAI/bge-small-en-v1.5``).  Works with any
              sentence-transformers-compatible model.
            - ``embedding_hf_token`` — HuggingFace API token, required only
              when ``embedding_local`` is ``false``.  Obtain a free token at
              https://huggingface.co/settings/tokens.
            - ``embedding_enabled`` — Set to ``false`` to disable the embedding
              service entirely (e.g. in CI or test environments).  When
              disabled, the ``/api/graph/embedding-search`` endpoint returns 503.

        Gemini Query Expansion
            When a sentence is submitted to the semantic search endpoint,
            Gemini decomposes it into ontology-style terms before embedding.

            - ``gemini_api_key`` — Google AI Studio API key.  Obtain one at
              https://aistudio.google.com/app/apikey.  Leave empty to disable.
            - ``gemini_model`` — Gemini model ID (default ``gemini-2.5-flash``).
            - ``gemini_enabled`` — Set to ``false`` to disable expansion even
              when a key is present.

        Server
            General server behaviour.

            - ``cors_origins`` — Allowed origins for CORS (defaults to the Vite
              dev server at ``http://localhost:5173``).
            - ``debug`` — Enable debug mode.
            - ``upload_max_size_mb`` — Maximum ontology file upload size in
              megabytes (default 250).
    """

    memgraph_uri: str = "bolt://localhost:7687"
    memgraph_user: str = ""
    memgraph_password: str = ""

    embedding_local: bool = True
    embedding_model_name: str = "BAAI/bge-small-en-v1.5"
    embedding_hf_token: str = ""
    embedding_enabled: bool = True

    gemini_api_key: str = ""
    gemini_model: str = ""
    gemini_enabled: bool = True

    key_cache_path: str = "/app/.runtime_config/keys.json"

    cors_origins: list[str] = ["http://localhost:5173"]
    debug: bool = False
    upload_max_size_mb: int = 250

    # Instructs pydantic-settings to auto-load overrides from a .env file at the project root
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
