import { Search, X } from "lucide-react";
import { useStore } from "../../store/useStore";

export function ExplorerSearch() {
    const { searchQuery, setSearchQuery } = useStore();

    return (
        <div className="flex-1 max-w-2xl bg-sidebar/95 backdrop-blur-sm border border-sidebar-border rounded-lg p-1.5 flex items-center gap-2 pointer-events-auto shadow-sm transition-colors mx-auto">
            <div className="flex-1 flex items-center gap-2 px-3">
                <Search className="w-4 h-4 text-sidebar-foreground/70" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search nodes..."
                    className="w-full bg-transparent border-none text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:outline-none focus:ring-0"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="focus:outline-none">
                        <X className="w-4 h-4 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors" />
                    </button>
                )}
            </div>
        </div>
    );
}
