import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import Fuse from "fuse.js";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";

export function ExplorerSearch() {
    const {
        searchQuery,
        setSearchQuery,
        setViewLevel,
        nodes,
        setSelectedNodeId,
        updateSearchResults,
        setInfoPanelMode
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

    // Build the Fuse index whenever nodes change
    const fuse = useMemo(() => new Fuse(nodes, {
        keys: [
            { name: "label", weight: 0.7 },
            { name: "id", weight: 0.3 },
        ],
        threshold: 0.4,       // 0 = exact, 1 = match anything; 0.4 is inbetween
        includeScore: true,
        minMatchCharLength: 1,
        ignoreLocation: true,
    }), [nodes]);

    // Run the fuzzy search on every query change
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return fuse.search(searchQuery).slice(0, 50).map(r => r.item);
    }, [fuse, searchQuery]);

    const handleSearchTrigger = () => {
        if (searchQuery.trim()) {
            updateSearchResults();
            setInfoPanelMode('search-results');
            setIsOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-lg pointer-events-auto mx-auto group">
            <div className="w-full bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-1.5 flex items-center gap-2 shadow-sm transition-colors">
                <div className="flex-1 flex items-center gap-2 px-3 h-8">
                    <Search className="w-4 h-4 text-sidebar-foreground/70 cursor-pointer hover:text-sidebar-foreground transition-colors" onClick={handleSearchTrigger} />
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
                </div>
                <Button
                    onClick={handleSearchTrigger}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-blue-500/10"
                >
                    <Search className="w-4 h-4 text-sidebar-foreground/70" />
                </Button>
            </div>

            {/* Render dropdown if open and query is not empty */}
            {isOpen && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-sidebar border border-sidebar-border rounded-lg shadow-lg overflow-hidden z-[100] max-h-[400px] flex flex-col pointer-events-auto">
                    {searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-sidebar-foreground/70">
                            No quick matches for "{searchQuery}". Press Enter for deep search.
                        </div>
                    ) : (
                        <div className="overflow-y-auto py-2 custom-scrollbar">
                            {searchResults.map((node) => (
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
                                    <div className="ml-2 px-1.5 py-0.5 rounded bg-sidebar-accent/50 text-[10px] uppercase font-semibold text-sidebar-foreground/60 shrink-0">
                                        {node.type || 'Node'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

