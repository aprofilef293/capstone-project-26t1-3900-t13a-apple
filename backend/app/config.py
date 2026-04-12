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

            - ``embedding_local`` — Set to ``true`` for local inference, and
              ``false`` for remote inference.
            - ``embedding_enabled`` — Set to ``false`` to disable the embedding
              service entirely (e.g. in CI or test environments where the HF API
              is unavailable).  When disabled, the ``/api/graph/embedding-search``
              endpoint returns 503.

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
    embedding_enabled: bool = True

    cors_origins: list[str] = ["http://localhost:5173"]
    debug: bool = False
    upload_max_size_mb: int = 250

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
