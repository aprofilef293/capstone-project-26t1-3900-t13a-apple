import { X, ChevronRight, type LucideIcon, ArrowRight } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { useStore, type GraphNode } from "../../store/useStore";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

function SearchResults({
    items,
    icon: Icon,
    onSelect,
    searchMode,
}: {
    items: GraphNode[];
    icon: LucideIcon;
    onSelect: (id: string) => void;
    searchMode?: string;
}) {
    if (items.length === 0) return null;

    return (
        <div className="space-y-3">
            {items.map((item) => {
                const searchScore = Math.round((item.attributes.searchScore as number) * 100);
                let searchScoreStyle = "";
                if (!searchScore) {
                    searchScoreStyle = "text-sidebar-foreground/40";
                } else if (searchScore >= 70) {
                    searchScoreStyle = "text-sidebar-foreground/100";
                } else if (searchScore >= 50) {
                    searchScoreStyle = "text-sidebar-foreground/80";
                } else {
                    searchScoreStyle = "text-sidebar-foreground/60";
                }

                return (
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
                        <div className="flex items-center gap-2">
                            {searchMode === "semantic" && <div className={cn("p-1.5 rounded-md text-black text-xs font-medium bg-sidebar-accent", searchScoreStyle)}>{searchScore || ""}%</div>}
                            <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/80" />
                        </div>
                    </div>
                )
            })}
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
                {/* Keyword Search results */}
                {searchMode === "keyword" && !searchError && !searchResultsLoading && <Accordion type="multiple" className="max-w-lg min-w-0" defaultValue={["title", "description"]}>
                    {/* Title match */}
                    {searchResultsFuzzyTitle.length != 0 && (<AccordionItem value="title">
                        <AccordionTrigger className="cursor-pointer">
                            <h3 className="text-xs font-bold text-sidebar-foreground mb-4 uppercase tracking-wider flex items-center gap-2">Most Relevant</h3>
                        </AccordionTrigger>
                        <AccordionContent>
                            <SearchResults items={searchResultsFuzzyTitle} icon={ArrowRight} onSelect={setSelectedNodeId} />
                        </AccordionContent>
                    </AccordionItem>)}
                    {/* Description match */}
                    {searchResultsDescription.length != 0 && (<AccordionItem value="description">
                        <AccordionTrigger className="cursor-pointer">
                            <h3 className="text-xs font-bold text-sidebar-foreground mt-4 mb-4 uppercase tracking-wider flex items-center gap-2">Suggested</h3>
                        </AccordionTrigger>
                        <AccordionContent>
                            <SearchResults items={searchResultsDescription} icon={ArrowRight} onSelect={setSelectedNodeId} />
                        </AccordionContent>
                    </AccordionItem>)}
                    {searchResultsFuzzyTitle.length == 0 && searchResultsDescription.length == 0 && (
                        <div className="text-s text-sidebar-foreground/40 px-1">No results found.</div>
                    )}
                </Accordion>}

                {/* Semantic Search results */}
                {searchMode === "semantic" && !searchError && !searchResultsLoading && <>
                    <SearchResults items={searchResultsSemantic} icon={ArrowRight} onSelect={setSelectedNodeId} searchMode="semantic" />
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