from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    App-wide configuration, auto-populated from env vars or a .env file.

    Groups:
      - **Memgraph**: ``memgraph_uri``, ``memgraph_user``, ``memgraph_password``
        — Bolt connection to the graph database.
      - **MedGemma**: ``medgemma_api_url``, ``medgemma_api_key``
        — external medical-image model endpoint (unused until upload feature lands).
      - **Server**: ``cors_origins`` (defaults to the Vite dev server),
        ``debug``, ``upload_max_size_mb``.
    """

    memgraph_uri: str = "bolt://localhost:7687"
    memgraph_user: str = ""
    memgraph_password: str = ""

    medgemma_api_url: str = ""
    medgemma_api_key: str = ""

    cors_origins: list[str] = ["http://localhost:5173"]

    debug: bool = False
    upload_max_size_mb: int = 250

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
