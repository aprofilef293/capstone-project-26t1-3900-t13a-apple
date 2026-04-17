import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleQuestionMark,
  DatabaseSearch,
  FileUp,
  GitGraph,
  ListTree,
  Network,
  Search,
  SlidersHorizontal,
  X,
  CheckCircle,
  XCircle,
  ChevronDown,
  CircleAlert,
  CircleChevronLeft,
  CornerDownLeft,
  Filter,
  Type,
  RotateCcw,
  RefreshCcw,
  Download,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import type { JSX } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type ManualItem = {
  content: ReactNode;
  subItems?: ReactNode[];
};

type ManualSection = {
  title: string;
  icon: LucideIcon;
  note?: string;
  items: ManualItem[];
};

const sections: ManualSection[] = [
  {
    title: "Quick Start Guide",
    icon: BookOpen,
    note: "Please make sure to upload a file before trying out other features",
    items: [
      {
        content: (
          <>
            Displayed on the
            <Link
              to="/"
              className="mx-1 underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Dashboard page
            </Link>
            and contains an overview of the main features of the web-app
          </>
        ),
      },
      {
        content: (
          <>
            Click the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 pl-2.5 pr-1.5 py-0.5 text-[12px] text-sidebar-foreground/80 align-middle">
              dropdown
              <ChevronDown className="h-3 w-3 opacity-60" />
            </span>
            arrow on each feature box to see more information on how to use it
          </>
        ),
      },
      {
        content:
          "Click the button in the feature box to go to the relevant page",
      },
    ],
  },
  {
    title: "File Upload",
    icon: FileUp,
    items: [
      {
        content: (
          <>
            Click
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              Select File
            </code>
            on
            <Link
              to="/"
              className="mx-1 underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Dashboard
            </Link>
            or
            <Link
              to="/manager"
              className="mx-1 underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Data Manager
            </Link>
            Page
          </>
        ),
      },
      {
        content: (
          <>
            Upload an
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              .obo
            </code>
            or
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              .owl
            </code>
            file
          </>
        ),
      },
      { content: "A progress bar will appear during upload" },
      {
        content: (
          <>
            Once file upload is done, the import status will update to
            <span className="ml-1 inline-flex items-center gap-1.5 text-green-500">
              <span className="text-xs">Complete</span>
              <CheckCircle className="w-4 h-4" />
            </span>
          </>
        ),
      },
      { content: "Uploading a new file will replace the current dataset" },
      {
        content: (
          <>
            If the file is invalid, the import status will update to
            <span className="ml-1 mr-1 inline-flex items-center gap-1.5 text-red-500">
              <span className="text-xs">Failed</span>
              <XCircle className="w-4 h-4 shrink-0" />
            </span>
            and show an error message
          </>
        ),
      },
    ],
  },
  {
    title: "Exploring Graph",
    icon: GitGraph,
    items: [
      {
        content: (
          <>
            View ontology data as a graph in the
            <Link
              to="/explorer"
              className="mx-1 underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Network Graph page
            </Link>
            after uploading a file
          </>
        ),
      },
      {
        content: "Click a graph node to open a side panel containing:",
        subItems: [
          "Node attributes",
          "Connections (incoming / outgoing)",
          "Computed attributes",
        ],
      },
      {
        content:
          "Click on graph nodes or nodes in the side panel to navigate around the graph",
      },
      {
        content: "Connections can be sorted by:",
        subItems: ["Name", "Size", "Importance", "Type", "Colour"],
      },
      {
        content: (
          <>
            Use the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <CircleChevronLeft className="h-3.5 w-3.5 opacity-60" />
              <span>BACK</span>
            </span>
            button to return to previous nodes
          </>
        ),
      },
    ],
  },
  {
    title: "Searching: Keyword Search",
    icon: Search,
    items: [
      {
        content: (
          <>
            Type a keyword into the
            <span className="mx-1 inline-flex items-center gap-1 rounded-lg border border-sidebar-border bg-sidebar/95 px-2.5 py-1 text-[12px] leading-none text-sidebar-foreground/70 shadow-sm">
              <Search className="h-3 w-3 opacity-60" />
              <span>search bar</span>
            </span>
          </>
        ),
      },
      {
        content:
          "Suggested nodes appear in a dropdown and the graph updates while typing",
      },
      {
        content: (
          <>
            Clicking
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />
              <span>Enter</span>
            </span>
            or the
            <span className="mx-1 inline-flex items-center gap-1 rounded-lg border border-sidebar-border bg-sidebar/95 px-2.5 py-1 text-[12px] leading-none text-sidebar-foreground/70 shadow-sm">
              <Search className="h-3 w-3 opacity-60" />
            </span>
            icon will bring up a side panel containing the full list of results
          </>
        ),
      },
      {
        content: "These results are grouped into three categories:",
        subItems: [
          "Most relevant (Contains exact node name matches)",
          "Related (Contains matches in description or synonym field of the node)",
          "Suggested (Contains results from fuzzy search)",
        ],
      },
      {
        content: (
          <>
            Click on any node in the results side panel to see more information
            about the node, and click the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <CircleChevronLeft className="h-3.5 w-3.5 opacity-60" />
              <span>BACK</span>
            </span>
            button to return to the results side panel
          </>
        ),
      },
      {
        content: (
          <>
            Click the
            <span className="mx-1 inline-flex items-center gap-1 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <X className="h-3.5 w-3 opacity-60" />
            </span>
            button in the search bar to clear the search term and reset the
            graph
          </>
        ),
      },
    ],
  },
  {
    title: "Searching: Semantic Search",
    icon: DatabaseSearch,
    items: [
      {
        content: (
          <>
            Click the
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 font-mono text-[12px] text-sidebar-foreground/80">
              Advanced
            </code>
            button next to the search bar
          </>
        ),
      },
      {
        content: (
          <>
            Type a query and click
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />
              <span>Enter</span>
            </span>
            or the
            <span className="mx-1 inline-flex items-center gap-1 rounded-lg border border-sidebar-border bg-sidebar/95 px-2.5 py-1 text-[12px] leading-none text-sidebar-foreground/70 shadow-sm">
              <Search className="h-3 w-3 opacity-60" />
            </span>
            icon to bring up the results side panel
          </>
        ),
      },
      {
        content: (
          <>
            Each result in the side panel contains a similarity score
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              %
            </code>
            representing how similar the result is to the search query
          </>
        ),
      },
      {
        content: (
          <>
            Click on any node in the results side panel to see more information
            about the node, and click the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <CircleChevronLeft className="h-3.5 w-3.5 opacity-60" />
              <span>BACK</span>
            </span>
            button to return to the results side panel
          </>
        ),
      },
      {
        content: (
          <>
            Click
            <span className="mx-1 inline-flex items-center gap-1 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <X className="h-3.5 w-3 opacity-60" />
            </span>
            button in the search bar to clear the search term and reset the
            graph
          </>
        ),
      },
    ],
  },
  {
    title: "Filtering",
    icon: SlidersHorizontal,
    note: "Multiple tags can be combined to filter the graph",
    items: [
      {
        content:
          "Use the Filter Panel to filter the graph based on node name, description, or both",
      },
      {
        content: (
          <>
            Click on the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <Filter className="h-3.5 w-3.5 opacity-60" />
              <span>funnel</span>
            </span>
            icon to open the Filter Panel
          </>
        ),
      },
      {
        content: (
          <>
            The
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              Split
            </code>
            button can be used to separate the search into two fields:
          </>
        ),
        subItems: ["Filter by node name", "Filter by node description"],
      },
      {
        content: (
          <>
            The
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              Split
            </code>
            button changes to
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              Combine
            </code>
            once clicked so users can merge the two search bars back into a
            single search bar"
          </>
        ),
      },
      {
        content: (
          <>
            Type a keyword in the search bar and click
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />
              <span>Enter</span>
            </span>
            to create a tag and update the graph
          </>
        ),
      },
      {
        content:
          "Click the dropdown on individual tags to change its boolean condition:",
        subItems: [
          <span className="inline-flex items-center rounded border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[12px] text-blue-700 dark:text-blue-400">
            Blue → OR
          </span>,
          <span className="inline-flex items-center rounded border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[12px] text-purple-700 dark:text-purple-400">
            Purple → AND
          </span>,
          <span className="inline-flex items-center rounded border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[12px] text-red-700 dark:text-red-400">
            Red → NOT
          </span>,
        ],
      },
      {
        content:
          "Adjust the importance slider to control the level of detail shown in the graph:",
        subItems: ["Show all nodes", "Only show the most important nodes"],
      },
      {
        content: (
          <>
            When the filter panel is closed, a number appears on the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <Filter className="h-3.5 w-3.5 opacity-60" />
            </span>
            icon indicating the number of filters currently applied
          </>
        ),
      },
      {
        content: (
          <>
            Click the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <RotateCcw className="h-3.5 w-3.5 opacity-60" />
            </span>
            icon to clear all filters and reset the graph
          </>
        ),
      },
    ],
  },
  {
    title: "Multi-select Mode",
    icon: Network,
    items: [
      {
        content: (
          <>
            Toggle the
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              Multi-Select
            </code>
            switch on.
          </>
        ),
      },
      {
        content:
          "Click on multiple nodes in the graph to bring up a side panel containing:",
        subItems: [
          "Selected nodes",
          "Nodes along a path between selected nodes (if a path exists)",
          "Neighbours of the selected nodes and in-path nodes",
        ],
      },
      {
        content:
          "If paths exist between selected nodes, the graph will update to highlight these paths. If no path exists between selected nodes, a message will be shown on the side panel indicating this",
      },
      {
        content: (
          <>
            Clicking on any node in the side panel will give more information
            about that node, and clicking the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <CircleChevronLeft className="h-3.5 w-3.5 opacity-60" />
              <span>BACK</span>
            </span>
            button will take users back to the multi-select side panel
          </>
        ),
      },
      {
        content: (
          <>
            Click
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              Path View
            </code>
            button to see only selected nodes and in-path nodes on the graph
          </>
        ),
      },
      {
        content: (
          <>
            Click on
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 pl-2.5 pr-1.5 py-0.5 text-[12px] text-sidebar-foreground/80 align-middle">
              Select attribute
              <ChevronDown className="h-3 w-3 opacity-60" />
            </span>
            to see a dropdown of node attributes. Select an attribute to display
            it for all nodes in the side panel. Clicking the selected attribute
            again will deselect it
          </>
        ),
      },
      {
        content: (
          <>
            Click on
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <Download className="h-3.5 w-3.5 opacity-60" />
              <span>Export CSV</span>
            </span>
            to download a CSV file containing detailed information on:
          </>
        ),
        subItems: [
          "Selected nodes",
          "Nodes along a path between selected nodes",
          "Neighbours of the selected nodes and in-path nodes",
        ],
      },
      {
        content: (
          <>
            Click the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <RefreshCcw className="h-3.5 w-3.5 opacity-60" />
              <span>Clear Selection</span>
            </span>
            button to reset the graph
          </>
        ),
      },
    ],
  },
  {
    title: "Hierarchy Panel",
    icon: ListTree,
    items: [
      {
        content: (
          <>
            Click on
            <code className="mx-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[12px] text-sidebar-foreground/80">
              Hierarchy
            </code>
            button to open up the Hierarchy Panel and view the graph in a
            folder-like structure
          </>
        ),
      },
      {
        content:
          "Folders are in alphabetical order and can be expanded to explore related nodes",
      },
      {
        content: "Clicking on a folder opens a side panel containing:",
        subItems: [
          "Node attributes",
          "Connections (incoming / outgoing)",
          "Computed attributes",
        ],
      },
      {
        content: (
          <>
            Click on the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-1 text-[12px] leading-none text-sidebar-foreground/80 align-middle">
              <GitGraph className="h-3.5 w-3.5 opacity-60" />
              <span>Graph</span>
            </span>
            button to hide the Hierarchy Panel and return to the graph
          </>
        ),
      },
    ],
  },
  {
    title: "Extras",
    icon: CircleQuestionMark,
    items: [
      { content: "Zoom in / out: Click to zoom in or out of the graph" },
      {
        content:
          "Fit to View button: Click to centre and resize the graph to fit the screen",
      },
      {
        content:
          "Importance Slider: Adjust the importance slider to control the level of detail shown in the entire graph: Show all nodes (Level 1), Only show the most important nodes (Level 5)",
      },
      {
        content:
          "Light/ Dark mode: Click light or dark mode icons to switch to its corresponding theme",
      },
      {
        content: (
          <>
            <CircleQuestionMark className="inline w-4 h-4 text-blue-500 align-text-bottom mr-1" />
            icons: Help icons have been scattered throughout the web-app (e.g.,
            in the importance slider, filter panel, search results side panel,
            and export csv button in multi-select side panel) to help explain
            features that may be confusing to understand on first use. Hovering
            over these icons will show more information about the feature.
          </>
        ),
      },
    ],
  },
];

export function UserManual() {
  return (
    <div className="flex-1 flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-y-auto">
      <PageHeader
        title="User Manual"
        description="Steps on how to use the OBO Explorer."
      />

      <div className="px-6 sm:px-10 py-8 max-w-5xl mx-auto w-full">
        <div className="space-y-6">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <section
                key={section.title}
                className="rounded-xl border border-sidebar-border bg-sidebar/50 p-5"
              >
                <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>{section.title}</span>
                </h2>

                {section.note && (
                  <p className="mt-2 inline-flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{section.note}</span>
                  </p>
                )}

                <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm leading-relaxed text-sidebar-foreground/90">
                  {section.items.map((item, index) => (
                    <li key={section.title + "-" + index}>
                      <span>{item.content}</span>
                      {item.subItems && item.subItems.length > 0 && (
                        <ul className="mt-1.5 list-disc pl-5 space-y-1 text-sidebar-foreground/80">
                          {item.subItems.map((subItem, subIndex) => (
                            <li
                              key={section.title + "-" + index + "-" + subIndex}
                            >
                              {subItem}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
