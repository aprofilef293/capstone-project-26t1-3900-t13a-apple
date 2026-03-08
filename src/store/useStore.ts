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
    importStatus: 'idle' | 'loading' | 'complete'| 'error';
    importError: string | null;
    importProgress: number;
    importDate: Date | null;
    startFileImport: (file: File) => void;
    setImportProgress: (progress: number) => void;
    completeImport: () => void;
    failImport: (error: string) => void;
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
