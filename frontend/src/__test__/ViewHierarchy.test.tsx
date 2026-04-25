import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HierarchyView } from "../components/explorer/HierarchyView";
import { buildHierarchyFromGraph } from "@/lib/hierarchyUtils";
import { matchesGraphFilters } from "@/lib/filterUtils";

/*  Tests for hierarchy view of graph
 *  Main Contributors: Lucy
 */

const setSelectedNodeIdMock = vi.fn();

// mock data (3 nodes, 2 edges)
const mockState = {
  nodes: [
    { id: "1", name: "test1", type: "folder" },
    { id: "2", name: "test2", type: "file"},
    { id: "3", name: "test3", type: "folder" },
  ],
  edges: [
    { source: "1", target: "2" },
    { source: "1", target: "3" },
  ],
  searchQuery: "",
  graphFilters: {},
  selectedNodeId: null,
  setSelectedNodeId: setSelectedNodeIdMock,
};

vi.mock("@/store/useStore", () => ({
  useStore: (selector?: (state: typeof mockState) => unknown) =>
    typeof selector === "function" ? selector(mockState) : mockState,
}));

vi.mock("@/lib/hierarchyUtils", () => ({
  buildHierarchyFromGraph: vi.fn(() => [
    {
      id: "1",
      name: "test1",
      type: "folder",
      children: [
        { id: "2", name: "test2", type: "file", children: [] },
        { id: "3", name: "test3", type: "folder", children: [] },
      ],
    },
  ]),
}));

vi.mock("@/lib/filterUtils", () => ({
  matchesGraphFilters: vi.fn(() => true),
}));

describe("tests for hierarchy view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.searchQuery = ""; 
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

  it("make sure heirarchy panel works with searchbar", () => {
    const { rerender } = render(<HierarchyView />);
    // search for the term "test1"
    mockState.searchQuery = "test1";
    rerender(<HierarchyView />);

    // only test1 should be visible after the search now
    expect(screen.getByText("test1")).toBeInTheDocument();
    expect(screen.queryByText("test2")).not.toBeInTheDocument();
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
    const mockMatchesGraphFilters = vi.fn((node) => {
      return node.id !== "2";
    });
    vi.mocked(matchesGraphFilters).mockImplementation(mockMatchesGraphFilters);

    render(<HierarchyView />);

    // we shouldn't have test2 anymore now (filtered out earlier)
    expect(buildHierarchyFromGraph).toHaveBeenCalledWith(
      [
        { id: "1", name: "test1", type: "folder" },
        { id: "3", name: "test3", type: "folder" },
      ],
      mockState.edges,
    );
  });
});
