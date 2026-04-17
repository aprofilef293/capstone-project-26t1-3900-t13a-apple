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
            Displayed on the{" "}
            <Link
              to="/"
              className="underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Dashboard page
            </Link>{" "}
            and contains an overview of the main features of the web-app
          </>
        ),
      },
      {
        content: (
          <>
            Click the
            <span className="mx-1 inline-flex items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/60 pl-2.5 pr-1.5 text-[11px] text-sidebar-foreground/80 align-middle">
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
            Click{" "}
            <code className="rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[11px] text-sidebar-foreground/80">
              Select File
            </code>{" "}
            on{" "}
            <Link
              to="/"
              className="underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Dashboard
            </Link>{" "}
            or{" "}
            <Link
              to="/manager"
              className="underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Data Manager
            </Link>{" "}
            Page
          </>
        ),
      },
      {
        content: (
          <>
            Upload an{" "}
            <code className="rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[11px] text-sidebar-foreground/80">
              .obo
            </code>{" "}
            or{" "}
            <code className="rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 font-mono text-[11px] text-sidebar-foreground/80">
              .owl
            </code>{" "}
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
            View ontology data as a graph in the{" "}
            <Link
              to="/explorer"
              className="underline decoration-sidebar-foreground/40 underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Network Graph page
            </Link>{" "}
            after uploading a file
          </>
        ),
      },
      {
        content:
          "Click a graph node to open a side panel containing Node attributes, Connections (incoming / outgoing), and Computed attributes",
      },
      {
        content:
          "Click on graph nodes or nodes in the side panel to navigate around the graph",
      },
      {
        content:
          "Connections can be sorted by Name, Size, Importance, Type, and Colour",
      },
      { content: "Use the Back button to return to previous nodes" },
    ],
  },
  {
    title: "Searching: Keyword Search",
    icon: Search,
    items: [
      { content: "Type a keyword into the search bar" },
      {
        content:
          "Suggested nodes appear in a dropdown and the graph updates while typing",
      },
      {
        content:
          "Clicking Enter or the search icon will bring up a side panel containing the full list of results",
      },
      {
        content:
          "These results are grouped into three categories: Most relevant (Contains exact node name matches), Related (Contains matches in description or synonym field of the node), Suggested (Contains results from fuzzy search)",
      },
      {
        content:
          "Click on any node in the results side panel to see more information about the node, and click the Back button to return to the results side panel",
      },
      {
        content:
          "Click X button in the search bar to clear the search term and reset the graph",
      },
    ],
  },
  {
    title: "Searching: Semantic Search",
    icon: DatabaseSearch,
    items: [
      { content: "Click the Advanced button next to the search bar" },
      {
        content:
          "Type a query and click Enter or the search icon to bring up the results side panel",
      },
      {
        content:
          "Each result in the side panel contains a similarity score (%) representing how similar the result is to the search query",
      },
      {
        content:
          "Click on any node in the results side panel to see more information about the node, and click the Back button to return to the results side panel",
      },
      {
        content:
          "Click X button in the search bar to clear the search term and reset the graph",
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
      { content: "Click on the funnel icon to open the Filter Panel" },
      {
        content:
          "The Split button can be used to separate the search into two fields: Filter by node name, Filter by node description",
      },
      {
        content:
          "Type a keyword in the search bar and click Enter to create a tag. The graph will also update upon clicking Enter",
      },
      {
        content:
          "Click the dropdown on individual tags to change its boolean condition: Blue → OR, Purple → AND, Red → NOT",
      },
      {
        content:
          "Adjust the importance slider to control the level of detail shown in the graph: Show all nodes, Only show the most important nodes",
      },
      {
        content:
          "When the filter panel is closed, a number appears on the funnel icon indicating the number of filters currently applied",
      },
      {
        content:
          "Click the Reset icon to clear all filters and reset the graph",
      },
    ],
  },
  {
    title: "Multi-select Mode",
    icon: Network,
    items: [
      { content: "Toggle the Multi-Select switch on." },
      {
        content:
          "Click on multiple nodes in the graph to bring up a side panel containing Selected nodes, Nodes along a path between selected nodes (if a path exists), and Neighbours of the selected nodes and in-path nodes",
      },
      {
        content:
          "If paths exist between selected nodes, the graph will update to highlight these paths. If no path exists between selected nodes, a message will be shown on the side panel indicating this",
      },
      {
        content:
          "Click Path View button to see only selected nodes and in-path nodes on the graph",
      },
      {
        content:
          "Click on Select attribute to see a dropdown of node attributes. Select an attribute to display it for all nodes in the side panel. Clicking the selected attribute again will deselect it",
      },
      {
        content:
          "Click on Export CSV to download a CSV file containing detailed information on Selected nodes, Nodes along a path between selected nodes, and Neighbours of the selected nodes and in-path nodes",
      },
      { content: "Click Clear Selection button to reset the graph" },
    ],
  },
  {
    title: "Hierarchy Panel",
    icon: ListTree,
    items: [
      {
        content:
          "Click on Hierarchy button to open up the Hierarchy Panel and view the graph in a folder-like structure",
      },
      {
        content:
          "Folders are in alphabetical order and can be expanded to explore related nodes",
      },
      {
        content:
          "Clicking on a folder opens a side panel containing Node attributes, Connections (incoming / outgoing), and Computed attributes",
      },
      {
        content:
          "Click on the Graph button to hide the Hierarchy Panel and return to the graph",
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
            features that may be confusing to understand on first use. Hovering over these icons will show more information about the feature.
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
