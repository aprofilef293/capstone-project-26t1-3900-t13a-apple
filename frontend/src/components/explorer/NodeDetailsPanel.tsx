import { ChevronRight, ArrowRight, CornerDownRight, Box, X, type LucideIcon, Waypoints, FlaskConical } from "lucide-react";
import { useStore, type GraphNode } from "../../store/useStore";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

/* ── Reusable connection card list ── */
interface ConnectionItem {
    id: string;
    title: string;
    type: string;
}

const computedAttributeKeys = [
    "size",
    "percentile_rank",
    "pagerank_score",
    "color",
    "viewLevel",
    "x",
    "y"
]

function ConnectionList({
    items,
    icon: Icon,
    colour,
    onSelect,
}: {
    items: ConnectionItem[];
    icon: LucideIcon;
    colour: "emerald" | "purple";
    onSelect: (id: string) => void;
}) {
    if (items.length === 0) return null;

    const colourClasses = colour === "emerald"
        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30"
        : "bg-purple-500/10 text-purple-500 border border-purple-500/20 group-hover:bg-purple-500/20 group-hover:border-purple-500/30";

    return (
        <div>
            <div className="space-y-1.5">
                {items.map((item) => (
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
                                <div className="text-xs font-medium text-sidebar-foreground group-hover:text-blue-500 transition-colors">{item.title}</div>
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

function ConnectionsContent({
    inputs,
    outputs,
    onSelect,
}: {
    inputs: ConnectionItem[];
    outputs: ConnectionItem[];
    onSelect: (id: string) => void;
}) {
    return (
        <Tabs defaultValue="tab1">
            <TabsList className="flex items-center gap-2" aria-label="View node connections">
                <TabsTrigger value="tab1">
                    Incoming ({inputs.length})
                </TabsTrigger>
                <TabsTrigger value="tab2">
                    Outgoing ({outputs.length})
                </TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
                <ConnectionList items={inputs} icon={CornerDownRight} colour="emerald" onSelect={onSelect} />
                {inputs.length === 0 && (
                    <div className="text-s text-sidebar-foreground/40 italic     px-1">No incoming connections.</div>
                )}
            </TabsContent>
            <TabsContent value="tab2">
                <ConnectionList items={outputs} icon={ArrowRight} colour="purple" onSelect={onSelect} />
                {outputs.length === 0 && (
                    <div className="text-s text-sidebar-foreground/40 italic px-1">No outgoing connections.</div>
                )}
            </TabsContent>
        </Tabs>
    )
}

function AttributesSectionContent({
    node,
    hasAttributes,
    includeComputed,
}: {
    node: GraphNode;
    hasAttributes: boolean;
    includeComputed: boolean;
}) {
    return (
        <AccordionContent>
            {hasAttributes ? (
                <div className="space-y-3">
                    {Object.entries(node.attributes)
                    .filter(([key]) => (computedAttributeKeys.includes(key) == includeComputed))
                    .map(([key, value], index, array) => (
                        <div key={key} className="group">
                            <div className="flex justify-between text-xs items-start gap-4">
                                <span className="text-sidebar-foreground/70 font-medium shrink-0 pt-0.5">{key}</span>
                                <span className="font-mono text-sidebar-foreground text-right break-words select-all">{String(value)}</span>
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
        </AccordionContent>
    )
}

/* ── Main panel ── */
export function NodeDetailsPanel() {
    const { selectedNodeId, nodes, edges, setSelectedNodeId } = useStore();

    const node = nodes.find((n) => n.id === selectedNodeId);

    if (!node) {
        return (
            <div className="w-96 border-l border-sidebar-border bg-sidebar flex flex-col items-center justify-center p-6 text-center text-sidebar-foreground/70 transition-colors">
                <Box className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a node to view its details</p>
            </div>
        );
    }

    // Derive connections from edges
    const inputs = edges
        .filter(e => e.target === node.id)
        .map(e => {
            const src = nodes.find(n => n.id === e.source);
            return { id: src?.id ?? e.source, title: src?.label ?? e.source, type: src?.type ?? "Unknown" };
        });

    const outputs = edges
        .filter(e => e.source === node.id)
        .map(e => {
            const tgt = nodes.find(n => n.id === e.target);
            return { id: tgt?.id ?? e.target, title: tgt?.label ?? e.target, type: tgt?.type ?? "Unknown" };
        });

    const hasAttributes = Object.keys(node.attributes ?? {}).length > 0;
    console.log(node.attributes);

    return (
        <div className="w-[400px] border-l border-sidebar-border bg-sidebar flex flex-col h-full shadow-xl z-20 transition-colors">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-sidebar-border shadow-sm bg-sidebar/50">
                <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20 rounded font-mono font-medium text-[10px] px-2 py-0.5">
                        {node.type} Node
                    </Badge>
                    <span className="text-[10px] text-sidebar-foreground/70 font-mono tracking-wider mr-auto">ID: {node.id.toUpperCase()}</span>
                    <button
                        onClick={() => setSelectedNodeId(null)}
                        className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
                        title="Close details"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <h2 className="text-xl font-bold text-sidebar-foreground pt-2 mb-1 leading-tight">{node.label}</h2>
            </div>

            <ScrollArea className="flex-1 min-h-0 pb-6 px-6 pt-4">
                <Accordion type="multiple" className="max-w-lg" defaultValue={["node-data"]}>
                    <AccordionItem value="node-data">
                        {/* Main Data */}
                        <AccordionTrigger className="cursor-pointer">
                            <h3 className="text-xs font-bold text-sidebar-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                                <Box className="w-3.5 h-3.5" /> Node Data
                            </h3>
                        </AccordionTrigger>
                        <AttributesSectionContent node={node} hasAttributes={hasAttributes} includeComputed={false} />
                    </AccordionItem>
                    <AccordionItem value="connections" className="pt-2">
                        {/* Connections */}
                        <AccordionTrigger className="cursor-pointer">
                            <h3 className="text-xs font-bold text-sidebar-foreground mb-3 flex items-center gap-2 uppercase tracking-wider">
                                <Waypoints className="w-3.5 h-3.5" /> Connections
                            </h3>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4">
                                <ConnectionsContent inputs={inputs} outputs={outputs} onSelect={setSelectedNodeId} />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="computed-attributes" className="pt-2">
                        {/* Computed Attributes */}
                        <AccordionTrigger className="cursor-pointer">
                            <h3 className="text-xs font-bold text-sidebar-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                                <FlaskConical className="w-3.5 h-3.5" /> Computed Attributes
                            </h3>
                        </AccordionTrigger>
                        <AttributesSectionContent node={node} hasAttributes={hasAttributes} includeComputed={true} />
                    </AccordionItem>
                </Accordion>
            </ScrollArea>
        </div>
    );
}
