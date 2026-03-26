import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "../components/ui/button";
import { ExplorerToolbar } from "../components/explorer/ExplorerNavigation";
import { NodeDetailsPanel } from "../components/explorer/NodeDetailsPanel";
import MultiSelectNodeSidebar from "../components/explorer/MultiSelectNodeSidebar";
import { GraphView } from "../components/GraphView";
import type { GraphViewRef } from "../components/GraphView";
import { HierarchyView } from "../components/explorer/HierarchyView";
import { NodeSizeFilter } from "../components/explorer/NodeSizeFilter";
import { useStore } from "../store/useStore";

export function GraphExplorer() {
    const selectedNodeId = useStore((state) => state.selectedNodeId);
    const isMultiSelect = useStore((state) => state.isMultiSelect);
    const selectedNodeIds = useStore((state) => state.selectedNodeIds);
    const fetchGraphData = useStore((state) => state.fetchGraphData);
    const [viewMode, setViewMode] = useState<'graph' | 'hierarchy'>('graph');
    const graphViewRef = useRef<GraphViewRef>(null);
    const isNodeSelecting = useStore((state) => state.isNodeSelecting);
    
    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="flex-1 flex relative overflow-hidden bg-background">
                {/* Main Content Area */}
                <div className="flex-1 relative flex flex-col">
                    <ExplorerToolbar viewMode={viewMode} onViewModeChange={setViewMode} />

                    {/* Right-side controls: size filter + zoom */}
                    {viewMode === 'graph' && (
                        <div className="absolute bottom-6 right-6 z-10 flex items-end gap-3">
                            {/* Node size filter slider */}
                            <NodeSizeFilter />

                            {/* Zoom controls */}
                            <div className="flex flex-col bg-sidebar/90 backdrop-blur-sm border border-sidebar-border rounded-lg shadow-sm overflow-hidden pointer-events-auto">
                                <Button variant="ghost" onClick={() => graphViewRef.current?.resetCamera()} className="h-9 w-9 rounded-none border-b border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors" title="Fit to view">
                                    <Maximize className="w-[15px] h-[15px]" />
                                </Button>
                                <Button variant="ghost" onClick={() => graphViewRef.current?.zoomIn()} className="h-9 w-9 rounded-none border-b border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
                                    <ZoomIn className="w-[15px] h-[15px]" />
                                </Button>
                                <Button variant="ghost" onClick={() => graphViewRef.current?.zoomOut()} className="h-9 w-9 rounded-none text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
                                    <ZoomOut className="w-[15px] h-[15px]" />
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 relative">
                        <div className="absolute inset-0 z-0">
                            {viewMode === 'graph' ? <GraphView ref={graphViewRef} /> : <HierarchyView />}
                        </div>

                        {/* clicking node loading spinner */}
                        {isNodeSelecting && viewMode === 'graph' && (
                            <div className="absolute inset-0 z-10 flex items-end justify-start pb-8 pl-8 pointer-events-none">
                                <div className="flex items-center gap-2 bg-sidebar/90 backdrop-blur-sm border border-sidebar-border rounded-full px-3 py-2 shadow-md animate-in fade-in duration-150 [animation-delay:230ms] [animation-fill-mode:backwards]">
                                <div className="w-4 h-4 border-2 border-sidebar-foreground/20 border-t-blue-500 rounded-full animate-spin" />
                                    <span className="text-xs text-sidebar-foreground/70">Loading...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Details Panel */}
                {isMultiSelect && selectedNodeIds.length > 0 && !selectedNodeId && (
                    <MultiSelectNodeSidebar />
                )}
                {selectedNodeId && (
                    <NodeDetailsPanel />
                )}
            </div>
        </div>
    );
}
