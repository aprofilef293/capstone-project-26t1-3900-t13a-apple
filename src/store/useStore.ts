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
}

export const useStore = create<ExplorerState>((set) => ({
    nodes: INITIAL_NODES,
    edges: INITIAL_EDGES,
    selectedNodeId: "n1", // Default selected to show the panel
    searchQuery: "",
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setGraphData: (nodes, edges) => set({ nodes, edges }),
    setSearchQuery: (query) => set({ searchQuery: query })
}));
