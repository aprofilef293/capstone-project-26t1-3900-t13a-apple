import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GraphFilterPanel } from "@/components/explorer/FilterDetailsPanel";

type TagMode = "include" | "exclude" | "mandatory";
type TagKeyword = { text: string; mode: TagMode };
type GraphFilters = {
  labelKeywords: TagKeyword[];
  descriptionKeywords: TagKeyword[];
  minImportance: number;
  excludedColors: Set<string>;
};

const mkFilters = (): GraphFilters => ({
  labelKeywords: [],
  descriptionKeywords: [],
  minImportance: 0,
  excludedColors: new Set(),
});

const setGraphFiltersMock = vi.fn();
const resetGraphFiltersMock = vi.fn();

const mockState = {
  graphFilters: mkFilters(),
  setGraphFilters: (patch: Partial<GraphFilters>) => {
    setGraphFiltersMock(patch);
    mockState.graphFilters = { ...mockState.graphFilters, ...patch };
  },
  resetGraphFilters: () => {
    resetGraphFiltersMock();
    mockState.graphFilters = mkFilters();
  },
};

vi.mock("@/store/useStore", () => ({
  DEFAULT_FILTERS: {
    labelKeywords: [],
    descriptionKeywords: [],
    minImportance: 0,
    excludedColors: new Set(),
  },
  useStore: (selector?: (state: typeof mockState) => unknown) =>
    typeof selector === "function" ? selector(mockState) : mockState,
}));


describe("tests for filter panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.graphFilters = mkFilters();
  });
  
  it("filter panel renders (ie. opens and closes) correctly", () => {
    render(<GraphFilterPanel />);
    const toggle = screen.getByTitle("Graph filters");

    // default is closed
    expect(screen.queryByText("Graph Filter Conditions")).not.toBeInTheDocument();

    // open the filter
    fireEvent.click(toggle);
    expect(screen.getByText("Graph Filter Conditions")).toBeInTheDocument();

    // close again
    fireEvent.click(toggle);
    expect(screen.queryByText("Graph Filter Conditions")).not.toBeInTheDocument();
  });

  it("correctly adds search terms (name and description field together)", () => {
      const { rerender } = render(<GraphFilterPanel />);
      fireEvent.click(screen.getByTitle("Graph filters"));

      // type 'cancer' into the search bar + click enter
      const input = screen.getByPlaceholderText("Filter by keywords");
      fireEvent.change(input, { target: { value: "cancer" } });
      fireEvent.keyDown(input, { key: "Enter" });

      rerender(<GraphFilterPanel />);
      // check the tag is visible
      expect(screen.getByText("cancer")).toBeInTheDocument();
  });

  it("reset btn correctly resets filters", () => {
    mockState.graphFilters = {
      ...mkFilters(),
      labelKeywords: [{ text: "cancer", mode: "include" }],
    };

    render(<GraphFilterPanel />);
    fireEvent.click(screen.getByTitle("Graph filters"));

    // check that we have 1 filter
    expect(screen.getByText("1")).toBeInTheDocument();

    // reset btn clicked
    fireEvent.click(screen.getByTitle("Reset all filters"));
    expect(resetGraphFiltersMock).toHaveBeenCalled();
  });

  it("correctly adds search terms (name and description field separate)", () => {
    render(<GraphFilterPanel />);
    fireEvent.click(screen.getByTitle("Graph filters"));

    // split the single search bar into 2 separate ones for name and description
    fireEvent.click(screen.getByTitle("Split into separate name and description filters"));
    const nameInput = screen.getByPlaceholderText("Filter name by keywords");
    const descInput = screen.getByPlaceholderText("Filter description by keywords");

    // add 'allergy' into name field + click enter + check we have 'allergy' tag visible
    fireEvent.change(nameInput, { target: { value: "allergy" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });
    expect(setGraphFiltersMock).toHaveBeenCalledWith({
      labelKeywords: [{ text: "allergy", mode: "include" }],
    });

    // add 'chronic' into description field + click enter+ check we have 'chronic' tag visible
    fireEvent.change(descInput, { target: { value: "chronic" } });
    fireEvent.keyDown(descInput, { key: "Enter" });
    expect(setGraphFiltersMock).toHaveBeenCalledWith({
      descriptionKeywords: [{ text: "chronic", mode: "include" }],
    });
  });

  it("slider at the bottom of filter panel works correclty", () => {
    render(<GraphFilterPanel />);
    fireEvent.click(screen.getByTitle("Graph filters"));
    const slider = screen.getByRole("slider");

    // drag slider to 50%
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(setGraphFiltersMock).toHaveBeenCalledWith({ minImportance: 0.5 });

    // check that the label shows '≥ 50%'
    mockState.graphFilters = { ...mkFilters(), minImportance: 0.5 };
    const { rerender } = render(<GraphFilterPanel />);
    fireEvent.click(screen.getAllByTitle("Graph filters")[1]);
    rerender(<GraphFilterPanel />);
    expect(screen.getByText("≥ 50%")).toBeInTheDocument();
  });
});