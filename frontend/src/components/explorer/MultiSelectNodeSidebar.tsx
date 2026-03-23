import React, {useState} from "react";
import { useStore } from "../../store/useStore";
import { Badge } from "../ui/badge";
import { X } from "lucide-react";

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
  const [showSidebar, setShowSidebar] = useState(true);

  if (!isMultiSelect || selectedNodeIds.length === 0) return null;

  const selectedNodes: GraphNode[] = nodes.filter((n) =>
    selectedNodeIds.includes(n.id),
  );

  return (
    <aside className="w-80 max-w-[400px] h-full bg-sidebar/95 border-l border-sidebar-border shadow-lg z-30 flex flex-col p-4">
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
            <div className="text-xs text-gray-500 dark:text-zinc-400">
              ID:{" "}
              <span className="font-mono text-gray-400 dark:text-zinc-500">
                {node.id}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default MultiSelectNodeSidebar;
