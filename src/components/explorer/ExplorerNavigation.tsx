import { ListTree, Network, type LucideIcon } from "lucide-react";
import { useMemo, useDeferredValue } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { ExplorerSearch } from "./ExplorerSearch";

const VIEW_MODES: { mode: "graph" | "hierarchy"; label: string; icon: LucideIcon }[] = [
    { mode: "graph", label: "Graph", icon: Network },
    { mode: "hierarchy", label: "Hierarchy", icon: ListTree },
];

import { useStore } from "../../store/useStore";

export function ExplorerToolbar({
    viewMode,
    onViewModeChange
}: {
    viewMode: "graph" | "hierarchy";
    onViewModeChange: (mode: "graph" | "hierarchy") => void;
}) {
    const { nodes, edges, viewLevel, searchQuery } = useStore();

    const deferredSearchQuery = useDeferredValue(searchQuery);

    // Calculate visible stats based on current filters
    const { visibleNodeCount, visibleEdgeCount } = useMemo(() => {
        const lowerQuery = deferredSearchQuery.toLowerCase();
        const visibleNodes = nodes.filter(n => {
            const nodeViewLevel = (n.attributes as Record<string, unknown>)?.viewLevel;
            const level = typeof nodeViewLevel === 'number' ? nodeViewLevel : 1;
            return level >= viewLevel &&
                (!deferredSearchQuery || (n.label || "").toLowerCase().includes(lowerQuery));
        });

        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

        // Edges are only visible if both source and target are visible
        const visibleEdges = edges.filter(e =>
            visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
        );

        return { visibleNodeCount: visibleNodes.length, visibleEdgeCount: visibleEdges.length };
    }, [nodes, edges, viewLevel, deferredSearchQuery]);

    return (
        <div className="absolute top-6 left-6 right-6 z-20 flex gap-4 pointer-events-none transition-all duration-300">
            {/* View Toggles */}
            <div className="flex bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-1.5 shadow-sm pointer-events-auto">
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
            <ExplorerSearch />

            {/* Metrics Badge */}
            <div className="absolute right-0 top-0 bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg px-2.5 py-1.5 shadow-sm text-[10px] sm:text-xs font-medium flex flex-col items-end gap-0.5 text-muted-foreground pointer-events-auto leading-tight">
                <span><strong className="text-foreground">{visibleNodeCount.toLocaleString()}</strong> Nodes</span>
                <span><strong className="text-foreground">{visibleEdgeCount.toLocaleString()}</strong> Connections</span>
            </div>
        </div>
    );
}
