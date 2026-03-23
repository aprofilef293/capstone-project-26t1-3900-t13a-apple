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

    for term in ont.terms():
        terms.append(
            OntologyTerm(
                id=term.id,
                name=term.name or term.id,
                namespace=term.namespace,
                definition=str(term.definition) if term.definition else None,
                comment=str(term.comment) if term.comment else None,
                synonyms=[str(s.description) for s in term.synonyms],
                xrefs=[str(x) for x in term.xrefs],
                is_obsolete=term.obsolete,
            )
        )

        # is_a relationships (direct parents only)
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
