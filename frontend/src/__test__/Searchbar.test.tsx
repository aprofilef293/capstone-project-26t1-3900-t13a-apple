import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerSearch } from "@/components/explorer/ExplorerSearch";
import { matchesGraphFilters } from "@/lib/filterUtils";

type SearchMode = "keyword" | "semantic";

type MockNode = {
  id: string;
  label: string;
  color: string;
  type: string;
  attributes: {
    definition?: string;
    synonyms?: string[];
  };
};

const setSearchQueryMock = vi.fn();
const setViewLevelMock = vi.fn();
const setSelectedNodeIdMock = vi.fn();
const setSearchResultsFuzzyTitleMock = vi.fn();
const setSearchResultsDescriptionMock = vi.fn();
const doSemanticSearchMock = vi.fn();
const setInfoPanelModeMock = vi.fn();
const setSearchModeMock = vi.fn();
const setSearchResultsExactTitleMock = vi.fn();
const applySearchScopeMock = vi.fn();
const clearSearchScopeMock = vi.fn();

// mocked data for graph (3 nodes)
const baseNodes: MockNode[] = [
  {
    id: "1",
    label: "Heart Failure",
    color: "#000000",
    type: "Disease",
    attributes: { definition: "heart disease", synonyms: ["hehe1"] },
  },
  {
    id: "2",
    label: "Lung Cancer",
    color: "#000000",
    type: "Disease",
    attributes: { definition: "lung tumor", synonyms: ["hehe2"] },
  },
  {
    id: "3",
    label: "test3",
    color: "#000000",
    type: "Disease",
    attributes: { definition: "heart keyword", synonyms: ["hehe3"] },
  },
];

const mockState = {
  searchQuery: "",
  setSearchQuery: (q: string) => {
    setSearchQueryMock(q);
    mockState.searchQuery = q;
  },
  setViewLevel: setViewLevelMock,
  nodes: [...baseNodes],
  setSelectedNodeId: setSelectedNodeIdMock,
  setSearchResultsFuzzyTitle: setSearchResultsFuzzyTitleMock,
  setSearchResultsDescription: setSearchResultsDescriptionMock,
  setSearchResultsExactTitle: setSearchResultsExactTitleMock,
  doSemanticSearch: doSemanticSearchMock,
  applySearchScope: applySearchScopeMock,
  clearSearchScope: clearSearchScopeMock,
  infoPanelMode: "closed" as "closed" | "search-results" | "node-info" | "multi-select",
  setInfoPanelMode: setInfoPanelModeMock,
  graphFilters: {},
  searchMode: "keyword" as SearchMode,
  setSearchMode: (mode: SearchMode) => {
    setSearchModeMock(mode);
    mockState.searchMode = mode;
  },
};

vi.mock("@/store/useStore", () => ({
  useStore: (selector?: (state: typeof mockState) => unknown) =>
    typeof selector === "function" ? selector(mockState) : mockState,
}));

vi.mock("@/lib/filterUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/filterUtils")>();
  return {
    ...actual,
    matchesGraphFilters: vi.fn(() => true),
  };
});

describe("tests for searchbar", () => {
  beforeEach(() => {
      vi.clearAllMocks();
      vi.useRealTimers();
      mockState.searchQuery = "";
      mockState.searchMode = "keyword";
      mockState.infoPanelMode = "closed";
      mockState.nodes = [...baseNodes];
      vi.mocked(matchesGraphFilters).mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  
  it("make sure typing in search bar does not immediately trigger search", () => {
    vi.useFakeTimers();

    // render search bar + type 'heart'
    render(<ExplorerSearch />);
    const input = screen.getByPlaceholderText("Search for exact words or phrases");
    fireEvent.change(input, { target: { value: "heart" } });

    // make sure search function is not called yet
    expect(setSearchQueryMock).not.toHaveBeenCalledWith("heart");
    
    // move time forward by 150ms + check search function is called
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(setSearchQueryMock).toHaveBeenCalledWith("heart");
  });

  it("click 'x' clears the words typed in search bar", () => {
    // render search bar + type 'cancer'
    mockState.infoPanelMode = "search-results";
    const { container } = render(<ExplorerSearch />);
    const input = screen.getByPlaceholderText("Search for exact words or phrases");
    fireEvent.change(input, { target: { value: "cancer" } });

    // check that the 'x' icon is visible + click it
    expect(input).toHaveValue("cancer");
    const xIcon = container.querySelector(".lucide-x");
    expect(xIcon).toBeTruthy();
    fireEvent.click(xIcon!.closest("button")!);

    // check that the search bar and search query in state is cleared + view level is reset + info panel is closed
    expect(input).toHaveValue("");
    expect(setSearchQueryMock).toHaveBeenCalledWith("");
    expect(setViewLevelMock).toHaveBeenCalledWith(1);
    expect(setInfoPanelModeMock).toHaveBeenCalledWith("closed");
  });

  it("click 'enter' to trigger search", () => {
    mockState.searchQuery = "heart";
    // render search bar + type 'heart' + click enter
    render(<ExplorerSearch />);
    const input = screen.getByPlaceholderText("Search for exact words or phrases");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(setInfoPanelModeMock).toHaveBeenCalledWith("search-results");
  });

  it("click magnify glass icon to trigger search", () => {
    mockState.searchQuery = "heart";
    // render search bar + type 'heart' + click magnify glass icon
    const { container } = render(<ExplorerSearch />);
    const searchIcon = container.querySelector(".lucide-search");
    const searchButton = searchIcon?.closest("button");
    expect(searchButton).toBeTruthy();
    fireEvent.click(searchButton!);

    expect(setInfoPanelModeMock).toHaveBeenCalledWith("search-results");
  });
  
  it("click 'keyword' btn to use keyword search and 'advanced' btn to use semantic search", () => {
    // render search bar + click 'advanced' btn
    render(<ExplorerSearch />);
    fireEvent.click(screen.getByText("Advanced"));
    // check that we switch to semantic search 
    expect(setSearchModeMock).toHaveBeenCalledWith("semantic");

    // click 'keyword' btn + check that we've switched to keyword search
    fireEvent.click(screen.getByText("Keyword"));
    expect(setSearchModeMock).toHaveBeenCalledWith("keyword");
  });

  it("no results panel shows when no matches for keywords are found", () => {
    mockState.searchQuery = "@@@@@";
    
    // render search bar + type in "@@@@@"
    render(<ExplorerSearch />);
    const input = screen.getByPlaceholderText("Search for exact words or phrases");
    fireEvent.focus(input);

    expect(screen.getByText(/No quick matches for "@@@@@"/i),).toBeInTheDocument();
  });

  it("no results appear in drop down if there are no matches for a search term", () => {
    mockState.searchQuery = "@@@@@";

    // render search bar + type in "@@@@@"
    render(<ExplorerSearch />);
    const input = screen.getByPlaceholderText("Search for exact words or phrases");
    fireEvent.focus(input);

    // check the dropdown shows no results msg
    expect(screen.getByText(/No quick matches for "@@@@@"/i)).toBeInTheDocument();
    // make sure drop down also doesn't show any of the other nodes
    expect(screen.queryByText("Heart Failure")).not.toBeInTheDocument();
    expect(screen.queryByText("Lung Cancer")).not.toBeInTheDocument();
    expect(screen.queryByText("test3")).not.toBeInTheDocument();
  });

  it("clicking outside the search bar closes the dropdown", () => {
    // render search bar + type 'heart'
    render(<ExplorerSearch />);
    const input = screen.getByPlaceholderText("Search for exact words or phrases");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'heart' } });

    // check if dropdown is open + click somewhere outside search bar
    expect(screen.getByText(/No quick matches for/i)).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    // check the dropdown is closed
    expect(screen.queryByText(/No quick matches for/i)).not.toBeInTheDocument();
  });
});