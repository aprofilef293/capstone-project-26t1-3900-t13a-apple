import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { ExplorerToolbar } from "../components/explorer/ExplorerNavigation";
import { NodeDetailsPanel } from "../components/explorer/NodeDetailsPanel";
import { GraphView } from "../components/GraphView";
import type { GraphViewRef } from "../components/GraphView";
import { HierarchyView } from "../components/explorer/HierarchyView";
import { NodeSizeFilter } from "../components/explorer/NodeSizeFilter";
import { useStore } from "../store/useStore";
import { SearchResultsPanel } from "@/components/explorer/SearchResultsPanel";
import MultiSelectNodeSidebar from "../components/explorer/MultiSelectNodeSidebar";
import { FullScreenSpinner } from "@/components/ui/spinner";

/*  Network Graph page, with graph and navigation toolbar.
 *  Main Contributors: Joseph, Lucy, Jess
 */

export function GraphExplorer() {
    const { searchQuery, fetchGraphData, isNodeSelecting, selectedNodeIds, infoPanelMode,  isMultiSelect, fetchPath, pathViewOnly, togglePathViewOnly, pathNodeIds } = useStore();
    const [viewMode, setViewMode] = useState<'graph' | 'hierarchy'>('graph');
    const graphViewRef = useRef<GraphViewRef>(null);
    const isInitialGraphLoading = useStore(state => state.isInitialGraphLoading);
    const nodes = useStore(state => state.nodes);
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        if (nodes.length === 0 && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchGraphData(true);
        }
    }, [fetchGraphData, nodes.length]);

    useEffect(() => {
        if (isMultiSelect && selectedNodeIds.length >= 2) {
            fetchPath();
        }
    }, [isMultiSelect, selectedNodeIds, fetchPath]);

    return (
        <div className="flex flex-col h-full w-full relative">
            {isInitialGraphLoading && <FullScreenSpinner />}
            <div className="flex-1 flex relative overflow-hidden bg-background">
                {/* Main Content Area */}
                <div className="flex-1 relative flex flex-col">
                    <ExplorerToolbar viewMode={viewMode} onViewModeChange={setViewMode} />

                    {/* Right-side controls: size filter + zoom + path view btn in multi-select mode */}
                    {viewMode === 'graph' && (
                        <div className="absolute bottom-6 right-6 z-10 flex items-end gap-3">
                            {isMultiSelect && pathNodeIds.length > 0 && (
                                <div className="flex flex-col bg-sidebar/90 backdrop-blur-sm border border-sidebar-border rounded-lg shadow-sm overflow-hidden pointer-events-auto">
                                    <Button
                                        variant="ghost"
                                        onClick={togglePathViewOnly}
                                        className={`h-10 px-3 rounded-none text-xs font-medium transition-colors ${
                                            pathViewOnly
                                                ? "text-blue-500 bg-sidebar-accent hover:bg-sidebar-accent/80"
                                                : "text-foreground hover:text-foreground hover:bg-sidebar-accent"
                                        }`}
                                        title="Toggle path view"
                                    >
                                        Path View
                                    </Button>
                                </div>
                            )}

                            {/* Node size filter slider */}
                            <NodeSizeFilter />

                            {/* Zoom controls */}
                            <div className="flex flex-col bg-sidebar/90 backdrop-blur-sm border border-sidebar-border rounded-lg shadow-sm overflow-hidden pointer-events-auto">
                                <Button variant="ghost" onClick={() => graphViewRef.current?.resetCamera()} className="h-10 w-10 rounded-none border-b border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors" title="Fit to view">
                                    <Maximize className="w-[18px] h-[18px]" />
                                </Button>
                                <Button variant="ghost" onClick={() => graphViewRef.current?.zoomIn()} className="h-10 w-10 rounded-none border-b border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
                                    <ZoomIn className="w-[18px] h-[18px]" />
                                </Button>
                                <Button variant="ghost" onClick={() => graphViewRef.current?.zoomOut()} className="h-10 w-10 rounded-none text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
                                    <ZoomOut className="w-[18px] h-[18px]" />
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 relative">
                        <div className="absolute inset-0 z-0">
                            {viewMode === 'graph' ? <GraphView ref={graphViewRef} /> : <HierarchyView />}
                        </div>

                        {viewMode === 'graph' && !isInitialGraphLoading && nodes.length === 0 && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="p-3 rounded-xl bg-sidebar-accent">
                                        <Upload className="w-7 h-7 text-sidebar-foreground/50" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-sidebar-foreground/50 mb-1">No data uploaded</p>
                                        <p className="text-xs text-sidebar-foreground/35">Please upload a file in the Data Manager page</p>
                                    </div>
                                </div>
                            </div>
                        )}

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

                {infoPanelMode === 'node-info' && (
                    <NodeDetailsPanel />
                )}

                {infoPanelMode === 'multi-select'
                && selectedNodeIds.length > 0
                && (
                    <MultiSelectNodeSidebar />
                )}

                {infoPanelMode === 'search-results'
                && searchQuery
                && (
                    <SearchResultsPanel />
                )}
            </div>
        </div>
    );
}
