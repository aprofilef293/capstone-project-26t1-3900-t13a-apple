from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    memgraph_uri: str = "bolt://localhost:7687"
    memgraph_user: str = ""
    memgraph_password: str = ""

    medgemma_api_url: str = ""
    medgemma_api_key: str = ""

    cors_origins: list[str] = ["http://localhost:5173"]

    debug: bool = False
    upload_max_size_mb: int = 50

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
