import logging

from langchain_memgraph.chains.graph_qa import MemgraphQAChain
from langchain_memgraph.graphs.memgraph import Memgraph
from langchain_openai import ChatOpenAI

from app.config import Settings

logger = logging.getLogger(__name__)


class LangChainSearchService:
    """Natural-language search over the Memgraph knowledge graph.

    Uses LangChain's MemgraphQAChain to translate a user question into a
    Cypher query (via MedGemma), execute it, and return a natural-language
    answer together with the generated Cypher and raw DB results.
    """

    def __init__(self, settings: Settings):
        self._graph = Memgraph(
            url=settings.memgraph_uri,
            username=settings.memgraph_user,
            password=settings.memgraph_password,
            refresh_schema=False,
        )

        self._llm = ChatOpenAI(
            base_url=settings.medgemma_api_url,
            api_key=settings.medgemma_api_key,
            temperature=0,
        )

        self._chain = MemgraphQAChain.from_llm(
            self._llm,
            graph=self._graph,
            allow_dangerous_requests=True,
            return_intermediate_steps=True,
        )

    def refresh_schema(self) -> None:
        """Refresh the graph schema (call after ontology upload)."""
        self._graph.refresh_schema()

    def query(self, question: str) -> dict:
        """Ask a natural-language question about the ontology graph.

        Returns a dict with keys:
          - ``answer``: The LLM-generated natural-language response.
          - ``cypher``: The generated Cypher query.
          - ``context``: Raw results from Memgraph.
        """
        result = self._chain.invoke(question)

        intermediate = result.get("intermediate_steps", [])
        cypher = intermediate[0]["query"] if intermediate else ""
        context = intermediate[1]["context"] if len(intermediate) > 1 else ""

        return {
            "answer": result.get("result", ""),
            "cypher": cypher,
            "context": context,
        }
