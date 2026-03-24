import { Search, X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";

export function ExplorerSearch() {
    const { searchQuery, setSearchQuery, updateSearchResults, setInfoPanelMode, setViewLevel } = useStore();

    return (
        <div className="flex-1 w-full max-w-xl bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-1.5 flex items-center gap-2 pointer-events-auto shadow-sm transition-colors mx-auto">
            <div className="flex-1 flex items-center gap-2 pl-3 h-8">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value) setViewLevel(1);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery != '') {
                            updateSearchResults();
                            setInfoPanelMode('search-results');
                        }
                    }}
                    placeholder="Search nodes..."
                    className="w-full bg-transparent border-none text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:outline-none focus:ring-0"
                />
                {searchQuery && (
                    <Button onClick={() => {
                        setSearchQuery("");
                        setViewLevel(1);
                        setInfoPanelMode('closed');
                    }} className="focus:outline-none" variant="ghost">
                        <X className="w-4 h-4 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors" />
                    </Button>
                )}
                <Button onClick={() => {
                    updateSearchResults();
                    setInfoPanelMode('search-results');
                }} variant="ghost" size="icon" className="hover:bg-blue-500/10">
                    <Search className="w-4 h-4 text-sidebar-foreground/70" />
                </Button>
            </div>
        </div>
    );
}
