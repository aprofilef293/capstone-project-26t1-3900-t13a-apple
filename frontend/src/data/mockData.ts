import type { GraphNode, GraphEdge } from "../store/useStore";

export const INITIAL_NODES: GraphNode[] = [
    {
        id: "n1",
        label: "Polymerisation Setup Alpha",
        type: "Process",
        x: 0,
        y: 0,
        size: 20,
        color: "#2563eb", /* Blue */
        attributes: {
            "TEMP": "125°C",
            "DURATION": "4h 30m",
            "Experiment ID": "EXP-00124",
            "Operator": "Dr. S. Chen",
            "Quality Check": "Passed",
            "Notes": "Reaction proceeded slightly faster than expected. Viscosity increase observed at T+30m mark.",
            "searchScore": "0.83487"
        }
    },
    { id: "n2", label: "Monomer A", type: "Material", x: -2, y: -2, size: 12, color: "#9333ea", attributes: { "Vol": "500ml", "searchScore": "0.3" } },
    { id: "n3", label: "Catalyst B", type: "Material", x: 2, y: -2, size: 12, color: "#9333ea", attributes: { "Mass": "5g" } },
    { id: "n4", label: "Polymer X", type: "Outcome", x: 0, y: 3, size: 15, color: "#10b981", attributes: { "Yield": "98%", "searchScore": "0.6" } },
    { id: "n5", label: "Input Config", type: "Material", x: -3, y: -1, size: 10, color: "#eab308", attributes: {} },
    { id: "n6", label: "Heat Source", type: "Process", x: -2, y: -4, size: 10, color: "#ef4444", attributes: {} },
    { id: "n7", label: "Coolant", type: "Material", x: 3, y: -1, size: 10, color: "#eab308", attributes: {} }
];

export const INITIAL_EDGES: GraphEdge[] = [
    { id: "e1", source: "n2", target: "n1", color: "#334155" },
    { id: "e2", source: "n3", target: "n1", color: "#334155" },
    { id: "e3", source: "n1", target: "n4", color: "#334155" },
    { id: "e4", source: "n5", target: "n2", color: "#334155" },
    { id: "e5", source: "n6", target: "n2", color: "#334155" },
    { id: "e6", source: "n7", target: "n3", color: "#334155" }
];
