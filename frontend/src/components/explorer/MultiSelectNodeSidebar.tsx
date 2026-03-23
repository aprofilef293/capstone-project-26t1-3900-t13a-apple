import React, { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { Badge } from "../ui/badge";
import { Trash, X, ChevronRight } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";

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
  const isMultiSelect = useStore((s) => s.isMultiSelect);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const setIsMultiSelect = useStore((s) => s.setIsMultiSelect);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const nodes = useStore((s) => s.nodes);
  const clearSelectedNodes = useStore((s) => s.clearSelectedNodes);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedAttribute, setSelectedAttribute] = useState<string>("");

  useEffect(() => {
    if (isMultiSelect && selectedNodeIds.length > 0) {
      setShowSidebar(true);
    } else {
      setShowSidebar(false);
    }
  }, [isMultiSelect, selectedNodeIds]);

  if (!isMultiSelect || selectedNodeIds.length === 0 || !showSidebar)
    return null;

  const selectedNodes: GraphNode[] = nodes.filter((n) =>
    selectedNodeIds.includes(n.id),
  );

  const attributeKeys = Array.from(
    new Set(
      selectedNodes.flatMap((node) => Object.keys(node.attributes || {})),
    ),
  );

  return (
    <aside className="w-[400px] h-full bg-sidebar/95 border-l border-sidebar-border shadow-lg z-30 flex flex-col p-4">
      {/* multi-select mode badge + close side panel btn */}
      <div className="flex items-center justify-between mb-4">
        <Badge
          variant="secondary"
          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20 rounded font-mono font-medium text-[10px] px-2 py-0.5 mr-2"
        >
          Multi-select Mode
        </Badge>
        <button
          onClick={() => setShowSidebar(false)}
          className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
          title="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* selected nodes header + counter for number of nodes selected */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Selected Nodes Details</h2>
        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 rounded-full px-2.5 py-0.5">
          {selectedNodeIds.length === 1
            ? "1 node selected"
            : `${selectedNodeIds.length} nodes selected`}
        </span>
      </div>

      {/* sub-heading + dropdown for comparing attributes */}
      <div className="flex flex-col mb-4">
        <span className="mr-2 text-sm font-medium">Compare attributes</span>
        <Select value={selectedAttribute} onValueChange={setSelectedAttribute}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select attribute" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">id</SelectItem>
            {attributeKeys
              .filter((key) => key !== "id")
              .map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* info cards for selected nodes */}
      <div className="flex flex-col gap-3 overflow-y-auto">
        {selectedNodes.map((node) => (
          <div
            key={node.id}
            className="bg-white border border-gray-200 dark:bg-zinc-900 dark:border-zinc-700/60 rounded-lg p-4 shadow-sm flex flex-col cursor-pointer group transition-all"
            onClick={() => {
              setIsMultiSelect(false);
              setSelectedNodeId(node.id);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-base mb-1 text-gray-900 dark:text-zinc-100">
                  {node.label}
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
              <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-300 transition-colors" />
            </div>
          </div>
        ))}
      </div>
      {/* side panel footer (only trash icon / button for now to clear all selected nodes from graph) */}
      <div className="mt-auto flex justify-start pt-4">
        <button
          className="flex items-center gap-1 text-xs p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          onClick={clearSelectedNodes}
          title="Clear selection"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

export default MultiSelectNodeSidebar;
