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
    importError: string | null;
    importProgress: number;
    importDate: Date | null;
    startFileImport: (file: File) => void;
    setImportProgress: (progress: number) => void;
    completeImport: () => void;
    failImport: (error: string) => void;
    // loading spinner
    isNodeSelecting: boolean;
    setIsNodeSelecting: (val: boolean) => void;
}

// Convert Graphology JSON format to our store format
const mapTestData = () => {
    const rawEdges = (testData as any).edges as any[];
    const rawNodes = (testData as any).nodes as any[];

    // 2. Map nodes directly from backend payload attributes
    const nodes = rawNodes.map((n) => {
        const label = n.attributes?.label || n.key;

        return {
            id: n.key,
            label: label,
            type: n.attributes?.nodeType || 'Data',
            x: typeof n.attributes?.x === 'number' ? n.attributes.x : (Math.random() - 0.5) * 10,
            y: typeof n.attributes?.y === 'number' ? n.attributes.y : (Math.random() - 0.5) * 10,
            size: n.attributes?.size || 10, // Backend provides size, defaulting to 10
            color: n.attributes?.color || '#3b82f6', // Backend provides color, defaulting to blue
            attributes: n.attributes || {}
        };
    });

    const edges = rawEdges.map((e, index) => ({
        id: e.key || `e${index}`,
        source: e.source,
        target: e.target,
        color: e.attributes?.color || 'rgba(148, 163, 184, 0.4)' // Soft grey for edges
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
            const data = await api.fetchGraphData("/graph");
            const nodes = data.nodes || [];
            const edges = data.edges || [];
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
    fileName: null,
    importStatus: 'idle',
    importProgress: 0,
    importDate: null,
    importError: null,
    startFileImport: async (file) => {
        set({ fileName: file.name, importStatus: 'waiting', importDate: new Date() })
        const uploadData = new FormData();
        uploadData.append(
            file.name,
            file
        )
        try {
            const response = await fetch("/api/ontology/upload", {
                method: 'POST',
                body: uploadData,
            })
            if (!response.ok) {
                throw new Error(response.statusText)
            }
            set({ fileName: file.name, importStatus: 'loading', importProgress: 0, importDate: new Date() })
        } catch (error) {
            console.error("Error importing file", error);
            set({ fileName: file.name, importStatus: 'error', importDate: new Date() })
        }
    },
    setImportProgress: (progress) => set({ importProgress: progress }),
    completeImport: () => set({ importStatus: 'complete', importProgress: 100 }),
    failImport: (error) => set({ importStatus: 'error', importError: error }),
    // loading spinner
    isNodeSelecting: false,
    setIsNodeSelecting: (val) => set({ isNodeSelecting: val }),
}));
