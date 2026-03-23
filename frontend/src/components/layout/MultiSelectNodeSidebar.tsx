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

  // Get the node objects for the selected IDs
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
            className="bg-sidebar-primary/80 border border-sidebar-border rounded-lg p-4 shadow flex flex-col"
          >
            <div className="font-medium text-base mb-1">{node.label}</div>
            <div className="text-xs text-sidebar-foreground/70">
              ID: <span className="font-mono">{node.id}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default MultiSelectNodeSidebar;