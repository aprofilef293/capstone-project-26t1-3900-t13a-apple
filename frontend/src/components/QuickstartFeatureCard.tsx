import {
  ChevronDown,
  DatabaseSearch,
  FileUp,
  GitGraph,
  ListTree,
  Network,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type AppRoute = "/" | "/manager" | "/explorer" | "/settings";

export interface QuickstartFeature {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  ctaLabel: string;
  to: AppRoute;
  icon: LucideIcon;
}

interface QuickstartFeatureCardProps {
  feature: QuickstartFeature;
  defaultOpen?: boolean;
}

const quickstartFeatures: QuickstartFeature[] = [
  {
    id: "upload",
    title: "File Upload",
    summary: "Upload .obo or .owl files from the Dashboard or Data Manager page.",
    steps: [
      "Click the Select File button and choose a .obo or .owl file.",
      "Import Status will show a loading bar which updates with live progress as the file uploads.",
      "If the upload is successful, Import Status changes to Complete.",
      "If the upload fails, Import Status changes to Failed and shows an error message underneath.",
    ],
    ctaLabel: "Go to Data Manager",
    to: "/manager",
    icon: FileUp,
  },
  {
    id: "graph-single",
    title: "Graph View",
    summary: "Explore ontology file as a network graph.",
    steps: [
      "After a file is uploaded, the graph can be viewed in the Network Graph page.",
      "Clicking on a graph node will open a side panel containing the details for the clicked node.",
      "The side panel contains information about node's Data, Connections, and Computed Attributes.",
      "The Connections dropdown allows for sorting connected nodes by different attributes",
      "A Back button in the side panel allows users to navigate back to previously viewed nodes.",
    ],
    ctaLabel: "Go to Network Graph",
    to: "/explorer",
    icon: GitGraph,
  },
  {
    id: "hierarchy",
    title: "Hierarchy Panel",
    summary: "Explore ontology file in a folder-like structure.",
    steps: [
      "In the Network Graph page, switch from Graph to Hierarchy in the top right corner.",
      "Click on arrows to expand folders.",
      "Click on folders to show side panel which contains information about the selected node.",
    ],
    ctaLabel: "Go to Network Graph",
    to: "/explorer",
    icon: ListTree,
  },
  {
    id: "keyword",
    title: "Keyword Search",
    summary: "Search for ontology terms by exact or close text matches.",
    steps: [
      "In the Network Graph page, make sure the 'Keyword' option is selected in the search bar.",
      "Type in the search bar to see graph updates and a drop-down of suggested nodes.",
      "Press Enter or click the search icon to open a results side panel.",
      "Results are grouped into 3 categories: Most Relevant, Related, and Suggested.",
      "Click a result to open node details.",
    ],
    ctaLabel: "Try Keyword Search",
    to: "/explorer",
    icon: Search,
  },
  {
    id: "semantic",
    title: "Semantic Search",
    summary: "Search for ontology terms with natural language queries.",
    steps: [
      "In the Network Graph page, make sure the 'Advanced' option is selected in the search bar.",
      "Type in a query and press Enter.",
      "Search results side panel will show up and display nodes with similarity percentages.",
      "Click a result to open node details.",
    ],
    ctaLabel: "Try Advanced Search",
    to: "/explorer",
    icon: DatabaseSearch,
  },
  {
    id: "filters",
    title: "Filter Panel",
    summary: "Filter ontology by name, description, boolean logic, and importance slider.",
    steps: [
      "In the Network Graph page, click the funnel icon to open the Filter Panel.",
      "Type in search bar to add tag for search term (searches by name or description or both).",
      "Click on tags to switch between boolean logic (OR, AND, and NOT).",
      "Drag the importance slider to see all nodes or only the most important nodes.",
      "Click on Reset button to clear all filters.",
    ],
    ctaLabel: "Try Filter Panel",
    to: "/explorer",
    icon: SlidersHorizontal,
  },
  {
    id: "multi-select",
    title: "Multi-Select & Export",
    summary: "Select multiple nodes and see shortest paths.",
    steps: [
      "In the Network Graph page, toggle on the Multi-Select switch.",
      "Select multiple nodes to see how they are connected in the graph.",
      "Use Path View to focus on relevant nodes and connections.",
      "Select an attribute from the drop down to compare values across selected nodes.",
      "Click on Export CSV to export selected and in path nodes as a CSV file.",
    ],
    ctaLabel: "Try Multi-Select",
    to: "/explorer",
    icon: Network,
  },
];

export function QuickstartFeatureCard({
  feature,
  defaultOpen = false,
}: QuickstartFeatureCardProps) {
  const Icon = feature.icon;
  const [open, setOpen] = useState(defaultOpen);
 
  return (
    <div
      className={cn(
        "break-inside-avoid rounded-lg border border-sidebar-border bg-sidebar/60 transition-colors",
        open && "bg-sidebar"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sidebar-accent/20 rounded-lg transition-colors"
        aria-expanded={open}
      >
        <div className="shrink-0 rounded-md bg-sidebar-accent/50 p-1.5">
          <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
 
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sidebar-foreground leading-tight">
            {feature.title}
          </p>
          <p className="mt-0.5 text-xs text-sidebar-foreground/60 leading-tight whitespace-normal break-words">
            {feature.summary}
          </p>
        </div>
 
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
 
      {open && (
        <div className="px-4 pb-4 pt-1">
          <div className="border-t border-sidebar-border/50 pt-3 space-y-1.5">
            {feature.steps.map((step, i) => (
              <div key={step} className="flex gap-2.5 text-xs text-sidebar-foreground/80">
                <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-sidebar-accent/50 text-sidebar-foreground/60 flex items-center justify-center text-[10px] font-medium">
                  {i + 1}
                </span>
                <p className="leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
 
          <div className="mt-3">
            <Button asChild size="sm" className="h-7 text-xs">
              <Link to={feature.to}>{feature.ctaLabel}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
 
export function QuickstartGuide() {
  return (
    <section id="quickstart" className="w-full">
      <div className="mb-3">
        <h2 className="text-2xl font-bold tracking-tight text-sidebar-foreground">
          Quickstart Guide
        </h2>
        <p className="mt-1 text-base text-sidebar-foreground/70">
          Expand any feature to see more information.
        </p>
      </div>
 
      <div className="flex gap-2.5">
        {[0, 1].map((col) => (
          <div key={col} className="flex-1 min-w-0 flex flex-col gap-2.5">
            {quickstartFeatures
              .filter((_, i) => i % 2 === col)
              .map((feature) => (
                <QuickstartFeatureCard
                  key={feature.id}
                  feature={feature}
                  defaultOpen={false}
                />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
