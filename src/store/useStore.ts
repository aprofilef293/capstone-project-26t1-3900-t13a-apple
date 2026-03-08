import { create } from 'zustand';
import testData from '../data/test_data.json';
import * as api from '../lib/api';

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
    selectedNodeId: string | null;
    searchQuery: string;
    viewLevel: number;
    setSelectedNodeId: (id: string | null) => void;
    setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
    setSearchQuery: (query: string) => void;
    setViewLevel: (level: number) => void;
    fetchGraphData: () => Promise<void>;
    // File import
    fileName: string | null;
    importStatus: 'idle' | 'loading' | 'complete' | 'error';
    importError: string | null;
    importProgress: number;
    importDate: Date | null;
    startFileImport: (file: File) => void;
    setImportProgress: (progress: number) => void;
    completeImport: () => void;
    failImport: (error: string) => void;
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
            type: n.attributes?.nodeType || 'Default',
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

export const useStore = create<ExplorerState>((set) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null, // Removed default selection to avoid missing node errors
    searchQuery: "",
    viewLevel: 1,
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setGraphData: (nodes, edges) => set({ nodes, edges }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewLevel: (level) => set({ viewLevel: level }),
    fetchGraphData: async () => {
        try {
            const data = await api.fetchGraphData("/graph");
            set({ nodes: data.nodes || [], edges: data.edges || [] });
        } catch (error) {
            console.error("Error fetching graph data, falling back to test_data.json:", error);
            const { nodes, edges } = mapTestData();
            set({ nodes, edges });
        }
    },
    // File import
    fileName: null,
    importStatus: 'idle',
    importProgress: 0,
    importDate: null,
    importError: null,
    startFileImport: async (file) => {
        const uploadData = new FormData();
        uploadData.append(
            file.name,
            file
        )
        try {
            const response = await fetch("/obo-file-upload", {
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
}));
