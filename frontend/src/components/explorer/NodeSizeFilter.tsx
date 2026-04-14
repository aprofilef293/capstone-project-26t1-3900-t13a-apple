import { useState } from "react";
import { useStore } from "../../store/useStore";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { InfoHelpIcon } from "../InfoHelpIcon";


export function NodeSizeFilter() {
    const { viewLevel, setViewLevel } = useStore();
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div
            className={cn(
                "group flex items-center bg-sidebar/90 backdrop-blur-sm border border-sidebar-border rounded-lg shadow-sm transition-all duration-300 ease-out h-9 pointer-events-auto",
                isExpanded ? "w-52 px-3 gap-3 overflow-visible" : "w-10 overflow-hidden justify-center hover:bg-sidebar-accent cursor-pointer"
            )}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <SlidersHorizontal className={cn(
                    "w-[15px] h-[15px] transition-all absolute",
                    isExpanded
                        ? "text-foreground opacity-100 scale-100"
                        : "text-muted-foreground opacity-0 scale-50"
                )} />
                <span className={cn(
                    "text-[11px] font-bold transition-all absolute tabular-nums",
                    isExpanded
                        ? "opacity-0 scale-150"
                        : "text-foreground opacity-100 scale-100"
                )}>
                    L{viewLevel}
                </span>
            </div>

            <div className={cn(
                "flex-1 flex gap-2 items-center justify-center transition-opacity duration-200 min-w-0 h-full",
                isExpanded ? "opacity-100" : "opacity-0 w-0 hidden"
            )}>
                <div className="flex flex-col">
                    <div className="flex items-center justify-center text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        <span className="text-foreground font-bold">Level {viewLevel}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={viewLevel}
                        onChange={(e) => setViewLevel(Number(e.target.value))}
                        className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                        title={`View Level: ${viewLevel >= 5 ? 'Hubs (5)' : viewLevel <= 1 ? 'All Nodes (1)' : viewLevel}`}
                    />
                </div>
                <InfoHelpIcon innerText={<p>Slide right to hide less-connected nodes and focus on the core structure.</p>} iconSize="w-7 h-7" boxWidth="w-65" side="top" align="end" />
            </div>
        </div>
    );
}
