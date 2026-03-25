import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useStore } from "../../store/useStore";

export function ExplorerSearch() {
    const { searchQuery, setSearchQuery, setViewLevel, nodes, setSelectedNodeId } = useStore();
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

    // Calculate ranked search results based on the query
    // Later will need to be updated to seamlessly support semantic, some thought will need to be put into the design
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase().trim();

        const results = nodes
            .map(node => {
                const label = (node.label || node.id).toLowerCase();
                const id = node.id.toLowerCase();

                let score = 0;
                // Highest priority: Exect match
                if (label === query || id === query) score = 4;
                // High priority: Starts with query
                else if (label.startsWith(query) || id.startsWith(query)) score = 3;
                // Medium priority: Contains query
                else if (label.includes(query)) score = 2;
                // Low priority: ID contains query
                else if (id.includes(query)) score = 1;

                return { node, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => {
                // Sort by descending score
                if (a.score !== b.score) return b.score - a.score;
                // Tiebreaker: alphabetical by label
                return (a.node.label || a.node.id).localeCompare(b.node.label || b.node.id);
            });

        return results.slice(0, 50); // Limit results
    }, [nodes, searchQuery]);

    return (
        <div ref={wrapperRef} className="relative flex-1 w-full max-w-xl pointer-events-auto mx-auto group">
            <div className="bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-1.5 flex items-center gap-2 shadow-sm transition-colors">
                <div className="flex-1 flex items-center gap-2 px-3 h-8">
                    <Search className="w-4 h-4 text-sidebar-foreground/70" />
                    <input
                        type="text"
                        value={searchQuery}
                        onFocus={() => setIsOpen(true)}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsOpen(true);
                            if (e.target.value) setViewLevel(1);
                        }}
                        placeholder="Search nodes..."
                        className="w-full bg-transparent border-none text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:outline-none focus:ring-0"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery("");
                                setIsOpen(false);
                                setViewLevel(1);
                            }}
                            className="focus:outline-none"
                        >
                            <X className="w-4 h-4 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors" />
                        </button>
                    )}
                </div>
            </div>

            {/* Render dropdown if open and query is not empty */}
            {isOpen && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-sidebar border border-sidebar-border rounded-lg shadow-lg overflow-hidden z-[100] max-h-[400px] flex flex-col pointer-events-auto">
                    {searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-sidebar-foreground/70">
                            No results found for "{searchQuery}"
                        </div>
                    ) : (
                        <div className="overflow-y-auto py-2 custom-scrollbar">
                            {searchResults.map(({ node }) => (
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
