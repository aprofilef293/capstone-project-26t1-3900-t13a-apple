import { ChevronRight, ArrowRight, CornerDownRight, Box, X, type LucideIcon, Waypoints, FlaskConical, CircleChevronLeft } from "lucide-react";
import { useStore, type GraphNode } from "../../store/useStore";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import React, { useMemo } from "react";

/* ── Reusable connection card list ── */
interface ConnectionItem {
    id: string;
    title: string;
    type: string;
    size: number;
    colour: string;
    percentile_rank: number;
}

const computedAttributeKeys = [
    "size",
    "percentile_rank",
    "pagerank_score",
    "color",
    "viewLevel",
    "viewlevel",
    "view_level",
    "x",
    "y"
]

function returnToPrevNode(prevNodes: string[], setPrevNodes: (prevNodes: string[]) => void, setSelectedNodeId: (id: string | null) => void): void {
    const updatedPrevNodes = [...prevNodes];
    updatedPrevNodes.pop();
    const prevNode = updatedPrevNodes.pop();
    if (prevNode === undefined) {
        setPrevNodes([]);
        setSelectedNodeId(null);
    } else {
        setSelectedNodeId(prevNode);
        setPrevNodes(updatedPrevNodes);
    }
}

function alphabeticalSort(a: string, b: string): number {
    if (a.toLowerCase() < b.toLowerCase())
        return -1;
    if (a.toLowerCase() > b.toLowerCase())
        return 1;
    return 0;
}

function sortList(list: ConnectionItem[], sortType: string) {
    let newList = list;
    switch (sortType) {
        case "name-az":
            newList = list.sort((a, b) => alphabeticalSort(a.title, b.title));
            break;
        case "name-za":
            newList = list.sort((a, b) => alphabeticalSort(b.title, a.title));
            break;
        case "size-asc":
            newList = list.sort((a, b) => a.size - b.size);
            break;
        case "size-desc":
            newList = list.sort((a, b) => b.size - a.size);
            break;
        case "importance":
            newList = list.sort((a, b) => b.percentile_rank - a.percentile_rank);
            break;
        case "type":
            newList = list.sort((a, b) => alphabeticalSort(a.type, b.type));
            break;
        case "colour":
            newList = list.sort((a, b) => alphabeticalSort(a.colour, b.colour));
            break;
        default:
            // name-az
            newList = list.sort((a, b) => alphabeticalSort(a.title, b.title));
    }
    return newList;
}

function ConnectionList({
    items,
    icon: Icon,
    onSelect,
}: {
    items: ConnectionItem[];
    icon: LucideIcon;
    onSelect: (id: string) => void;
}) {
    if (items.length === 0) return null;

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
                            <div className="p-1.5 rounded-md text-black" style={{ backgroundColor: item.colour }}>
                                <Icon className="w-3.5 h-3.5"/>
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

function ConnectionsContent({
    inputs,
    outputs,
    onSelect,
}: {
    inputs: ConnectionItem[];
    outputs: ConnectionItem[];
    onSelect: (id: string) => void;
}) {
    const [sortChoice, setSortChoice] = React.useState("name-az");

    const inputsList = useMemo(() => sortList([...inputs], sortChoice), [inputs, sortChoice]);
    const outputsList = useMemo(() => sortList([...outputs], sortChoice), [outputs, sortChoice]);

    return (
        <Tabs defaultValue="tab1">
            <div className="flex justify-between">
                <TabsList className="flex items-center gap-2" aria-label="View node connections">
                    <TabsTrigger value="tab1">
                        Incoming ({inputs.length})
                    </TabsTrigger>
                    <TabsTrigger value="tab2">
                        Outgoing ({outputs.length})
                    </TabsTrigger>
                </TabsList>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild className="cursor-pointer">
                        <Button variant="secondary">Sort</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="cursor-pointer">
                        <DropdownMenuRadioGroup value={sortChoice} onValueChange={setSortChoice}>
                            <DropdownMenuRadioItem value="name-az">Name (A-Z)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="name-za">Name (Z-A)</DropdownMenuRadioItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioItem value="size-asc">Size (Low to High)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="size-desc">Size (High to Low)</DropdownMenuRadioItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioItem value="importance">Importance</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="type">Type</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="colour">Colour</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <TabsContent value="tab1">
                <ConnectionList items={inputsList} icon={CornerDownRight} onSelect={onSelect} />
                {inputs.length === 0 && (
                    <div className="text-s text-sidebar-foreground/40 italic     px-1">No incoming connections.</div>
                )}
            </TabsContent>
            <TabsContent value="tab2">
                <ConnectionList items={outputsList} icon={ArrowRight} onSelect={onSelect} />
                {outputs.length === 0 && (
                    <div className="text-s text-sidebar-foreground/40 italic px-1">No outgoing connections.</div>
                )}
            </TabsContent>
        </Tabs>
    )
}

function AttributesSection({
    node,
    sectionTitle,
    icon: Icon,
    hasAttributes,
    includeComputed,
}: {
    node: GraphNode;
    sectionTitle: string;
    icon: LucideIcon
    hasAttributes: boolean;
    includeComputed: boolean;
}) {
    return (
        <>
            <AccordionTrigger className="cursor-pointer">
                <h3 className="text-xs font-bold text-sidebar-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" /> {sectionTitle}
                </h3>
            </AccordionTrigger>
            <AccordionContent>
                {hasAttributes ? (
                    <div className="space-y-3">
                        {Object.entries(node.attributes)
                            .filter(([key]) => (computedAttributeKeys.includes(key) == includeComputed))
                            .map(([key, value], index, array) => (
                                <div key={key} className="group">
                                    <div className="flex justify-between text-xs items-start gap-4">
                                        <span className="text-sidebar-foreground/70 font-medium shrink-0 pt-0.5">{key}</span>
                                        <span className="font-mono text-sidebar-foreground text-right break-words select-all max-w-[200px]">{String(value)}</span>
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
        </>
    )
}

/* ── Main panel ── */
export function NodeDetailsPanel() {
    const { selectedNodeId, nodes, graph, prevNodes, setPrevNodes, setSelectedNodeId, setInfoPanelMode, isMultiSelect, selectedNodeIds, setSearchQuery } = useStore();
    const node = nodes.find((n) => n.id === selectedNodeId);

    if (!node || !selectedNodeId) {
        return (
            <div className="w-96 border-l border-sidebar-border bg-sidebar p-6 text-sidebar-foreground/70 transition-colors">
                <div className="flex justify-end">

                <button
                    onClick={() => setInfoPanelMode('closed')}
                    className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
                    title="Close details"
                >
                    <X className="w-5 h-5" />
                </button>
                </div>
                <div className="flex flex-col items-center justify-center text-center mt-10">
                    <Box className="w-12 h-12 mb-4 opacity-20" />
                    <p>Select a node to view its details</p>
                </div>
            </div>
        );
    }

    // Use graphology now to determine node connections - more efficient, should fix lag issue
    const { inputs, outputs } = (() => {
        const ins: ConnectionItem[] = [];
        const outs: ConnectionItem[] = [];

        if (graph.hasNode(selectedNodeId)) {
            // Unique incoming neighbors
            graph.forEachInNeighbor(selectedNodeId, (source, src) => {
                if (source === selectedNodeId) return;
                ins.push({
                    id: source,
                    title: (src.label as string) || source,
                    type: (src.type as string) || "Unknown",
                    size: (src.size as number) || -1,
                    colour: (src.color as string) || "#000000",
                    percentile_rank: src.attributes["percentile_rank"],
                });
            });

            // Unique outgoing neighbors
            graph.forEachOutNeighbor(selectedNodeId, (target, tgt) => {
                if (target === selectedNodeId) return;
                outs.push({
                    id: target,
                    title: (tgt.label as string) || target,
                    type: (tgt.type as string) || "Unknown",
                    size: (tgt.size as number) || -1,
                    colour: (tgt.color as string) || "#000000",
                    percentile_rank: tgt.attributes["percentile_rank"],
                });
            });
        }

        return { inputs: ins, outputs: outs };
    })();

    inputs.sort((a, b) => alphabeticalSort(a.title, b.title));
    outputs.sort((a, b) => alphabeticalSort(a.title, b.title));

    const hasAttributes = Object.keys(node.attributes ?? {}).length > 0;

    return (
        <div className="w-[400px] border-l border-sidebar-border bg-sidebar flex flex-col h-full shadow-xl z-20 transition-colors overflow-x-hidden min-w-0">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-sidebar-border shadow-sm bg-sidebar/50">
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={() => {
                            if (isMultiSelect && selectedNodeIds.length > 0) {
                                setSelectedNodeId(null);
                                setInfoPanelMode('multi-select');
                            } else {
                                returnToPrevNode(prevNodes, setPrevNodes, setSelectedNodeId);
                            }
                        }}
                        className="px-2 pb-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
                        title="Go back"
                    >
                        <CircleChevronLeft className="w-4 h-5 mt-0.5"/>&nbsp;&nbsp;BACK
                    </button>
                    <button
                        onClick={() => {
                            setInfoPanelMode('closed');
                            setSearchQuery("");
                        }}
                        className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
                        title="Close details"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <h2 className="text-xl font-bold text-sidebar-foreground pt-2 mb-1 leading-tight">{node.label}</h2>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20 rounded font-mono font-medium text-[10px] px-2 py-0.5 mr-2 mt-4">
                    {node.type} Node
                </Badge>
                <span className="text-[10px] text-sidebar-foreground/70 font-mono tracking-wider mr-auto">ID: {node.id.toUpperCase()}</span>
            </div>

            <ScrollArea className="flex-1 min-h-0 pb-6 px-6 pt-4 min-w-0">
                <Accordion type="multiple" className="max-w-lg min-w-0" defaultValue={["node-data"]}>
                    {/* Main Data */}
                    <AccordionItem value="node-data">
                        <AttributesSection node={node} sectionTitle="Node Data" icon={Box} hasAttributes={hasAttributes} includeComputed={false} />
                    </AccordionItem>
                    {/* Connections */}
                    <AccordionItem value="connections" className="pt-2">
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
                    {/* Computed Attributes */}
                    <AccordionItem value="computed-attributes" className="pt-2">
                        <AttributesSection node={node} sectionTitle="Computed Attributes" icon={FlaskConical} hasAttributes={hasAttributes} includeComputed={true} />
                    </AccordionItem>
                </Accordion>
            </ScrollArea>
        </div>
    );
}
