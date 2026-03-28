import { create } from 'zustand';
import testData from '../data/test_data.json';
import * as api from '../lib/api';
import { MultiDirectedGraph } from 'graphology';

export interface GraphNode {
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
    size: number;
    color: string;
    attributes: Record<string, unknown>;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    color: string;
}

export interface GraphFilters {
    labelKeywords: string[];
    descriptionKeywords: string[];
    minImportance: number;       // 0–1 percentile_rank threshold
    excludedColors: Set<string>; // hex colours of community clusters to hide
}

export const DEFAULT_FILTERS: GraphFilters = {
    labelKeywords: [],
    descriptionKeywords: [],
    minImportance: 0,
    excludedColors: new Set(),
};

interface ExplorerState {
    nodes: GraphNode[];
    edges: GraphEdge[];
    graph: MultiDirectedGraph;
    selectedNodeId: string | null;
    searchQuery: string;
    viewLevel: number;
    prevNodes: string[];
    setPrevNodes: (prevNodes: string[]) => void;
    setSelectedNodeId: (id: string | null) => void;
    setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
    setSearchQuery: (query: string) => void;
    searchResultsFuzzyTitle: GraphNode[],
    setSearchResultsFuzzyTitle: (results: GraphNode[]) => void,
    searchResultsDescription: GraphNode[],
    setSearchResultsDescription: (results: GraphNode[]) => void,
    searchResults: GraphNode[];
    setViewLevel: (level: number) => void;
    fetchGraphData: (isInitial?: boolean) => Promise<void>;
    isGraphLoading: boolean;
    isInitialGraphLoading: boolean;
    // File import
    fileName: string | null;
    importStatus: 'idle' | 'waiting' | 'loading' | 'complete' | 'error';
    importError: { message: string; code?: number } | string | null;
    importProgress: number;
    importDate: Date | null;
    startFileImport: (file: File) => void;
    setImportProgress: (progress: number) => void;
    completeImport: () => void;
    failImport: (error: string) => void;
    searchError: string | null;
    setSearchError: (error: string | null) => void;
    // loading spinner
    isNodeSelecting: boolean;
    setIsNodeSelecting: (val: boolean) => void;
    // multi-select toggle switch
    isMultiSelect: boolean;
    setIsMultiSelect: (val: boolean) => void;
    selectedNodeIds: string[];
    setSelectedNodeIds: (ids: string[]) => void;
    toggleNodeSelection: (id: string) => void;
    clearSelectedNodes: () => void;
    infoPanelMode: 'node-info' | 'search-results' | 'multi-select' | 'closed';
    setInfoPanelMode: (mode: 'node-info' | 'search-results' | 'multi-select' | 'closed') => void;
    // shortest path
    pathNodeIds: string[];
    pathEdgeIds: string[];
    pathLoading: boolean;
    fetchPath: () => Promise<void>;
    clearPath: () => void;
    // graph filters
    graphFilters: GraphFilters;
    setGraphFilters: (filters: Partial<GraphFilters>) => void;
    resetGraphFilters: () => void;
}

// Convert Graphology JSON format to our store format
const mapTestData = () => {
    const data = testData as unknown as { nodes: { key: string; attributes?: Record<string, unknown> }[]; edges: { key?: string; id?: string; source: string; target: string; attributes?: Record<string, unknown> }[] };
    const rawEdges = data.edges;
    const rawNodes = data.nodes;

    // Map nodes directly from backend payload attributes
    const nodes = rawNodes.map((n) => {
        const label = (n.attributes?.label as string) || n.key;

        return {
            id: n.key,
            label: label,
            type: (n.attributes?.nodeType as string) || 'Data',
            x: typeof n.attributes?.x === 'number' ? n.attributes.x : (Math.random() - 0.5) * 10,
            y: typeof n.attributes?.y === 'number' ? n.attributes.y : (Math.random() - 0.5) * 10,
            size: (n.attributes?.size as number) || 10,
            color: (n.attributes?.color as string) || '#3b82f6',
            attributes: n.attributes || {}
        };
    });

    const edges = rawEdges.map((e, index) => ({
        id: e.key || e.id || `e${index}`,
        source: e.source,
        target: e.target,
        color: (e.attributes?.color as string) || 'rgba(148, 163, 184, 0.4)'
    }));

    return { nodes, edges };
};

const createGraph = (nodes: GraphNode[], edges: GraphEdge[]) => {
    const graph = new MultiDirectedGraph();
    nodes.forEach(node => {
        graph.addNode(node.id, { ...node });
    });
    edges.forEach(edge => {
        graph.addEdge(edge.source, edge.target, { ...edge });
    });
    return graph;
};

const updatePrevNodes = (id: string | null) => {
    const prevNodes = useStore.getState().prevNodes;
    const setPrevNodes = useStore.getState().setPrevNodes;
    if (id == null) {
        setPrevNodes([]);
    } else if (prevNodes[prevNodes.length - 1] !== id) {
        prevNodes.push(id);
        setPrevNodes(prevNodes);
    }
}

// load persisted file info helper
const getPersistedFileInfo = () => {
    try {
        const errorRaw = localStorage.getItem('importError');
        return {
            fileName: localStorage.getItem('importFileName') || null,
            importStatus: (localStorage.getItem('importStatus') as ExplorerState['importStatus']) || 'idle',
            importDate: localStorage.getItem('importDate') ? new Date(localStorage.getItem('importDate')!) : null,
            importError: errorRaw ? JSON.parse(errorRaw) : null,
        };
    } catch {
        return { fileName: null, importStatus: 'idle' as const, importDate: null, importError: null };
    }
};

export const useStore = create<ExplorerState>((set) => ({
    nodes: [],
    edges: [],
    graph: new MultiDirectedGraph(),
    selectedNodeId: localStorage.getItem('selectedNodeId') || null,
    searchQuery: "",
    viewLevel: 1,
    isGraphLoading: false,
    isInitialGraphLoading: false,
    prevNodes: [],
    setPrevNodes: (prevNodes) => {
        set({ prevNodes });
    },
    setSelectedNodeId: (id) => {
        set({ selectedNodeId: id });
        localStorage.setItem('selectedNodeId', id ?? '');
        updatePrevNodes(id);
        if (id) {
            useStore.getState().setIsMultiSelect(false);
            localStorage.setItem('isMultiSelect', 'false');
            useStore.getState().setInfoPanelMode('node-info');
        }
    },
    setGraphData: (nodes, edges) => set({
        nodes,
        edges,
        graph: createGraph(nodes, edges)
    }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    searchResultsFuzzyTitle: [],
    setSearchResultsFuzzyTitle: (results) => set({ searchResultsFuzzyTitle: results }),
    searchResultsDescription: [],
    setSearchResultsDescription: (results) => set({ searchResultsDescription: results }),
    searchResults: [],
    setViewLevel: (level) => set({ viewLevel: level }),
    // graph filters
    graphFilters: DEFAULT_FILTERS,
    setGraphFilters: (filters) => set((state) => ({ graphFilters: { ...state.graphFilters, ...filters } })),
    resetGraphFilters: () => set({ graphFilters: DEFAULT_FILTERS }),
    fetchGraphData: async (isInitial = false) => {
        if (isInitial) {
            set({ isInitialGraphLoading: true });
        } else {
            set({ isGraphLoading: true });
        }
        try {
            const data = await api.fetchGraphData("/api/graph/");
            const nodes = (data.nodes || []).map((n: { key: string; attributes?: Record<string, unknown> }) => ({
                id: n.key,
                label: (n.attributes?.label as string) || n.key,
                type: (n.attributes?.nodeType as string) || 'Data',
                x: typeof n.attributes?.x === 'number' ? n.attributes.x : (Math.random() - 0.5) * 10,
                y: typeof n.attributes?.y === 'number' ? n.attributes.y : (Math.random() - 0.5) * 10,
                size: (n.attributes?.size as number) || 10,
                color: (n.attributes?.color as string) || '#3b82f6',
                attributes: n.attributes || {}
            }));
            const edges = (data.edges || []).map((e: { key?: string, id?: string, source: string, target: string, attributes?: Record<string, unknown> }, index: number) => ({
                id: e.key || e.id || `e${index}`,
                source: e.source,
                target: e.target,
                color: (e.attributes?.color as string) || 'rgba(148,163,184,0.4)'
            }));
            set({
                nodes,
                edges,
                graph: createGraph(nodes, edges)
            });
        } catch (error) {
            console.error("Error fetching graph data, falling back to test_data.json:", error);
            const { nodes, edges } = mapTestData();
            set({
                nodes,
                edges,
                graph: createGraph(nodes, edges)
            });
        } finally {
            if (isInitial) {
                set({ isInitialGraphLoading: false });
            } else {
                set({ isGraphLoading: false });
            }
        }
    },
    // File import
    fileName: getPersistedFileInfo().fileName,
    importStatus: getPersistedFileInfo().importStatus === 'loading' 
        ? 'error'  // file upload interrupted by refresh
        : getPersistedFileInfo().importStatus,
    importProgress: 0,
    importDate: getPersistedFileInfo().importDate,
    importError: getPersistedFileInfo().importError,
    startFileImport: async (file) => {
        const now = new Date();
        localStorage.setItem('importFileName', file.name);
        localStorage.setItem('importStatus', 'loading');
        localStorage.setItem('importDate', now.toISOString());
        localStorage.setItem('importError', JSON.stringify(null)); 
        set({ fileName: file.name, importStatus: 'loading', importProgress: 0, importDate: now, importError: null }); 
        
        useStore.getState().setIsMultiSelect(false);
        // simulate progress bar slowly moving toward the ceiling between real events
        let ceiling = 24;
        let simProgress = 0;
        const ticker = setInterval(() => {
            simProgress = useStore.getState().importProgress;
            if (simProgress < ceiling) {
                set({ importProgress: Math.min(simProgress + 0.5, ceiling) });
            }
        }, 100);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/ontology/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok || !response.body) {
                let errorMsg = response.statusText;
                let errorCode = response.status;
                try {
                    const errorBody = await response.json();
                    // Try to extract a message from the error body
                    if (errorBody.detail) {
                        if (Array.isArray(errorBody.detail) && errorBody.detail[0]?.msg) {
                            errorMsg = errorBody.detail[0].msg;
                        } else if (typeof errorBody.detail === "string") {
                            errorMsg = errorBody.detail;
                        }
                    }
                } catch (e) {
                    // fallback to statusText (ie. errorMsg)
                }
                localStorage.setItem('importStatus', 'error');
                localStorage.setItem('importError', JSON.stringify({ message: errorMsg, code: errorCode }));
                set({ importStatus: 'error', importError: { message: errorMsg, code: errorCode } });
                clearInterval(ticker);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith('data: ')) continue;
                    const data = JSON.parse(line.slice(6));

                    if (data.error) {
                        clearInterval(ticker);
                        const errorMsg = typeof data.error === 'string'
                            ? data.error
                            : data.error.message ?? data.error.detail ?? JSON.stringify(data.error);
                        const errorCode = data.error_code ?? undefined;
                        localStorage.setItem('importStatus', 'error');
                        localStorage.setItem('importError', JSON.stringify({ message: errorMsg, code: errorCode }));
                        set({ importStatus: 'error', importError: { message: errorMsg, code: errorCode } });
                        return;
                    }

                    // go straight to real progress, then raise the simulation ceiling
                    set({ importProgress: data.progress });
                    if (data.progress === 25) ceiling = 49;
                    if (data.progress === 50) ceiling = 74;
                    if (data.progress === 75) ceiling = 99;
                    if (data.progress === 100) {
                        clearInterval(ticker);
                        set({ importProgress: 99, importStatus: 'loading' });
                        await useStore.getState().fetchGraphData();
                        localStorage.setItem('importStatus', 'complete');
                        set({ importStatus: 'complete', importProgress: 100 });
                    }
                }
            }
        } catch (error) {
            clearInterval(ticker);
            console.error('Error importing file', error);
            localStorage.setItem('importStatus', 'error');
            localStorage.setItem('importError', JSON.stringify({ message: String(error) }));
            set({ importStatus: 'error', importError: { message: String(error) } });
        }
    },
    setImportProgress: (progress) => set({ importProgress: progress }),
    completeImport: () => set({ importStatus: 'complete', importProgress: 100 }),
    failImport: (error) => set({ importStatus: 'error', importError: error }),
    searchError: null,
    setSearchError: (error) => set({searchError: error}),
    // loading spinner
    isNodeSelecting: false,
    setIsNodeSelecting: (val) => set({ isNodeSelecting: val }),
    // multi-select toggle switch
    isMultiSelect: localStorage.getItem('isMultiSelect') === 'true',
    setIsMultiSelect: (val: boolean) => {
        localStorage.setItem('isMultiSelect', String(val));
        set({ isMultiSelect: val, ...(val && { selectedNodeId: null }) });
    },
    selectedNodeIds: JSON.parse(localStorage.getItem('selectedNodeIds') || '[]'),
    setSelectedNodeIds: (ids: string[]) => {
        localStorage.setItem('selectedNodeIds', JSON.stringify(ids));
        set({ selectedNodeIds: ids });
    },
    toggleNodeSelection: (id: string) => {
        const state = useStore.getState();
        let newIds: string[];
        if (!state.isMultiSelect) {
            newIds = [id];
        } else if (state.selectedNodeIds.includes(id)) {
            newIds = state.selectedNodeIds.filter(nid => nid !== id);
        } else if (state.selectedNodeIds.length < 10) {
            newIds = [...state.selectedNodeIds, id];
        } else {
            return;
        }
        localStorage.setItem('selectedNodeIds', JSON.stringify(newIds));
        useStore.getState().setSelectedNodeIds(newIds);
        // Re-open the panel if it was closed (e.g. after a page refresh)
        if (newIds.length > 0 && useStore.getState().infoPanelMode === 'closed') {
            useStore.getState().setInfoPanelMode('multi-select');
        }
        // Close panel if all nodes deselected
        if (newIds.length === 0) {
            useStore.getState().setInfoPanelMode('closed');
        }
        if (newIds.length >= 2) {
            setTimeout(() => useStore.getState().fetchPath(), 0);
        } else {
            set({ pathNodeIds: [], pathEdgeIds: [] });
        }
    },
    clearSelectedNodes: () => {
        localStorage.setItem('selectedNodeIds', JSON.stringify([]));
        set({ selectedNodeIds: [], pathNodeIds: [], pathEdgeIds: [] });
    },
    infoPanelMode: (() => {
        try {
            const stored = localStorage.getItem('infoPanelMode');
            if (stored === 'node-info' || stored === 'search-results' || stored === 'multi-select' || stored === 'closed') {
                return stored;
            }
            // fallback to previous logic if not set
            return (
                localStorage.getItem('isMultiSelect') === 'true' &&
                JSON.parse(localStorage.getItem('selectedNodeIds') || '[]').length > 0
            ) ? 'multi-select' : 'closed';
        } catch {
            return 'closed';
        }
    })(),
    setInfoPanelMode: (mode) => {
        localStorage.setItem('infoPanelMode', mode);
        set({ infoPanelMode: mode });
        if (mode === 'closed' || mode === 'search-results') {
            useStore.getState().setSelectedNodeId(null);
        }
        // keeping isMultiSelect aligned with infoPanelMode (should always match)
        useStore.getState().setIsMultiSelect(mode === 'multi-select');
    },
    // shortest path
    pathNodeIds: [],
    pathEdgeIds: [],
    pathLoading: false,
    clearPath: () => set({ pathNodeIds: [], pathEdgeIds: [] }),
    fetchPath: async () => {
        const { selectedNodeIds } = useStore.getState();
        if (selectedNodeIds.length < 2) {
            set({ pathNodeIds: [], pathEdgeIds: [] });
            return;
        }

        set({ pathLoading: true });
        try {
            const allNodeIds: string[] = [];
            const allEdgeIds: string[] = [];
            const seenNodes = new Set<string>();
            const seenEdges = new Set<string>();

            for (let i = 0; i < selectedNodeIds.length; i++) {
                for (let j = i + 1; j < selectedNodeIds.length; j++) {
                    const data = await api.fetchShortestPath(selectedNodeIds[i], selectedNodeIds[j]);
                    if (data) {
                        for (const n of (data.nodes || [])) {
                            const id = n.key;
                            if (!seenNodes.has(id)) {
                                seenNodes.add(id);
                                allNodeIds.push(id);
                            }
                        }
                        for (const e of (data.edges || [])) {
                            const id = e.key || e.id;
                            if (id && !seenEdges.has(id)) {
                                seenEdges.add(id);
                                allEdgeIds.push(id);
                            }
                        }
                    }
                }
            }

            set({ pathNodeIds: allNodeIds, pathEdgeIds: allEdgeIds });
        } catch (error) {
            console.error('Error fetching shortest path:', error);
            set({ pathNodeIds: [], pathEdgeIds: [] });
        } finally {
            set({ pathLoading: false });
        }
    },
}));
