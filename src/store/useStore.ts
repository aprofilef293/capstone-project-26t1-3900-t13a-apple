import { create } from 'zustand';
import { INITIAL_NODES, INITIAL_EDGES } from '../data/mockData';

export interface GraphNode {
    id: string;
    label: string;
    type: 'Process' | 'Material' | 'Outcome';
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
    setSelectedNodeId: (id: string | null) => void;
    setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
    setSearchQuery: (query: string) => void;
    // File import
    fileName: string | null;
    importStatus: 'idle' | 'loading' | 'complete';
    importProgress: number;
    importDate: Date | null;
    startFileImport: (fileName: string) => void;
    setImportProgress: (progress: number) => void;
    completeImport: () => void;
}

export const useStore = create<ExplorerState>((set) => ({
    nodes: INITIAL_NODES,
    edges: INITIAL_EDGES,
    selectedNodeId: "n1", // Default selected to show the panel
    searchQuery: "",
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setGraphData: (nodes, edges) => set({ nodes, edges }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    // File import
    fileName: null,
    importStatus: 'idle',
    importProgress: 0,
    importDate: null,
    startFileImport: (fileName) => set({ fileName, importStatus: 'loading', importProgress: 0, importDate: new Date() }),
    setImportProgress: (progress) => set({ importProgress: progress }),
    completeImport: () => set({ importStatus: 'complete', importProgress: 100 }),
}));
