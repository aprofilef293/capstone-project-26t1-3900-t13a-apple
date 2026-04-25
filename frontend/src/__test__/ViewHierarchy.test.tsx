import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HierarchyView } from "../components/explorer/HierarchyView";
import { buildHierarchyFromGraph } from "@/lib/hierarchyUtils";
import { useVisibleNodeIds } from "@/lib/useVisibleNodeIds";

const setSelectedNodeIdMock = vi.fn();
const toggleNodeSelectionMock = vi.fn();

const defaultHierarchy = [
  {
    id: "1",
    name: "test1",
    type: "folder" as const,
    children: [
      { id: "2", name: "test2", type: "file" as const, children: [] },
      { id: "3", name: "test3", type: "folder" as const, children: [] },
    ],
  },
];

// mock data (3 nodes, 2 edges)
const mockState = {
  nodes: [
    { id: "1", name: "test1", type: "folder" },
    { id: "2", name: "test2", type: "file" },
    { id: "3", name: "test3", type: "folder" },
  ],
  edges: [
    { source: "1", target: "2" },
    { source: "1", target: "3" },
  ],
  searchQuery: "",
  graphFilters: {
    labelKeywords: [],
    descriptionKeywords: [],
    minImportance: 0,
    excludedColors: new Set<string>(),
  },
  viewLevel: 1,
  infoPanelMode: "closed" as "node-info" | "search-results" | "multi-select" | "closed",
  searchResultsExactTitle: [] as { id: string }[],
  searchResultsFuzzyTitle: [] as { id: string }[],
  searchResultsDescription: [] as { id: string }[],
  searchResultsSemantic: [] as { id: string }[],
  selectedNodeId: null as string | null,
  selectedNodeIds: [] as string[],
  isMultiSelect: false,
  setSelectedNodeId: setSelectedNodeIdMock,
  toggleNodeSelection: toggleNodeSelectionMock,
};

vi.mock("@/store/useStore", () => ({
  useStore: (selector?: (state: typeof mockState) => unknown) =>
    typeof selector === "function" ? selector(mockState) : mockState,
}));

vi.mock("@/lib/hierarchyUtils", () => ({
  buildHierarchyFromGraph: vi.fn(),
}));

vi.mock("@/lib/useVisibleNodeIds", () => ({
  useVisibleNodeIds: vi.fn(),
}));

describe("tests for hierarchy view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useVisibleNodeIds).mockReturnValue(new Set(["1", "2", "3"]));
    vi.mocked(buildHierarchyFromGraph).mockReturnValue(defaultHierarchy);
    mockState.searchQuery = "";
    mockState.infoPanelMode = "closed";
    mockState.searchResultsExactTitle = [];
    mockState.searchResultsFuzzyTitle = [];
    mockState.searchResultsDescription = [];
    mockState.searchResultsSemantic = [];
  });

  it("make sure the hierarchy panel render correctly", () => {
    render(<HierarchyView />);
    expect(screen.getByText("Data Ontology Hierarchy")).toBeInTheDocument();
  });

  it("shows empty msg when nothing in hierarchy", () => {
    vi.mocked(buildHierarchyFromGraph).mockReturnValueOnce([]);
    render(<HierarchyView />);
    expect(
      screen.getByText("No hierarchy data available."),
    ).toBeInTheDocument();
  });

  it("when there is data / nodes, render them", () => {
    render(<HierarchyView />);
    expect(screen.getByText("test1")).toBeInTheDocument();
    // test3 should not be visible yet bc it is a child of test1 (ie. we should expand the test1 folder to see test3)
    expect(screen.queryByText("test3")).not.toBeInTheDocument();
  });

  it("prunes hierarchy to search-result nodes and their ancestors", () => {
    mockState.searchQuery = "test1";
    mockState.infoPanelMode = "search-results";
    mockState.searchResultsExactTitle = [{ id: "1" }];

    render(<HierarchyView />);

    expect(screen.getByText("test1")).toBeInTheDocument();
    expect(screen.queryByText("test2")).not.toBeInTheDocument();
    expect(screen.queryByText("test3")).not.toBeInTheDocument();
  });

  it("keeps ancestors when a descendant matches search results", () => {
    mockState.searchQuery = "test2";
    mockState.infoPanelMode = "search-results";
    mockState.searchResultsExactTitle = [{ id: "2" }];

    render(<HierarchyView />);

    expect(screen.getByText("test1")).toBeInTheDocument();
    expect(screen.getByText("test2")).toBeInTheDocument();
    expect(screen.queryByText("test3")).not.toBeInTheDocument();
  });

  it("when node is clicked, make sure selectNodeid is called", () => {
    render(<HierarchyView />);
    fireEvent.click(screen.getByText("test1"));
    expect(setSelectedNodeIdMock).toHaveBeenCalledWith("1");
  });

  it("toggles node expansion when chevron is clicked", () => {
    render(<HierarchyView />);

    // no test3 visible initially
    expect(screen.queryByText("test3")).not.toBeInTheDocument();

    // expand the folder
    const chevron = document.querySelector(".lucide-chevron-right");
    fireEvent.click(chevron!.parentElement!);

    // test3 should be visible now
    expect(screen.getByText("test3")).toBeInTheDocument();
  });

  it("make sure filter panel works with heirarchy ", () => {
    // filter out node2 (ie. test2)
    vi.mocked(useVisibleNodeIds).mockReturnValueOnce(new Set(["1", "3"]));

    render(<HierarchyView />);

    // we shouldn't have test2 anymore now (filtered out earlier)
    expect(buildHierarchyFromGraph).toHaveBeenCalledWith(
      [
        { id: "1", name: "test1", type: "folder" },
        { id: "3", name: "test3", type: "folder" },
      ],
      [
        { source: "1", target: "3" },
      ]
    );
  });
});
