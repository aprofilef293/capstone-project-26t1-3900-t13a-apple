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
    setViewLevel: (level: number) => void;
    fetchGraphData: () => Promise<void>;
    isGraphLoading: boolean;
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
}

// Convert Graphology JSON format to our store format
const mapTestData = () => {
    const data = testData as unknown as { nodes: { key: string; attributes?: Record<string, unknown> }[]; edges: { key?: string; id?: string; source: string; target: string; attributes?: Record<string, unknown> }[] };
    const rawEdges = data.edges;
    const rawNodes = data.nodes;

    // 2. Map nodes directly from backend payload attributes
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
    selectedNodeId: null, // Removed default selection to avoid missing node errors
    searchQuery: "",
    viewLevel: 1,
    isGraphLoading: false,
    prevNodes: [],
    setPrevNodes: (prevNodes) => {
        set({ prevNodes });
    },
    setSelectedNodeId: (id) => {
        set({ selectedNodeId: id });
        updatePrevNodes(id);
    },
    setGraphData: (nodes, edges) => set({
        nodes,
        edges,
        graph: createGraph(nodes, edges)
    }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewLevel: (level) => set({ viewLevel: level }),
    fetchGraphData: async () => {
        set({ isGraphLoading: true });
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
            set({ isGraphLoading: false });
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
    toggleNodeSelection: (id: string) => set((state) => {
    let newIds;
    if (!state.isMultiSelect) {
        newIds = [id];
    } else if (state.selectedNodeIds.includes(id)) {
        newIds = state.selectedNodeIds.filter(nid => nid !== id);
    } else if (state.selectedNodeIds.length < 10) {
        newIds = [...state.selectedNodeIds, id];
    } else {
        newIds = state.selectedNodeIds;
    }
    localStorage.setItem('selectedNodeIds', JSON.stringify(newIds));
    return { selectedNodeIds: newIds };
    }),
    clearSelectedNodes: () => {
    localStorage.setItem('selectedNodeIds', JSON.stringify([]));
    set({ selectedNodeIds: [] });
    },
}));
