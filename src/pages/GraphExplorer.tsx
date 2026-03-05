import { useState, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../components/ui/button";
import { ExplorerToolbar } from "../components/explorer/ExplorerNavigation";
import { NodeDetailsPanel } from "../components/explorer/NodeDetailsPanel";
import { GraphView } from "../components/GraphView";
import type { GraphViewRef } from "../components/GraphView";
import { HierarchyView } from "../components/explorer/HierarchyView";
import { useStore } from "../store/useStore";

export function GraphExplorer() {
    const selectedNodeId = useStore((state) => state.selectedNodeId);
    const [viewMode, setViewMode] = useState<'graph' | 'hierarchy'>('graph');
    const graphViewRef = useRef<GraphViewRef>(null);

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="flex-1 flex relative overflow-hidden bg-background">
                {/* Main Content Area */}
                <div className="flex-1 relative flex flex-col">
                    <ExplorerToolbar viewMode={viewMode} onViewModeChange={setViewMode} />

                    {/* Zoom controls */}
                    {viewMode === 'graph' && (
                        <div className="absolute bottom-6 right-6 z-10 flex flex-col bg-sidebar/90 backdrop-blur-sm border border-sidebar-border rounded-lg shadow-sm overflow-hidden">
                            <Button variant="ghost" onClick={() => graphViewRef.current?.zoomIn()} className="h-9 w-9 rounded-none border-b border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
                                <ZoomIn className="w-[15px] h-[15px]" />
                            </Button>
                            <Button variant="ghost" onClick={() => graphViewRef.current?.zoomOut()} className="h-9 w-9 rounded-none text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
                                <ZoomOut className="w-[15px] h-[15px]" />
                            </Button>
                        </div>
                    )}

                    <div className="flex-1 relative">
                        <div className="absolute inset-0 z-0">
                            {viewMode === 'graph' ? <GraphView ref={graphViewRef} /> : <HierarchyView />}
                        </div>
                    </div>
                </div>

                {/* Right Details Panel */}
                {selectedNodeId && (
                    <NodeDetailsPanel />
                )}
            </div>
        </div>
    );
}
