import React from "react";
import { useStore } from "../../store/useStore";

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
  const nodes = useStore((s) => s.nodes);
  const clearSelectedNodes = useStore((s) => s.clearSelectedNodes);

  if (!isMultiSelect || selectedNodeIds.length === 0) return null;

  const selectedNodes: GraphNode[] = nodes.filter((n) =>
    selectedNodeIds.includes(n.id)
  );

  return (
    <aside className="w-80 max-w-[400px] h-full bg-sidebar/95 border-l border-sidebar-border shadow-lg z-30 flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Selected Nodes Details</h2>
        <button
          className="text-xs px-2 py-1 rounded bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary"
          onClick={clearSelectedNodes}
        >
          Clear
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto">
        {selectedNodes.map((node) => (
          <div
            key={node.id}
            className="bg-white border border-gray-200 dark:bg-zinc-900 dark:border-zinc-700/60 rounded-lg p-4 shadow-sm flex flex-col"
          >
            <div className="font-medium text-base mb-1 text-gray-900 dark:text-zinc-100">
              {node.label}
            </div>
            <div className="text-xs text-gray-400 dark:text-zinc-400">
              ID: <span className="font-mono text-gray-500 dark:text-zinc-500">{node.id}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default MultiSelectNodeSidebar;