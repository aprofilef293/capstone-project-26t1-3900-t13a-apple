import { X, ChevronRight, type LucideIcon, ArrowRight } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { useStore, type GraphNode } from "../../store/useStore";

function SearchResults({
    items,
    icon: Icon,
    onSelect,
}: {
    items: GraphNode[];
    icon: LucideIcon;
    onSelect: (id: string) => void;
}) {
    if (items.length === 0) return null;

    return (
        <div className="space-y-3">
            {items.map((item) => (
                <div
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-sidebar-border/50 bg-sidebar-accent/30 hover:bg-sidebar-accent/80 hover:border-sidebar-border cursor-pointer group transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md text-black" style={{ backgroundColor: item.color }}>
                            <Icon className="w-3.5 h-3.5"/>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-sidebar-foreground group-hover:text-blue-500 transition-colors truncate max-w-[200px]">{item.label}</div>
                            <div className="text-[10px] text-sidebar-foreground/50">{item.type}</div>
                        </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/80" />
                </div>
            ))}
        </div>
    );
}

export function SearchResultsPanel() {
    const { searchQuery, setSearchQuery, searchMode, searchResultsFuzzyTitle, searchResultsDescription, searchResultsSemantic,
        searchError, setViewLevel, setSelectedNodeId, setInfoPanelMode, searchResultsLoading
    } = useStore();

    return (
        <div className="w-[400px] border-l border-sidebar-border bg-sidebar flex flex-col h-full shadow-xl z-20 transition-colors">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-sidebar-border shadow-sm bg-sidebar/50">
                <div className="flex justify-between">
                    <h2 className="text-xl font-bold text-sidebar-foreground pt-2 mb-1 leading-tight">Search Results</h2>
                    <button
                        onClick={() => {
                            setSearchQuery("");
                            setViewLevel(1);
                            setInfoPanelMode('closed');
                        }}
                        className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
                        title="Close details"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <span className="text-[12px] text-sidebar-foreground/70 font-mono tracking-wider mr-auto">Query: {searchQuery}</span>
            </div>

            <ScrollArea className="flex-1 min-h-0 pb-6 px-6 pt-4">
                {searchMode === "keyword" && !searchError && !searchResultsLoading && <>
                    <h3 className="text-xs font-bold text-sidebar-foreground mb-4 uppercase tracking-wider flex items-center gap-2">Most Relevant</h3>
                    <SearchResults items={searchResultsFuzzyTitle} icon={ArrowRight} onSelect={setSelectedNodeId} />
                    {searchResultsDescription.length != 0 && (
                        <h3 className="text-xs font-bold text-sidebar-foreground mt-4 mb-4 uppercase tracking-wider flex items-center gap-2">Suggested</h3>
                    )}
                    <SearchResults items={searchResultsDescription} icon={ArrowRight} onSelect={setSelectedNodeId} />
                    {searchResultsFuzzyTitle.length == 0 && searchResultsDescription.length == 0 && (
                        <div className="text-s text-sidebar-foreground/40 px-1">No results found.</div>
                    )}
                </>}
                {searchMode === "semantic" && !searchError && !searchResultsLoading && <>
                    <h3 className="text-xs font-bold text-sidebar-foreground mb-4 uppercase tracking-wider flex items-center gap-2">Most Relevant</h3>
                    <SearchResults items={searchResultsSemantic} icon={ArrowRight} onSelect={setSelectedNodeId} />
                    {searchResultsSemantic.length == 0 && (
                        <div className="text-s text-sidebar-foreground/40 px-1">No results found.</div>
                    )}
                </>}
                {searchResultsLoading && <div className="text-s text-sidebar-foreground/70 px-1">Loading...</div>}
                {searchError && <div className="text-s text-red-400/70 px-1">An error occurred. Please try again later.</div>}
            </ScrollArea>

        </div>
    );
}