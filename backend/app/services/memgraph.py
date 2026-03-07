from neo4j import Driver, GraphDatabase

from app.config import Settings


class MemgraphService:
    """Synchronous Memgraph client using the Neo4j Bolt driver.

    Created once during app startup (see ``lifespan`` in main.py) and stored on
    ``app.state.memgraph`` so route handlers can query OntologyTerm nodes and
    their relationships.  Auth is optional, omitted when ``memgraph_user`` is
    empty, which is the default for local development.
    """

    def __init__(self, settings: Settings):
        auth = (settings.memgraph_user, settings.memgraph_password) if settings.memgraph_user else None
        self._driver: Driver = GraphDatabase.driver(settings.memgraph_uri, auth=auth)

    def close(self):
        """Shut down the Bolt driver, called during app shutdown in ``lifespan``."""
        self._driver.close()

    def execute_read(self, cypher: str, params: dict | None = None) -> list[dict]:
        """Execute a Cypher query intended for reads (MATCH).

        Opens a short-lived session, runs the query with optional ``params``,
        and returns every record as a plain dict via ``record.data()``.
        """
        with self._driver.session() as session:
            result = session.run(cypher, params or {})
            return [record.data() for record in result]

    def execute_write(self, cypher: str, params: dict | None = None) -> list[dict]:
        """Execute a Cypher query intended for writes (CREATE, MERGE, DELETE).

        Same mechanics as ``execute_read`` but semantically reserved for
        mutations so callers can be audited separately.
        """
        with self._driver.session() as session:
            result = session.run(cypher, params or {})
            return [record.data() for record in result]

    def verify_connectivity(self) -> bool:
        """Ping the Memgraph server and return True if it responds, False on any error."""
        try:
            self._driver.verify_connectivity()
            return True
        except Exception:
            return False
