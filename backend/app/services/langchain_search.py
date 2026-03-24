import logging
import re
from typing import Any, Dict, List

from langchain_core.prompts import PromptTemplate
from langchain_memgraph.chains.graph_qa import MemgraphQAChain
from langchain_memgraph import MemgraphLangChain
from langchain_openai import ChatOpenAI

from app.config import Settings

CYPHER_PROMPT = PromptTemplate(
    input_variables=["schema", "question"],
    template="""You are a Cypher query generator for a Memgraph ontology database.
Output ONLY the Cypher query. No explanations, no markdown, no backticks.

Schema:
{schema}

RULES:
1. NEVER use directed arrows -> or <-. ALWAYS use undirected: -[r:RELATES_TO]-
2. The `id` property stores ontology IDs (e.g. "GO:0006915", "BFO:0000002"). The `name` property stores human labels (e.g. "apoptosis", "continuant").
3. If the user mentions something with ":" (an ID), match on `id`. Otherwise match on `name`.
4. For partial/fuzzy name matching use: toLower(n.name) CONTAINS toLower("term")
7. ALWAYS use the EXACT term the user provides. NEVER shorten, rephrase, or drop words from the user's input.
5. For relationship direction use startNode(r) and endNode(r) in RETURN.
6. Every query MUST have a RETURN clause.

EXAMPLES:

Question: what is GO:0006915
MATCH (n:OntologyTerm) WHERE n.id = "GO:0006915" RETURN n.id, n.name, n.definition

Question: tell me about HP:0001234
MATCH (n:OntologyTerm) WHERE n.id = "HP:0001234" RETURN n.id, n.name, n.definition

Question: what is apoptosis
MATCH (n:OntologyTerm) WHERE toLower(n.name) = "apoptosis" RETURN n.id, n.name, n.definition

Question: define cell death
MATCH (n:OntologyTerm) WHERE toLower(n.name) = "cell death" RETURN n.id, n.name, n.definition

Question: list all terms with cell in the name
MATCH (n:OntologyTerm) WHERE toLower(n.name) CONTAINS "cell" RETURN n.id, n.name

Question: find terms related to metabolism
MATCH (n:OntologyTerm) WHERE toLower(n.name) CONTAINS "metabolism" RETURN n.id, n.name

Question: relationship between X and Y
MATCH (a:OntologyTerm)-[r:RELATES_TO]-(b:OntologyTerm) WHERE toLower(a.name) = toLower("X") AND toLower(b.name) = toLower("Y") RETURN startNode(r).name AS from_node, r.type AS relationship, endNode(r).name AS to_node, startNode(r).id AS from_id, endNode(r).id AS to_id

Question: what are the subtypes of some term
MATCH (a:OntologyTerm)-[r:RELATES_TO]-(b:OntologyTerm) WHERE toLower(a.name) = toLower("some term") RETURN startNode(r).name AS from_node, r.type AS relationship, endNode(r).name AS to_node

Question: what is the parent of some term
MATCH (a:OntologyTerm)-[r:RELATES_TO]-(b:OntologyTerm) WHERE toLower(a.name) = toLower("some term") RETURN startNode(r).name AS from_node, r.type AS relationship, endNode(r).name AS to_node

Question: what is connected to some term
MATCH (a:OntologyTerm)-[r:RELATES_TO]-(b:OntologyTerm) WHERE toLower(a.name) = toLower("some term") RETURN a.id, a.name, r.type, b.id, b.name

Question: list all nodes related to some term
MATCH (a:OntologyTerm)-[r:RELATES_TO]-(b:OntologyTerm) WHERE toLower(a.name) = toLower("some term") RETURN a.id, a.name, r.type, b.id, b.name

Question: which nodes have definitions
MATCH (n:OntologyTerm) WHERE n.definition IS NOT NULL RETURN n.id, n.name, n.definition

Question: which terms have no definition
MATCH (n:OntologyTerm) WHERE n.definition IS NULL RETURN n.id, n.name

Question: give me the definition of relational quality
MATCH (n:OntologyTerm) WHERE toLower(n.name) CONTAINS "relational quality" RETURN n.id, n.name, n.definition

Question: give me the definition of some term
MATCH (n:OntologyTerm) WHERE toLower(n.name) CONTAINS toLower("some term") RETURN n.id, n.name, n.definition

Question: how many nodes are there
MATCH (n:OntologyTerm) RETURN count(n) AS total_nodes

Question: how many relationships does some term have
MATCH (n:OntologyTerm)-[r:RELATES_TO]-() WHERE toLower(n.name) = toLower("some term") RETURN n.name, count(r) AS total_relationships

Question: which node has the most relationships
MATCH (n:OntologyTerm)-[r:RELATES_TO]-() RETURN n.id, n.name, count(r) AS total ORDER BY total DESC LIMIT 1

Question: show me all terms
MATCH (n:OntologyTerm) RETURN n.id, n.name

Question: how are X and Y related
MATCH path = (a:OntologyTerm)-[:RELATES_TO*1..5]-(b:OntologyTerm) WHERE toLower(a.name) = toLower("X") AND toLower(b.name) = toLower("Y") RETURN [node IN nodes(path) | node.name] AS path_names LIMIT 5

Question: what are all the relationship types
MATCH ()-[r:RELATES_TO]-() RETURN DISTINCT r.type AS relationship_type, count(r) AS count

Question: list terms from source file example.owl
MATCH (n:OntologyTerm) WHERE n.source_file = "example.owl" RETURN n.id, n.name

Question: {question}
"""
)


def _clean_cypher(query: str) -> str:
    """Strip markdown language tags the LLM may prepend to Cypher output."""
    return re.sub(r"^(cypher|CYPHER)\s*\n?", "", query).strip()


class _SanitizedMemgraph(MemgraphLangChain):
    """Wraps MemgraphLangChain to sanitize Cypher before execution."""

    def query(self, query: str, params: dict = {}) -> List[Dict[str, Any]]:
        return super().query(_clean_cypher(query), params)

logger = logging.getLogger(__name__)


class LangChainSearchService:
    """Natural-language search over the Memgraph knowledge graph.

    Uses LangChain's MemgraphQAChain to translate a user question into a
    Cypher query (via LLM), execute it, and return a natural-language
    answer together with the generated Cypher and raw DB results.
    """

    def __init__(self, settings: Settings):
        self._graph = _SanitizedMemgraph(
            url=settings.memgraph_uri,
            username=settings.memgraph_user,
            password=settings.memgraph_password,
        )
        self._graph.refresh_schema()

        self._llm = ChatOpenAI(
            base_url=settings.llm_api_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            temperature=0,
        )

        self._chain = MemgraphQAChain.from_llm(
            self._llm,
            graph=self._graph,
            cypher_prompt=CYPHER_PROMPT,
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
        # Strip markdown language tags (e.g. "cypher\n") the LLM may prepend
        cypher = re.sub(r"^(cypher|CYPHER)\s*\n?", "", cypher).strip()
        raw_context = intermediate[1]["context"] if len(intermediate) > 1 else ""
        context = str(raw_context) if not isinstance(raw_context, str) else raw_context

        return {
            "answer": result.get("result", ""),
            "cypher": cypher,
            "context": context,
        }
