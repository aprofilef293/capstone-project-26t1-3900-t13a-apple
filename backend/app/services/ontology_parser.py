"""Ontology file parser for OBO and OWL formats using the Pronto library.

:author: aprofilef293
"""

import pronto

from app.models.upload import OntologyRelation, OntologyTerm


def parse_ontology(file_path: str) -> tuple[list[OntologyTerm], list[OntologyRelation]]:
    """Parse an OBO or OWL ontology file and extract terms and relations.

    Uses the Pronto library to read the file from disk. For each term,
    extracts its metadata (name, namespace, definition, synonyms, xrefs,
    obsolete status) and its relationships (is_a parents and other
    relations like part_of, regulates, etc.).

    Args:
        file_path: Path to the ontology file on disk (.obo or .owl).

    Returns:
        A tuple of (terms, relations) where terms is a list of
        OntologyTerm models and relations is a list of
        OntologyRelation models.
    """
    ont = pronto.Ontology(file_path)
    terms: list[OntologyTerm] = []
    relations: list[OntologyRelation] = []

    # Build prefix→URL mapping from ontology idspaces metadata.
    # idspaces is Dict[str, Tuple[url_base, description]].
    idspaces: dict[str, str] = {}
    for prefix, (url_base, _desc) in (ont.metadata.idspaces or {}).items():
        idspaces[prefix] = url_base

    def _term_url(term_id: str) -> str | None:
        """Derive the full URL for an ontology term ID."""
        if term_id.startswith("http://") or term_id.startswith("https://"):
            return term_id
        if ":" in term_id:
            prefix, local = term_id.split(":", 1)
            if prefix in idspaces:
                return f"{idspaces[prefix]}{local}"
        # Fallback: standard OBO PURL (GO:0008150 → http://purl.obolibrary.org/obo/GO_0008150)
        return f"http://purl.obolibrary.org/obo/{term_id.replace(':', '_')}"

    for term in ont.terms():
        terms.append(
            OntologyTerm(
                id=term.id,
                # Fall back to the raw ID if the term has no human-readable name
                name=term.name or term.id,
                namespace=term.namespace,
                definition=str(term.definition) if term.definition else None,
                synonyms=[str(s.description) for s in term.synonyms],
                xrefs=[str(x) for x in term.xrefs],
                comment=term.comment if term.comment else None,
                is_obsolete=term.obsolete,
                url=_term_url(term.id),
            )
        )

        # is_a relationships (direct parents only)
        # distance=1 restricts to direct parents — transitive ancestors are inferred from the graph
        for parent in term.superclasses(distance=1, with_self=False):
            relations.append(
                OntologyRelation(
                    subject_id=term.id,
                    relation_type="is_a",
                    object_id=parent.id,
                )
            )

        # Other relationships (part_of, regulates, etc.)
        for rel_type, targets in term.relationships.items():
            for target in targets:
                relations.append(
                    OntologyRelation(
                        subject_id=term.id,
                        relation_type=rel_type.id,
                        object_id=target.id,
                    )
                )

    return terms, relations
