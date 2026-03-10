import { ChevronRight, ArrowRight, CornerDownRight, Box, X, type LucideIcon } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

/* ── Reusable connection card list ── */
interface ConnectionItem {
    id: string;
    title: string;
    type: string;
}

function ConnectionList({
    label,
    items,
    icon: Icon,
    colour,
    onSelect,
}: {
    label: string;
    items: ConnectionItem[];
    icon: LucideIcon;
    colour: "emerald" | "purple";
    onSelect: (id: string) => void;
}) {
    if (items.length === 0) return null;

    const displayedItems = items;
    const colourClasses = colour === "emerald"
        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30"
        : "bg-purple-500/10 text-purple-500 border border-purple-500/20 group-hover:bg-purple-500/20 group-hover:border-purple-500/30";

    return (
        <div>
            <div className="text-[10px] font-semibold text-sidebar-foreground/60 mb-2 uppercase tracking-wider px-1">
                {label} ({items.length})
            </div>
            <div className="space-y-1.5">
                {displayedItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-sidebar-border/50 bg-sidebar-accent/30 hover:bg-sidebar-accent/80 hover:border-sidebar-border cursor-pointer group transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-md ${colourClasses}`}>
                                <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-sidebar-foreground group-hover:text-blue-500 transition-colors truncate max-w-[200px]">{item.title}</div>
                                <div className="text-[10px] text-sidebar-foreground/50">{item.type}</div>
                            </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/80" />
                    </div>
                ))}
            </div>
        </div >
    );
}

/* ── Main panel ── */
export function NodeDetailsPanel() {
    const { selectedNodeId, nodes, graph, setSelectedNodeId } = useStore();
    const node = nodes.find((n) => n.id === selectedNodeId);

    if (!node || !selectedNodeId) {
        return (
            <div className="w-96 border-l border-sidebar-border bg-sidebar flex flex-col items-center justify-center p-6 text-center text-sidebar-foreground/70 transition-colors">
                <Box className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a node to view its details</p>
            </div>
        );
    }

    // Use graphology now to determine node connections - more efficient, should fix lag issue
    const { inputs, outputs } = (() => {
        const ins: ConnectionItem[] = [];
        const outs: ConnectionItem[] = [];

        if (graph.hasNode(selectedNodeId)) {
            graph.forEachInEdge(selectedNodeId, (edge, attr, source) => {
                const src = graph.getNodeAttributes(source);
                ins.push({
                    id: source,
                    title: (src.label as string) || source,
                    type: (src.type as string) || "Unknown"
                });
            });

            graph.forEachOutEdge(selectedNodeId, (edge, attr, target) => {
                const tgt = graph.getNodeAttributes(target);
                outs.push({
                    id: target,
                    title: (tgt.label as string) || target,
                    type: (tgt.type as string) || "Unknown"
                });
            });
        }

        return { inputs: ins, outputs: outs };
    })();

    const hasAttributes = Object.keys(node.attributes ?? {}).length > 0;

    return (
        <div className="w-[400px] border-l border-sidebar-border bg-sidebar flex flex-col h-full shadow-xl z-20 transition-colors">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-sidebar-border shadow-sm bg-sidebar/50">
                <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20 rounded font-mono font-medium text-[10px] px-2 py-0.5">
                        {node.type} Node
                    </Badge>
                    <span className="text-[10px] text-sidebar-foreground/70 font-mono tracking-wider ml-auto">ID: {node.id.toUpperCase()}</span>
                    <button
                        onClick={() => setSelectedNodeId(null)}
                        className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
                        title="Close details"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
                <h2 className="text-xl font-bold text-sidebar-foreground mb-1 leading-tight">{node.label}</h2>
            </div>

            <ScrollArea className="flex-1 min-h-0 pb-6 px-6 pt-6">
                {/* Connections */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-sidebar-foreground mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <ArrowRight className="w-3.5 h-3.5" /> Connections
                    </h3>
                    <div className="space-y-4">
                        <ConnectionList label="Incoming" items={inputs} icon={CornerDownRight} colour="emerald" onSelect={setSelectedNodeId} />
                        <ConnectionList label="Outgoing" items={outputs} icon={ArrowRight} colour="purple" onSelect={setSelectedNodeId} />
                        {inputs.length === 0 && outputs.length === 0 && (
                            <div className="text-xs text-sidebar-foreground/40 italic px-1">No connections.</div>
                        )}
                    </div>
                </div>

                <Separator className="bg-sidebar-border/50 mb-8" />

                {/* Metadata */}
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-sidebar-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Box className="w-3.5 h-3.5" /> Node Data
                    </h3>

                    {hasAttributes ? (
                        <div className="space-y-3">
                            {Object.entries(node.attributes).map(([key, value], index, array) => (
                                <div key={key} className="group">
                                    <div className="flex justify-between text-xs items-start gap-4">
                                        <span className="text-sidebar-foreground/70 font-medium shrink-0 pt-0.5">{key}</span>
                                        <span className="font-mono text-sidebar-foreground text-right break-words select-all hover:text-blue-500 transition-colors">{String(value)}</span>
                                    </div>
                                    {index < array.length - 1 && <Separator className="bg-sidebar-border/30 mt-3" />}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-sidebar-foreground/40 italic p-4 bg-sidebar-accent/20 rounded-lg border border-sidebar-border/30 text-center">
                            No metadata available for this node.
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
