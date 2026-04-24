import { useDeferredValue, useMemo } from "react";
import type { GraphNode, GraphEdge, GraphFilters } from "../store/useStore";
import { useStore } from "../store/useStore";
import { getGroups, checkMatch, hasActiveGraphFilters, matchesGraphFilters } from "./filterUtils";

type SearchMode = 'keyword' | 'semantic';
type InfoPanelMode = 'node-info' | 'search-results' | 'multi-select' | 'closed';

interface Options {
    /** Hierarchy view drops neighbors in multi-select (selected + path only). */
    hierarchyMode?: boolean;
}

/**
 * Shared visibility derivation for GraphView and HierarchyView.
 */
export function useVisibleNodeIds({ hierarchyMode = false }: Options = {}): Set<string> {
    const {
        nodes, edges, searchQuery, graphFilters, viewLevel, infoPanelMode,
        isMultiSelect, selectedNodeId, selectedNodeIds, pathNodeIds,
        searchMode, committedSearchNodeIds, searchScopeActive,
        searchResultsExactTitle, searchResultsFuzzyTitle,
        searchResultsDescription, searchResultsSemantic,
    } = useStore();

    const deferredSearchQuery = useDeferredValue(searchQuery);

    const searchMatchIds = useMemo(() => {
        if (!deferredSearchQuery) return null;
        const ids = new Set<string>();
        for (const n of searchResultsExactTitle) ids.add(n.id);
        for (const n of searchResultsFuzzyTitle) ids.add(n.id);
        for (const n of searchResultsDescription) ids.add(n.id);
        return ids.size > 0 ? ids : null;
    }, [deferredSearchQuery, searchResultsExactTitle, searchResultsFuzzyTitle, searchResultsDescription]);

    const filterMatchIds = useMemo(() => {
        if (!(isMultiSelect && hasActiveGraphFilters(graphFilters))) return null;
        const ids = new Set<string>();
        for (const node of nodes) {
            if (matchesGraphFilters(node, graphFilters)) ids.add(node.id);
        }
        return ids;
    }, [isMultiSelect, graphFilters, nodes]);

    const semanticResultIds = useMemo(() => {
        const ids = new Set<string>();
        for (const n of searchResultsSemantic) ids.add(n.id);
        return ids;
    }, [searchResultsSemantic]);

    return useMemo(() => {
        // Hierarchy multi-select short-circuit: tree shows selected + path only
        // (graph keeps neighbors for spatial context — see product decision).
        if (hierarchyMode && isMultiSelect && selectedNodeIds.length > 0) {
            return new Set<string>([...selectedNodeIds, ...pathNodeIds]);
        }
        return computeVisible({
            nodes, edges, viewLevel, graphFilters,
            selectedNodeId, isMultiSelect, selectedNodeIds, pathNodeIds,
            infoPanelMode, searchMode,
            searchQuery: deferredSearchQuery,
            searchMatchIds, semanticResultIds, filterMatchIds,
            committedSearchNodeIds, searchScopeActive,
        });
    }, [hierarchyMode, nodes, edges, viewLevel, graphFilters, selectedNodeId, isMultiSelect, selectedNodeIds, pathNodeIds, infoPanelMode, searchMode, deferredSearchQuery, searchMatchIds, semanticResultIds, filterMatchIds, committedSearchNodeIds, searchScopeActive]);
}


interface ComputeArgs {
    nodes: GraphNode[];
    edges: GraphEdge[];
    viewLevel: number;
    graphFilters: GraphFilters;
    selectedNodeId: string | null;
    isMultiSelect: boolean;
    selectedNodeIds: string[];
    pathNodeIds: string[];
    infoPanelMode: InfoPanelMode;
    searchMode: SearchMode;
    searchQuery: string;
    searchMatchIds: Set<string> | null;
    semanticResultIds: Set<string>;
    filterMatchIds: Set<string> | null;
    committedSearchNodeIds: string[];
    searchScopeActive: boolean;
}

function computeVisible(args: ComputeArgs): Set<string> {
    const {
        nodes, edges, viewLevel, graphFilters,
        selectedNodeId, isMultiSelect, selectedNodeIds, pathNodeIds,
        infoPanelMode, searchMode, searchQuery,
        searchMatchIds, semanticResultIds, filterMatchIds,
        committedSearchNodeIds, searchScopeActive,
    } = args;

    const query = searchQuery.toLowerCase();
    const labelGroups = getGroups(graphFilters.labelKeywords || []);
    const descGroups = getGroups(graphFilters.descriptionKeywords || []);
    const committedSearchSet = new Set(committedSearchNodeIds);
    const selectedSet = new Set(selectedNodeIds);
    const filterScopeActive = isMultiSelect && hasActiveGraphFilters(graphFilters);

    const isolation = computeIsolation(selectedNodeId, infoPanelMode, nodes, edges);
    const multiPath = computeMultiPath(isMultiSelect, pathNodeIds, edges);

    const visible = new Set<string>();
    for (const node of nodes) {
        const id = node.id;
        const label = String(node.label ?? "");
        const attrs = node.attributes as Record<string, unknown> | undefined;

        const matchesSearch = !!selectedNodeId
            || !query
            || (searchMode === "keyword" && (searchMatchIds ? searchMatchIds.has(id) : label.toLowerCase().includes(query)))
            || (searchMode === "semantic" && (infoPanelMode === "closed" || semanticResultIds.has(id)));

        const level = (attrs?.viewLevel as number) ?? 1;
        const matchesLabel = checkMatch(label, labelGroups);
        const matchesDesc = checkMatch(
            ((attrs?.definition as string) ?? '') +
            ((attrs?.synonyms as string[]) ?? []).join(' '),
            descGroups,
        );
        const rank = (attrs?.percentile_rank as number) ?? 0;
        const matchesImportance = rank >= graphFilters.minImportance;
        const matchesColor = !graphFilters.excludedColors.has(node.color);

        let isVisible = matchesSearch && level >= viewLevel && matchesLabel && matchesDesc && matchesImportance && matchesColor;

        if (selectedNodeId && isolation) {
            isVisible = isVisible && (
                id === selectedNodeId || isolation.community.has(id) || isolation.neighbors.has(id)
            );
        }

        if (isMultiSelect && (searchScopeActive || filterScopeActive)) {
            isVisible = selectedSet.has(id)
                || !!multiPath?.nodes.has(id)
                || committedSearchSet.has(id)
                || !!filterMatchIds?.has(id);
        } else if (isMultiSelect && multiPath) {
            isVisible = multiPath.nodes.has(id) || (multiPath.neighbors.has(id) && level >= viewLevel);
        }

        if (isVisible) visible.add(id);
    }
    return visible;
}

function computeIsolation(
    selectedNodeId: string | null,
    infoPanelMode: InfoPanelMode,
    nodes: GraphNode[],
    edges: GraphEdge[],
): { community: Set<string>; neighbors: Set<string> } | null {
    if (!selectedNodeId || infoPanelMode !== 'node-info') return null;
    const selected = nodes.find(n => n.id === selectedNodeId);
    if (!selected) return null;

    const louvain = (selected.attributes as Record<string, unknown>)?.louvain;
    const community = new Set<string>();
    if (louvain !== undefined) {
        for (const n of nodes) {
            if ((n.attributes as Record<string, unknown>)?.louvain === louvain) community.add(n.id);
        }
    }
    const neighbors = new Set<string>();
    for (const e of edges) {
        if (e.source === selectedNodeId) neighbors.add(e.target);
        else if (e.target === selectedNodeId) neighbors.add(e.source);
    }
    return { community, neighbors };
}

function computeMultiPath(
    isMultiSelect: boolean,
    pathNodeIds: string[],
    edges: GraphEdge[],
): { nodes: Set<string>; neighbors: Set<string> } | null {
    if (!isMultiSelect || pathNodeIds.length === 0) return null;
    const pathNodes = new Set<string>(pathNodeIds);
    const neighbors = new Set<string>();
    for (const e of edges) {
        if (pathNodes.has(e.source) && !pathNodes.has(e.target)) neighbors.add(e.target);
        if (pathNodes.has(e.target) && !pathNodes.has(e.source)) neighbors.add(e.source);
    }
    return { nodes: pathNodes, neighbors };
}
