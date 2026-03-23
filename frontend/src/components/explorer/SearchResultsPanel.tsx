import { X, Waypoints } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { useStore } from "../../store/useStore";

export function SearchResultsPanel() {
    const { } = useStore();

    return (
        <div className="w-[400px] border-l border-sidebar-border bg-sidebar flex flex-col h-full shadow-xl z-20 transition-colors">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-sidebar-border shadow-sm bg-sidebar/50">
                <button
                    onClick={() => {return}}
                    className="p-1 hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border/50 rounded-md transition-all text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center cursor-pointer"
                    title="Close details"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <ScrollArea className="flex-1 min-h-0 pb-6 px-6 pt-4">
                <Accordion type="multiple" className="max-w-lg" defaultValue={["node-data"]}>
                    {/* Main Data */}
                    <AccordionItem value="node-data">
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
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    {/* Computed Attributes */}
                    <AccordionItem value="computed-attributes" className="pt-2">
                    </AccordionItem>
                </Accordion>
            </ScrollArea>
        </div>
    );
}