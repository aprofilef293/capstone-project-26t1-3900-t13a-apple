import { ChevronRight, Folder, File, ChevronDown } from "lucide-react";
import { useMemo, useState, useEffect, useDeferredValue, memo } from "react";
import { cn } from "../../lib/utils";
import { useStore } from "../../store/useStore";
import { buildHierarchyFromGraph } from "../../lib/hierarchyUtils";
import type { HierarchyNode } from "../../lib/hierarchyUtils";
import { matchesGraphFilters } from "../../lib/filterUtils";

export function HierarchyView() {
    const {
        nodes, edges, searchQuery, graphFilters, viewLevel,
        infoPanelMode,
        searchResultsExactTitle, searchResultsFuzzyTitle,
        searchResultsDescription, searchResultsSemantic,
    } = useStore();

    // Pre-filter nodes by graphFilters AND viewLevel before building the hierarchy
    const filteredNodes = useMemo(() => {
        return nodes.filter(n => {
            const level = ((n.attributes as Record<string, unknown>)?.viewLevel as number) ?? 1;
            return level >= viewLevel && matchesGraphFilters(n, graphFilters);
        });
    }, [nodes, graphFilters, viewLevel]);

    // Dynamically build the hierarchy tree from the flat graph data
    const baseHierarchyData = useMemo(() => {
        return buildHierarchyFromGraph(filteredNodes, edges);
    }, [filteredNodes, edges]);

    const deferredSearchQuery = useDeferredValue(searchQuery);

    // When advanced search results are active, collect all result node IDs
    const searchResultNodeIds = useMemo(() => {
        if (infoPanelMode !== 'search-results') return null;
        const ids = new Set<string>([
            ...searchResultsExactTitle.map(n => n.id),
            ...searchResultsFuzzyTitle.map(n => n.id),
            ...searchResultsDescription.map(n => n.id),
            ...searchResultsSemantic.map(n => n.id),
        ]);
        return ids.size > 0 ? ids : null;
    }, [infoPanelMode, searchResultsExactTitle, searchResultsFuzzyTitle, searchResultsDescription, searchResultsSemantic]);

    const hierarchyData = useMemo(() => {
        // Advanced search results mode: filter hierarchy by result node IDs
        if (searchResultNodeIds) {
            const filterByResults = (node: HierarchyNode): HierarchyNode | null => {
                const matchesResult = searchResultNodeIds.has(node.id);
                const filteredChildren = node.children
                    ? node.children.map(filterByResults).filter((c): c is HierarchyNode => c !== null)
                    : [];
                if (matchesResult || filteredChildren.length > 0) {
                    return { ...node, children: filteredChildren };
                }
                return null;
            };
            return baseHierarchyData
                .map(filterByResults)
                .filter((node): node is HierarchyNode => node !== null);
        }

        // Inline text search (typing in search bar before submitting)
        if (!deferredSearchQuery) return baseHierarchyData;
        const lowerQuery = deferredSearchQuery.toLowerCase();

        const filterNode = (node: HierarchyNode): HierarchyNode | null => {
            const matchesQuery = node.name.toLowerCase().includes(lowerQuery);

            let filteredChildren: HierarchyNode[] = [];
            if (node.children) {
                filteredChildren = node.children
                    .map(filterNode)
                    .filter((child): child is HierarchyNode => child !== null);
            }

            if (matchesQuery || filteredChildren.length > 0) {
                return {
                    ...node,
                    children: filteredChildren
                };
            }

            return null;
        };

        return baseHierarchyData
            .map(filterNode)
            .filter((node): node is HierarchyNode => node !== null);
    }, [baseHierarchyData, deferredSearchQuery, searchResultNodeIds]);

    return (
        <div className="flex h-full w-full bg-background overflow-hidden relative">
            {/* Subtle Background Grid */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] z-0"
                style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />

            <div className="flex-1 relative z-10 pt-[140px] pb-6 px-6 flex flex-col h-full pointer-events-none">
                <div className="flex-1 overflow-y-auto custom-scrollbar max-w-[800px] mx-auto w-full bg-sidebar/50 rounded-xl border border-sidebar-border p-6 shadow-sm pointer-events-auto backdrop-blur-sm">
                    <h2 className="text-lg font-semibold tracking-tight mb-4 text-sidebar-foreground">Data Ontology Hierarchy</h2>

                    {hierarchyData.length > 0 ? (
                        <div className="space-y-1">
                            {hierarchyData.map((node) => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    level={0}
                                    defaultExpanded={!!deferredSearchQuery}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                            <p className="text-sm text-sidebar-foreground/40 italic">No hierarchy data available.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Recursive Tree Node Component
const TreeNode = memo(function TreeNode({
    node,
    level,
    defaultExpanded
}: {
    node: HierarchyNode;
    level: number;
    defaultExpanded?: boolean;
}) {
    const isSelected = useStore(state => state.selectedNodeId === node.id);
    const setSelectedNodeId = useStore(state => state.setSelectedNodeId);

    const [isOpen, setIsOpen] = useState(isSelected || defaultExpanded);
    const hasChildren = node.children && node.children.length > 0;

    useEffect(() => {
        if (defaultExpanded) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsOpen(true);
        }
    }, [defaultExpanded]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedNodeId(node.id);
    };

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer text-sm transition-all duration-200 group",
                    isSelected
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                )}
                style={{ paddingLeft: `${level * 24 + 12}px` }}
                onClick={handleSelect}
            >
                <div
                    className="w-5 h-5 flex items-center justify-center shrink-0 cursor-pointer"
                    onClick={hasChildren ? handleToggle : undefined}
                >
                    {hasChildren ? (
                        isOpen ? (
                            <ChevronDown className="w-4 h-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70" />
                        )
                    ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-sidebar-border/60" />
                    )}
                </div>

                {node.type === 'folder' ? (
                    <Folder className={cn(
                        "w-4 h-4 transition-colors",
                        isOpen ? "text-blue-500" : "text-blue-500/60"
                    )} />
                ) : (
                    <File className={cn(
                        "w-4 h-4 transition-colors",
                        isSelected ? "text-blue-500" : "text-sidebar-foreground/40"
                    )} />
                )}

                <span className={cn(
                    "truncate transition-colors",
                    node.type === 'folder' && !isSelected ? "font-medium" : ""
                )}>{node.name}</span>
            </div>

            {/* Recursively render children if open */}
            {isOpen && hasChildren && (
                <div className="mt-1 overflow-hidden animate-in slide-in-from-top-1 fade-in duration-200">
                    {node.children!.map((child: HierarchyNode) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            defaultExpanded={defaultExpanded}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
