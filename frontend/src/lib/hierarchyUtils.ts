import type { GraphNode, GraphEdge } from "../store/useStore";

export interface HierarchyNode {
    id: string;
    name: string;
    type: 'folder' | 'file';
    children?: HierarchyNode[];
    isSynthetic?: boolean;
}

const ROOT_BUCKET_THRESHOLD = 300;

export function buildHierarchyFromGraph(nodes: GraphNode[], edges: GraphEdge[]): HierarchyNode[] {
    // Edges are specific → general (is-a), so edge.target is the parent.
    const nodeMap = new Map<string, HierarchyNode>();
    const childrenByParent = new Map<string, string[]>();
    const hasParent = new Set<string>();

    for (const node of nodes) {
        nodeMap.set(node.id, {
            id: node.id,
            name: node.label,
            type: node.type === 'Material' ? 'file' : 'folder',
            children: [],
        });
    }

    for (const { source: child, target: parent } of edges) {
        const bucket = childrenByParent.get(parent);
        if (bucket) bucket.push(child);
        else childrenByParent.set(parent, [child]);
        hasParent.add(child);
    }

    const visited = new Set<string>();
    const attach = (parent: HierarchyNode): void => {
        if (visited.has(parent.id)) return;
        visited.add(parent.id);
        for (const childId of childrenByParent.get(parent.id) ?? []) {
            const childNode = nodeMap.get(childId);
            if (!childNode) continue;
            const clone = { ...childNode, children: [] };
            parent.children!.push(clone);
            attach(clone);
        }
    };

    const rootNodes: HierarchyNode[] = [];
    for (const node of nodes) {
        if (!hasParent.has(node.id)) {
            const root = nodeMap.get(node.id)!;
            rootNodes.push(root);
            attach(root);
        }
    }

    // If there are no roots, treat all nodes as roots (disconnected scatter plot)
    if (rootNodes.length === 0 && nodes.length > 0) {
        rootNodes.push(...nodes.map(n => nodeMap.get(n.id)!));
    }

    if (rootNodes.length > ROOT_BUCKET_THRESHOLD) {
        return bucketRootsAlphabetically(rootNodes);
    }
    return rootNodes;
}

function bucketRootsAlphabetically(rootNodes: HierarchyNode[]): HierarchyNode[] {
    const buckets = new Map<string, HierarchyNode>();
    for (const node of rootNodes) {
        const firstChar = (node.name || '').charAt(0).toUpperCase();
        const key = /[A-Z]/.test(firstChar) ? firstChar : '#';
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = {
                id: `group-${key}`,
                name: `Library ${key}`,
                type: 'folder',
                children: [],
                isSynthetic: true,
            };
            buckets.set(key, bucket);
        }
        bucket.children!.push(node);
    }
    return Array.from(buckets.values()).sort((a, b) => {
        if (a.name === 'Library #') return 1;
        if (b.name === 'Library #') return -1;
        return a.name.localeCompare(b.name);
    });
}
