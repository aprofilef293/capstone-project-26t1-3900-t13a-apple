from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    App-wide configuration, auto-populated from env vars or a .env file.

    Groups:
      - **Memgraph**: ``memgraph_uri``, ``memgraph_user``, ``memgraph_password``
        — Bolt connection to the graph database.
      - **LLM**: ``llm_api_url``, ``llm_api_key``, ``llm_model``
        — LLM endpoint for semantic search (Ollama or OpenAI-compatible).
      - **Server**: ``cors_origins`` (defaults to the Vite dev server),
        ``debug``, ``upload_max_size_mb``.
    """

    memgraph_uri: str = "bolt://localhost:7687"
    memgraph_user: str = ""
    memgraph_password: str = ""

    llm_api_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "gemma3"

    cors_origins: list[str] = ["http://localhost:5173"]

    debug: bool = False
    upload_max_size_mb: int = 250

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
