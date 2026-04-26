import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MultiSelectNodeSidebar from "../components/explorer/MultiSelectNodeSidebar";

/*  Tests for multiselect feature
 *  Main Contributors: Lucy
 */

const { exportMultiShortestPathsCsvMock } = vi.hoisted(() => ({
  exportMultiShortestPathsCsvMock: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  exportMultiShortestPathsCsv: exportMultiShortestPathsCsvMock,
}));
const setSelectedNodeIdMock = vi.fn();
const setInfoPanelModeMock = vi.fn();
const clearSelectedNodesMock = vi.fn();
const toggleNodeSelectionMock = vi.fn();

// mocked data for graph
const makeNodes = () => [
  {
    id: "test1",
    label: "testNode1",
    type: "entity",
    x: 0,
    y: 0,
    size: 10,
    color: "#000000",
    attributes: {
      definition: "test definition",
      synonyms: ["hehe"],
      percentile_rank: 0.8,
    },
  },
  {
    id: "test2",
    label: "testNode2",
    type: "entity",
    x: 1,
    y: 1,
    size: 10,
    color: "#ffffff",
    attributes: {
      percentile_rank: 0.4,
    },
  },
];

const mockState = {
  selectedNodeIds: ["test1", "test2"] as string[],
  setSelectedNodeId: setSelectedNodeIdMock,
  nodes: makeNodes(),
  clearSelectedNodes: () => {
    clearSelectedNodesMock();
    mockState.selectedNodeIds = [];
  },
  infoPanelMode: "multi-select" as
    | "multi-select"
    | "closed"
    | "node-info"
    | "search-results",
  setInfoPanelMode: setInfoPanelModeMock,
  pathNodeIds: [] as string[],
  pathLoading: false,
  toggleNodeSelection: toggleNodeSelectionMock,
};

vi.mock("@/store/useStore", () => ({
  useStore: (selector?: (state: typeof mockState) => unknown) =>
    typeof selector === "function" ? selector(mockState) : mockState,
}));

describe("tests for multi-select mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.selectedNodeIds = ["test1", "test2"];
    mockState.nodes = makeNodes();
    mockState.infoPanelMode = "multi-select";
    mockState.pathNodeIds = [];
    mockState.pathLoading = false;
    exportMultiShortestPathsCsvMock.mockResolvedValue({
      blob: new Blob(["id,label\n1,a"], { type: "text/csv" }),
      filename: "paths.csv",
    });
  });

  it("check that multi-select sidebar renders when info panel mode is multi-select", () => {
    render(<MultiSelectNodeSidebar />);
    expect(screen.getByText("Selected Nodes")).toBeInTheDocument();
  });

  it("has correct header + node count when the panel is open", () => {
    render(<MultiSelectNodeSidebar />);
    expect(screen.getByText("Selected Nodes")).toBeInTheDocument();
    expect(screen.getByText("2 nodes selected")).toBeInTheDocument();
    expect(screen.getByText("Multi-select Mode")).toBeInTheDocument();
  });

  it("clicking 'x' btn on side panel closes it", () => {
    render(<MultiSelectNodeSidebar />);
    const closeButton = screen.getByTitle("Close");
    fireEvent.click(closeButton);
    expect(setInfoPanelModeMock).toHaveBeenCalledWith("closed");
  });

  it("clicking clear selection button closes the side panel", () => {
    render(<MultiSelectNodeSidebar />);
    const clearButton = screen.getByTitle("Clear selection");
    fireEvent.click(clearButton);
    expect(clearSelectedNodesMock).toHaveBeenCalled();
    // also check nodes are cleared
    expect(mockState.selectedNodeIds).toHaveLength(0);
  });

  it("clicking the 'x' btn on the mini-tabs in the side panel removes it", () => {
    render(<MultiSelectNodeSidebar />);
    const removeButtons = screen.getAllByTitle("Remove from selection");
    fireEvent.click(removeButtons[0]);
    expect(toggleNodeSelectionMock).toHaveBeenCalledWith("test1");
  });

  it("shows shows a msg when no path are found between nodes", () => {
    mockState.selectedNodeIds = ["test1", "test2"];
    mockState.pathNodeIds = [];
    mockState.pathLoading = false;
    mockState.infoPanelMode = "multi-select";

    render(<MultiSelectNodeSidebar />);

    expect(screen.getByText("No path found between selected nodes.")).toBeInTheDocument();
  });

  it("clicking export csv button has correct behaviour", async () => {
    // make button enabled
    mockState.pathNodeIds = ["test1", "test2"];
    
    render(<MultiSelectNodeSidebar />);
    const exportBtn = screen.getByRole("button", { name: /export csv/i });
    expect(exportBtn).toBeEnabled();
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportMultiShortestPathsCsvMock).toHaveBeenCalledTimes(1);
      expect(exportMultiShortestPathsCsvMock).toHaveBeenCalledWith(
        ["test1", "test2"],
        ["test1", "test2"],
      );
    });
  });
});
