import { ListTree, Network, type LucideIcon } from "lucide-react";
import { useMemo, useDeferredValue } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { ExplorerSearch } from "./ExplorerSearch";
import { Switch } from "../ui/switch";
import { useStore } from "../../store/useStore";

const VIEW_MODES: { mode: "graph" | "hierarchy"; label: string; icon: LucideIcon }[] = [
    { mode: "graph", label: "Graph", icon: Network },
    { mode: "hierarchy", label: "Hierarchy", icon: ListTree },
];


export function ExplorerToolbar({
    viewMode,
    onViewModeChange
}: {
    viewMode: "graph" | "hierarchy";
    onViewModeChange: (mode: "graph" | "hierarchy") => void;
}) {
    const { nodes, edges, viewLevel, searchQuery, selectedNodeId } = useStore();
    const { isMultiSelect, setIsMultiSelect, setInfoPanelMode } = useStore();

    const deferredSearchQuery = useDeferredValue(searchQuery);

    // Calculate visible stats based on current filters and community isolation
    const { visibleNodeCount, visibleEdgeCount } = useMemo(() => {
        const lowerQuery = deferredSearchQuery.toLowerCase();
        const baseFilteredNodes = nodes.filter(n => {
            const level = ((n.attributes as Record<string, unknown>)?.viewLevel as number) ?? 1;
            const matchesSearch = !!selectedNodeId || !lowerQuery || (n.label || "").toLowerCase().includes(lowerQuery);
            return level >= viewLevel && matchesSearch;
        });

        let finalNodeIds: Set<string>;

        if (selectedNodeId) {
            const selectedNode = nodes.find(n => n.id === selectedNodeId);
            if (!selectedNode) {
                finalNodeIds = new Set(baseFilteredNodes.map(n => n.id));
            } else {
                const selectedLouvain = (selectedNode.attributes as Record<string, unknown>)?.louvain;

                const relatedIds = new Set<string>();
                relatedIds.add(selectedNodeId);

                // Add neighbors
                for (const edge of edges) {
                    if (edge.source === selectedNodeId) relatedIds.add(edge.target);
                    else if (edge.target === selectedNodeId) relatedIds.add(edge.source);
                }

                // Add community members
                if (selectedLouvain !== undefined) {
                    for (const node of nodes) {
                        if ((node.attributes as Record<string, unknown>)?.louvain === selectedLouvain) {
                            relatedIds.add(node.id);
                        }
                    }
                }
                const visibleIds = baseFilteredNodes
                    .filter(n => relatedIds.has(n.id))
                    .map(n => n.id);
                finalNodeIds = new Set(visibleIds);
            }
        } else {
            finalNodeIds = new Set(baseFilteredNodes.map(n => n.id));
        }

        // Edges are only visible if both source and target are visible
        const visibleEdges = edges.filter(e =>
            finalNodeIds.has(e.source) && finalNodeIds.has(e.target)
        );

        return { visibleNodeCount: finalNodeIds.size, visibleEdgeCount: visibleEdges.length };
    }, [nodes, edges, viewLevel, deferredSearchQuery, selectedNodeId]);

    return (
        <div className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between gap-4 pointer-events-none transition-all duration-300">
            <div className="flex flex-col gap-3 flex-1">
                <div className="flex gap-4 w-full">
                    {/* View Toggles */}
                    <div className="flex shrink-0 bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-1.5 shadow-sm pointer-events-auto">
                        {VIEW_MODES.map(({ mode, label, icon: Icon }) => (
                            <Button
                                key={mode}
                                variant="ghost"
                                onClick={() => onViewModeChange(mode)}
                                className={cn(
                                    "h-8 px-3 text-xs font-medium gap-2",
                                    viewMode === mode
                                        ? "bg-blue-500/10 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400"
                                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                )}
                            >
                                <Icon className="w-4 h-4" /> {label}
                            </Button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 flex justify-center min-w-0">
                        <ExplorerSearch />
                    </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex items-center self-start bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-3 shadow-sm pointer-events-auto gap-2 mt-1 w-fit">
                    <span className="text-xs font-medium text-sidebar-foreground/80">Multi-Select</span>
                    <Switch
                        checked={isMultiSelect}
                        onCheckedChange={(val) => {
                            setIsMultiSelect(val);
                            if (val) setInfoPanelMode('multi-select');
                            if (!val) setInfoPanelMode('closed');
                        }}
                        aria-label="Toggle multi-select mode"
                    />
                </div>
            </div>

            {/* Metrics Badge */}
            <div className="bg-sidebar/95 shrink-0 backdrop-blur-sm border border-sidebar-border rounded-lg px-2.5 py-1.5 shadow-sm text-[10px] sm:text-xs font-medium flex flex-col items-end gap-0.5 text-muted-foreground pointer-events-auto leading-tight">
                <span><strong className="text-foreground">{visibleNodeCount.toLocaleString()}</strong> Nodes</span>
                <span><strong className="text-foreground">{visibleEdgeCount.toLocaleString()}</strong> Connections</span>
            </div>
        </div>
    );
}
