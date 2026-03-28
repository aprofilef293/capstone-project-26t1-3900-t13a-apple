import { useState, useRef, useEffect } from "react";
import { Filter, X, RotateCcw } from "lucide-react";
import { useStore, DEFAULT_FILTERS } from "../../store/useStore";
import { cn } from "../../lib/utils";

// ── helpers ─────────────────────────────────────────────────────────────────

function countActiveFilters(filters: {
    labelKeyword: string;
    descriptionKeyword: string;
    minImportance: number;
}) {
    let n = 0;
    if (filters.labelKeyword.trim()) n++;
    if (filters.descriptionKeyword.trim()) n++;
    if (filters.minImportance > 0) n++;
    return n;
}

// ── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
            {children}
        </div>
    );
}

// ── main component ───────────────────────────────────────────────────────────

export function GraphFilterPanel() {
    const { graphFilters: rawFilters, setGraphFilters, resetGraphFilters } = useStore();
    const graphFilters = rawFilters ?? DEFAULT_FILTERS;
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const activeCount = countActiveFilters(graphFilters);

    return (
        <div ref={panelRef} className="relative pointer-events-auto">
            {/* Toggle button — same padding/height as the Multi-Select container */}
            <button
                id="graph-filter-toggle"
                onClick={() => setIsOpen((v) => !v)}
                className={cn(
                    "relative flex items-center justify-center w-[46px] h-[46px] rounded-lg border shadow-sm backdrop-blur-sm transition-all duration-200",
                    activeCount > 0
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                        : "bg-sidebar/95 border-sidebar-border text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
                title="Graph filters"
                aria-expanded={isOpen}
            >
                <Filter className="w-[18px] h-[18px] flex-shrink-0" />
                {activeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold border-2 border-background shadow-sm animate-in zoom-in duration-200">
                        {activeCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel — opens UPWARD to stay on screen */}
            {isOpen && (
                <div
                    id="graph-filter-panel"
                    className={cn(
                        "absolute top-full left-0 mt-2 z-50",
                        "w-72 bg-sidebar/95 backdrop-blur-md border border-sidebar-border rounded-xl shadow-xl",
                        "animate-in fade-in slide-in-from-top-2 duration-150"
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
                        <div className="flex items-center gap-2">
                            <Filter className="w-3.5 h-3.5 text-sidebar-foreground/70" />
                            <span className="text-xs font-semibold text-sidebar-foreground">Graph Filters</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {activeCount > 0 && (
                                <button
                                    onClick={resetGraphFilters}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                                    title="Reset all filters"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Reset
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="p-3.5 space-y-4">
                        {/* Keyword Filter */}
                        <div>
                            <SectionLabel>Filter by Keyword</SectionLabel>
                            <div className="relative">
                                <input
                                    id="filter-label-keyword"
                                    type="text"
                                    value={graphFilters.labelKeyword}
                                    onChange={(e) => setGraphFilters({ labelKeyword: e.target.value })}
                                    placeholder="e.g. cancer, allergy…"
                                    className="w-full bg-sidebar-accent/40 border border-sidebar-border rounded-lg px-3 py-2 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                />
                                {graphFilters.labelKeyword && (
                                    <button
                                        onClick={() => setGraphFilters({ labelKeyword: '' })}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Min importance slider */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <SectionLabel>Minimum importance</SectionLabel>
                                <span className="text-[10px] font-mono text-sidebar-foreground/70 tabular-nums">
                                    {graphFilters.minImportance > 0
                                        ? `${Math.round(graphFilters.minImportance * 100)}%`
                                        : "All"}
                                </span>
                            </div>
                            <input
                                id="filter-min-importance"
                                type="range"
                                min="0"
                                max="0.95"
                                step="0.05"
                                value={graphFilters.minImportance}
                                onChange={(e) => setGraphFilters({ minImportance: Number(e.target.value) })}
                                className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                            />
                        </div>

                        {/* Active filter summary */}
                        {activeCount > 0 && (
                            <div className="pt-2 border-t border-sidebar-border/30">
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                                    <span>{activeCount} filter{activeCount !== 1 ? "s" : ""} active</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
