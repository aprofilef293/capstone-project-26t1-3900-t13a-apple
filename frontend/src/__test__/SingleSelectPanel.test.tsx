import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MultiDirectedGraph } from "graphology";
import { NodeDetailsPanel } from "@/components/explorer/NodeDetailsPanel";

const setSelectedNodeIdMock = vi.fn();
const setInfoPanelModeMock = vi.fn();
const setPrevNodesMock = vi.fn();

// mocked data for graph (2 nodes, 1 edge connecting them)
const mockState = {
  selectedNodeId: "test1",
  nodes: [
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
  ],
  graph: (() => {
    const graph = new MultiDirectedGraph();
    graph.addNode("test1", {
      label: "testNode1",
      type: "entity",
      size: 10,
      color: "#000000",
      attributes: { percentile_rank: 0.8 },
    });
    graph.addNode("test2", {
      label: "testNode2",
      type: "entity",
      size: 10,
      color: "#ffffff",
      attributes: { percentile_rank: 0.4 },
    });
    graph.addEdge("test2", "test1");
    return graph;
  })(),
  prevNodes: [],
  setPrevNodes: setPrevNodesMock,
  setSelectedNodeId: setSelectedNodeIdMock,
  setInfoPanelMode: setInfoPanelModeMock,
  isMultiSelect: false,
  selectedNodeIds: [],
};

vi.mock("@/store/useStore", () => ({
  useStore: (selector?: (state: typeof mockState) => unknown) =>
    typeof selector === "function" ? selector(mockState) : mockState,
}));

describe("tests for single select side panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("side panel renders correctly", () => {
    render(<NodeDetailsPanel />);

    expect(screen.getByText("testNode1")).toBeInTheDocument();
    expect(screen.getByText("ID: TEST1")).toBeInTheDocument();
    expect(screen.getByText("entity Node")).toBeInTheDocument();
    expect(screen.getByText("Node Data")).toBeInTheDocument();
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText("Computed Attributes")).toBeInTheDocument();
  });

  it("side panel connections dropdown shows the nodes that are connected to the selected node", () => {
    render(<NodeDetailsPanel />);

    // open connections dropdown
    const connectionsAccordion = screen.getByRole("button", { name: /Connections/i });
    fireEvent.click(connectionsAccordion);
    expect(connectionsAccordion).toHaveAttribute("data-state", "open");

    expect(screen.getByText("testNode2")).toBeInTheDocument();
  });

  it("side panel closes when the 'x' btn is cliked", () => {
    render(<NodeDetailsPanel />);
    fireEvent.click(screen.getByTitle("Close details"));
    expect(setInfoPanelModeMock).toHaveBeenCalledWith("closed");
  });

  it("side panel goes back to previous node's panel when the back btn is clicked", () => {
    render(<NodeDetailsPanel />);
    fireEvent.click(screen.getByTitle("Go back"));
    expect(setSelectedNodeIdMock).toHaveBeenCalled();
  });
});