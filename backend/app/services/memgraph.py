from neo4j import Driver, GraphDatabase

from app.config import Settings


class MemgraphService:
    def __init__(self, settings: Settings):
        auth = (settings.memgraph_user, settings.memgraph_password) if settings.memgraph_user else None
        self._driver: Driver = GraphDatabase.driver(settings.memgraph_uri, auth=auth)

    def close(self):
        self._driver.close()

    def execute_read(self, cypher: str, params: dict | None = None) -> list[dict]:
        with self._driver.session() as session:
            result = session.run(cypher, params or {})
            return [record.data() for record in result]

    def execute_write(self, cypher: str, params: dict | None = None) -> list[dict]:
        with self._driver.session() as session:
            result = session.run(cypher, params or {})
            return [record.data() for record in result]

    def verify_connectivity(self) -> bool:
        try:
            self._driver.verify_connectivity()
            return True
        except Exception:
            return False
