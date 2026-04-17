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
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";

type ManualSection = {
  title: string;
  icon: LucideIcon;
  note?: string;
  items: string[];
};

const sections: ManualSection[] = [
  {
    title: "Quick Start Guide",
    icon: BookOpen,
    note: "Please make sure to upload a file before trying out other features.",
    items: [
      "Displayed on the Dashboard page and contains an overview of the main features of the web-app.",
      "Click the dropdown arrow on each feature box to see more information on how to use it.",
      "Click the button in the feature box to go to the relevant page.",
    ],
  },
  {
    title: "File Upload",
    icon: FileUp,
    items: [
      "Click Select File on Dashboard or Data Manager Page.",
      "Upload an .obo or .owl file.",
      "A progress bar will appear during upload.",
      "Once file upload is done, the import status will update to Complete.",
      "Uploading a new file will replace the current dataset.",
      "If the file is invalid, the import status will update to Failed and show an error message.",
    ],
  },
  {
    title: "Exploring Graph",
    icon: GitGraph,
    items: [
      "View ontology data as a graph.",
      "Click a graph node to open a side panel containing Node attributes, Connections (incoming / outgoing), and Computed attributes.",
      "Click on graph nodes or nodes in the side panel to navigate around the graph.",
      "Connections can be sorted by Name, Size, Importance, Type, and Colour.",
      "Use the Back button to return to previous nodes.",
    ],
  },
  {
    title: "Searching: Keyword Search",
    icon: Search,
    items: [
      "Type a keyword into the search bar.",
      "Suggested nodes appear in a dropdown and the graph updates while typing.",
      "Clicking Enter or the search icon will bring up a side panel containing the full list of results.",
      "These results are grouped into three categories: Most relevant (Contains exact node name matches), Related (Contains matches in description or synonym field of the node), Suggested (Contains results from fuzzy search).",
      "Click on any node in the results side panel to see more information about the node, and click the Back button to return to the results side panel.",
      "Click X button in the search bar to clear the search term and reset the graph.",
    ],
  },
  {
    title: "Searching: Semantic Search",
    icon: DatabaseSearch,
    items: [
      "Click the Advanced button next to the search bar.",
      "Type a query and click Enter or the search icon to bring up the results side panel.",
      "Each result in the side panel contains a similarity score (%) representing how similar the result is to the search query.",
      "Click on any node in the results side panel to see more information about the node, and click the Back button to return to the results side panel.",
      "Click X button in the search bar to clear the search term and reset the graph.",
    ],
  },
  {
    title: "Filtering",
    icon: SlidersHorizontal,
    note: "Multiple tags can be combined to filter the graph.",
    items: [
      "Use the Filter Panel to filter the graph based on node name, description, or both.",
      "Click on the funnel icon to open the Filter Panel.",
      "The Split button can be used to separate the search into two fields: Filter by node name, Filter by node description.",
      "Type a keyword in the search bar and click Enter to create a tag. The graph will also update upon clicking Enter.",
      "Click the dropdown on individual tags to change its boolean condition: Blue → OR, Purple → AND, Red → NOT.",
      "Adjust the importance slider to control the level of detail shown in the graph: Show all nodes, Only show the most important nodes.",
      "When the filter panel is closed, a number appears on the funnel icon indicating the number of filters currently applied.",
      "Click the Reset icon to clear all filters and reset the graph.",
    ],
  },
  {
    title: "Multi-select Mode",
    icon: Network,
    items: [
      "Toggle the Multi-Select switch on.",
      "Click on multiple nodes in the graph to bring up a side panel containing Selected nodes, Nodes along a path between selected nodes (if a path exists), and Neighbours of the selected nodes and in-path nodes.",
      "If paths exist between selected nodes, the graph will update to highlight these paths. If no path exists between selected nodes, a message will be shown on the side panel indicating this.",
      "Click Path View button to see only selected nodes and in-path nodes on the graph.",
      "Click on Select attribute to see a dropdown of node attributes. Select an attribute to display it for all nodes in the side panel. Clicking the selected attribute again will deselect it.",
      "Click on Export CSV to download a CSV file containing detailed information on Selected nodes, Nodes along a path between selected nodes, and Neighbours of the selected nodes and in-path nodes.",
      "Click Clear Selection button to reset the graph.",
    ],
  },
  {
    title: "Hierarchy Panel",
    icon: ListTree,
    items: [
      "Click on Hierarchy button to open up the Hierarchy Panel and view the graph in a folder-like structure.",
      "Folders are in alphabetical order and can be expanded to explore related nodes.",
      "Clicking on a folder opens a side panel containing Node attributes, Connections (incoming / outgoing), and Computed attributes.",
      "Click on the Graph button to hide the Hierarchy Panel and return to the graph.",
    ],
  },
  {
    title: "Extras",
    icon: CircleQuestionMark,
    items: [
      "Zoom in / out: Click to zoom in or out of the graph.",
      "Fit to View button: Click to centre and resize the graph to fit the screen.",
      "Importance Slider: Adjust the importance slider to control the level of detail shown in the entire graph: Show all nodes (Level 1), Only show the most important nodes (Level 5).",
      "Light/ Dark mode: Click light or dark mode icons to switch to its corresponding theme.",
      "“?” Help icons: “?” icons are scattered throughout the web-app (e.g., in the importance slider, filter panel, search results side panel, and export csv button in multi-select side panel) to explain features that may be confusing on first use.",
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
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                    Note: {section.note}
                  </p>
                )}

                <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm leading-relaxed text-sidebar-foreground/90">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
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