import type { GraphNode, GraphEdge } from "../store/useStore";


export interface HierarchyNode {
    id: string;
    name: string;
    type: 'folder' | 'file';
    children?: HierarchyNode[];
}

/**
 * Transforms flat graph nodes and edges into a recursive hierarchy tree.
 * Root nodes are defined as those with no incoming edges.
 */
export function buildHierarchyFromGraph(nodes: GraphNode[], edges: GraphEdge[]): HierarchyNode[] {
    const nodeMap = new Map<string, HierarchyNode>();
    const outgoingEdges = new Map<string, string[]>();
    const incomingEdgeCount = new Map<string, number>();

    // Initial pass: Create HierarchyNode objects and maps
    nodes.forEach(node => {
        nodeMap.set(node.id, {
            id: node.id,
            name: node.label,
            // Map graph types to folder/file icons
            type: node.type === 'Material' ? 'file' : 'folder',
            children: []
        });
        incomingEdgeCount.set(node.id, 0);
    });

    // Second pass: Count incoming edges and map outgoing connections
    edges.forEach(edge => {
        if (!outgoingEdges.has(edge.source)) {
            outgoingEdges.set(edge.source, []);
        }
        outgoingEdges.get(edge.source)!.push(edge.target);

        const currentCount = incomingEdgeCount.get(edge.target) || 0;
        incomingEdgeCount.set(edge.target, currentCount + 1);
    });

    // Build the tree
    const rootNodes: HierarchyNode[] = [];
    const visited = new Set<string>();

    const attachChildren = (parent: HierarchyNode) => {
        if (visited.has(parent.id)) return;
        visited.add(parent.id);

        const childrenIds = outgoingEdges.get(parent.id) || [];
        childrenIds.forEach(childId => {
            const childNode = nodeMap.get(childId);
            if (childNode) {
                const clonedChild = { ...childNode, children: [] };
                parent.children!.push(clonedChild);
                attachChildren(clonedChild);
            }
        });
    };

    // Find roots (in-degree 0) and start recursion
    nodes.forEach(node => {
        if ((incomingEdgeCount.get(node.id) || 0) === 0) {
            const root = nodeMap.get(node.id)!;
            rootNodes.push(root);
            attachChildren(root);
        }
    });

    // If there are no roots , just return nodes with some visual structure
    if (rootNodes.length === 0 && nodes.length > 0) {
        return nodes.map(n => nodeMap.get(n.id)!);
    }

    return rootNodes;
}
