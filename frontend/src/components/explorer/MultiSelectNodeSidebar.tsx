import React, { useState } from "react";
import { useStore } from "../../store/useStore";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Trash, X, XCircle, ChevronRight, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type GraphNode = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  size: number;
  color: string;
  attributes: Record<string, unknown>;
};

const MultiSelectNodeSidebar: React.FC = () => {
  const { selectedNodeIds, setSelectedNodeId, nodes, clearSelectedNodes, infoPanelMode, setInfoPanelMode, pathNodeIds, pathLoading, toggleNodeSelection } = useStore();
  const [selectedAttribute, setSelectedAttribute] = useState<string>("");

  if (infoPanelMode !== 'multi-select' || selectedNodeIds.length === 0)
    return null;

  const selectedNodesSet = new Set(selectedNodeIds);
  const hasPath = pathNodeIds.length > 0;

  const displayNodeIds = hasPath ? pathNodeIds : selectedNodeIds;
  const displayNodes: GraphNode[] = displayNodeIds
    .map(id => nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined);

  const attributeKeys = Array.from(
    new Set(
      displayNodes.flatMap((node) => Object.keys(node.attributes || {})),
    ),
  );

  return (
    <aside className="w-[400px] shrink-0 h-full overflow-hidden bg-sidebar/95 border-l border-sidebar-border shadow-lg z-30 flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Badge
          variant="secondary"
          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20 rounded font-mono font-medium text-[10px] px-2 py-0.5 mr-2"
        >
          Multi-select Mode
        </Badge>
        <button
          onClick={() => setInfoPanelMode('closed')}
          className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
          title="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Title + count */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {hasPath ? "Path" : "Selected Nodes Details"}
        </h2>
        <span className="text-xs font-normal text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 rounded-full px-2.5 py-0.5">
          {hasPath
            ? `${displayNodes.length} nodes in path`
            : selectedNodeIds.length === 1
              ? "1 node selected"
              : `${selectedNodeIds.length} nodes selected`}
        </span>
      </div>

      {/* Loading indicator */}
      {pathLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 mb-4 px-1">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding shortest path...
        </div>
      )}

      {/* No path message */}
      {selectedNodeIds.length >= 2 && !hasPath && !pathLoading && (
        <div className="text-sm text-gray-500 dark:text-zinc-400 italic mb-4 px-1">
          No path found between selected nodes.
        </div>
      )}

      {/* sub-heading + dropdown for comparing attributes */}
      <div className="flex flex-col gap-3 mb-4">
        <span className="mr-2 text-sm font-medium">Compare attributes</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between text-xs">
              {selectedAttribute || "Select attribute"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuRadioGroup value={selectedAttribute} onValueChange={setSelectedAttribute}>
              <DropdownMenuRadioItem value="id" className="justify-start">id</DropdownMenuRadioItem>
              {attributeKeys
                .filter((key) => key !== "id")
                .map((key) => (
                  <DropdownMenuRadioItem key={key} value={key} className="justify-start">
                    {key}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Node cards */}
      <div className="flex flex-col gap-3 overflow-y-auto">
        {displayNodes.map((node) => {
          const isEndpoint = selectedNodesSet.has(node.id);
          return (
            <div
              key={node.id}
              className={`rounded-lg p-4 shadow-sm flex flex-col cursor-pointer group transition-all ${
                isEndpoint
                  ? "bg-blue-50 border-2 border-blue-400 dark:bg-blue-900/20 dark:border-blue-500"
                  : "bg-white border border-gray-200 dark:bg-zinc-900 dark:border-zinc-700/60"
              }`}
              onClick={() => setSelectedNodeId(node.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-base text-gray-900 dark:text-zinc-100">
                      {node.label}
                    </span>
                    {hasPath && (
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 rounded ${
                          isEndpoint
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {isEndpoint ? "selected" : "in path"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400">
                    {selectedAttribute ? (
                      <>
                        {selectedAttribute}:{" "}
                        <span className="font-mono text-gray-400 dark:text-zinc-500">
                          {String(node.attributes[selectedAttribute] ?? "N/A")}
                        </span>
                      </>
                    ) : (
                      <>
                        id:{" "}
                        <span className="font-mono text-gray-400 dark:text-zinc-500">
                          {node.id}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isEndpoint && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNodeSelection(node.id);
                      }}
                      className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 dark:text-zinc-600 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove from selection"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-300 transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto flex justify-start pt-4">
        <button
          className="flex items-center gap-1 text-xs p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => {
            clearSelectedNodes();
            setInfoPanelMode('closed');
          }}
          title="Clear selection"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

export default MultiSelectNodeSidebar;
