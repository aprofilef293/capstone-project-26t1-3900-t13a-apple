import { ListTree, Network, type LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { ExplorerSearch } from "./ExplorerSearch";

/* Config-driven toggle buttons instead of duplicated JSX */
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
        </div>
    );
}
