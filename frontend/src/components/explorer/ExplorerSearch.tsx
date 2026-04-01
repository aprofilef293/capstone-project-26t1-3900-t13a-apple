import { useState, useMemo, useRef, useEffect } from "react";
import { DatabaseSearch, Search, WholeWord, X, type LucideIcon } from "lucide-react";
import Fuse from "fuse.js";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";
import { matchesGraphFilters } from "../../lib/filterUtils";
import { cn } from "../../lib/utils";

const SEARCH_MODES: { mode: 'keyword' | 'semantic'; label: string; Icon: LucideIcon; }[] = [
    { mode: "keyword", label: "Keyword", Icon: WholeWord },
    { mode: "semantic", label: "Advanced", Icon: DatabaseSearch },
];

export function ExplorerSearch({ viewMode = "graph" }: { viewMode?: "graph" | "hierarchy" }) {
    const {
        searchQuery,
        setSearchQuery,
        setViewLevel,
        nodes,
        setSelectedNodeId,
        setSearchResultsFuzzyTitle,
        setSearchResultsDescription,
        doSemanticSearch,
        infoPanelMode,
        setInfoPanelMode,
        graphFilters,
        searchMode,
        setSearchMode,
    } = useStore();

    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Handle outside clicks to close the dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredNodes = useMemo(
        () => nodes.filter(node => matchesGraphFilters(node, graphFilters)),
        [nodes, graphFilters]
    );

    const fuse = useMemo(() => new Fuse(filteredNodes, {
        keys: [
            { name: "label", weight: 0.7 },
            { name: "id", weight: 0.3 },
        ],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 1,
        ignoreLocation: true,
    }), [filteredNodes]);

    // Search Method: fuzzy on names, exact substring on descriptions/synonyms
    const { fuzzyResults, descriptionResults } = useMemo(() => {
        if (searchMode === "semantic") {
            return {fuzzyResults: [], descriptionResults: []};
        }

        const q = searchQuery.trim();
        if (!q) {
            return { fuzzyResults: [], descriptionResults: [] };
        }

        // Fuzzy search on label / id - ie can have typos
        const fuzzyHits = fuse.search(q).slice(0, 50).map(r => r.item);
        const fuzzyIds = new Set(fuzzyHits.map(n => n.id));

        // Exact substring search on definition + synonyms
        // Only runs if query is at least 3 chars to reduce matches
        const descHits = q.length >= 3
            ? filteredNodes.filter(node => {
                if (fuzzyIds.has(node.id)) return false; // already in fuzzy results
                const ql = q.toLowerCase();
                const def = ((node.attributes.definition as string) ?? "").toLowerCase();
                const syns: string[] = (node.attributes.synonyms as string[]) ?? [];
                return (
                    def.includes(ql) ||
                    syns.some(s => s.toLowerCase().includes(ql))
                );
            }).slice(0, 20)
            : [];

        return { fuzzyResults: fuzzyHits, descriptionResults: descHits };
    }, [fuse, filteredNodes, searchQuery]);

    // Sync results to store in an effect (not during render)
    useEffect(() => {
        setSearchResultsFuzzyTitle(fuzzyResults);
        setSearchResultsDescription(descriptionResults);
    }, [fuzzyResults, descriptionResults, setSearchResultsFuzzyTitle, setSearchResultsDescription]);

    const searchResults = useMemo(
        () => [...fuzzyResults, ...descriptionResults],
        [fuzzyResults, descriptionResults]
    );

    const handleSearchTrigger = () => {
        if (searchQuery.trim()) {
            setInfoPanelMode('search-results');
            setIsOpen(false);
        }
        if (searchMode === "semantic") {
            doSemanticSearch();
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-lg pointer-events-auto mx-auto group">
            <div className="w-full bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-1.5 flex items-center gap-2 shadow-sm transition-colors">
                <div className="flex-1 flex items-center gap-2 px-3 h-8">
                    <input
                        type="text"
                        value={searchQuery}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearchTrigger();
                            }
                        }}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsOpen(true);
                            if (e.target.value) setViewLevel(1);
                        }}
                        placeholder="Search nodes..."
                        className="w-full bg-transparent border-none text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:outline-none focus:ring-0"
                    />
                </div>
                {searchQuery && (
                    <Button
                        onClick={() => {
                            setSearchQuery("");
                            setIsOpen(false);
                            setViewLevel(1);
                            setInfoPanelMode('closed');
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-sidebar-accent"
                    >
                        <X className="w-4 h-4 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors" />
                    </Button>
                )}
                <Button
                    onClick={handleSearchTrigger}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-blue-500/10"
                >
                    <Search className="w-4 h-4 text-sidebar-foreground/70" />
                </Button>

                {/* Search Mode Toggles */}
                <div className="flex shrink-0 bg-sidebar/95 backdrop-blur-sm rounded-lg shadow-sm pointer-events-auto">
                    {SEARCH_MODES.map(({ mode, label, Icon }) => (
                        <Button
                            key={mode}
                            variant="ghost"
                            onClick={() => {
                                setInfoPanelMode('closed');
                                setSearchMode(mode);
                            }}
                            className={cn(
                                "h-8 px-3 text-xs font-medium gap-2",
                                searchMode === mode
                                    ? "bg-blue-500/10 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400"
                                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                        >
                            <Icon /> {infoPanelMode === "closed" && label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Render dropdown if open and query is not empty (not in hierarchy view) */}
            {isOpen && searchQuery.trim() && viewMode !== "hierarchy" && searchMode === "keyword" && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-sidebar border border-sidebar-border rounded-lg shadow-lg overflow-hidden z-[100] max-h-[400px] flex flex-col pointer-events-auto">
                    {searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-sidebar-foreground/70">
                            No quick matches for "{searchQuery}". Please try Advanced Search.
                        </div>
                    ) : (
                        <div className="overflow-y-auto py-2 custom-scrollbar">
                            {searchResults.map((node) => {
                                const isDescMatch = !fuzzyResults.some(r => r.id === node.id);
                                return (
                                    <button
                                        key={node.id}
                                        onClick={() => {
                                            setSelectedNodeId(node.id);
                                            setIsOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm flex items-center gap-3"
                                    >
                                        <div
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                                            style={{ backgroundColor: node.color }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sidebar-foreground truncate" title={node.label}>
                                                {node.label || node.id}
                                            </div>
                                            {node.label && node.id !== node.label && (
                                                <div className="text-xs text-sidebar-foreground/50 truncate max-w-full" title={node.id}>
                                                    ID: {node.id}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isDescMatch && (
                                                <div className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] uppercase font-semibold text-amber-600 dark:text-amber-400">
                                                    desc
                                                </div>
                                            )}
                                            <div className="px-1.5 py-0.5 rounded bg-sidebar-accent/50 text-[10px] uppercase font-semibold text-sidebar-foreground/60">
                                                {node.type || 'Node'}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

