import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadBox } from "../components/UploadBox";

const navigateMock = vi.fn();
const startFileImportMock = vi.fn();
const clearSelectedNodesMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/store/useStore", () => ({
  useStore: (selector: (state: {
    startFileImport: typeof startFileImportMock;
    clearSelectedNodes: typeof clearSelectedNodesMock;
  }) => unknown) =>
    selector({
      startFileImport: startFileImportMock,
      clearSelectedNodes: clearSelectedNodesMock,
    }),
}));

describe("UploadBox component tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the upload box copy and button", () => {
    render(<UploadBox />);

    expect(screen.getByText("Drop your OBO file here")).toBeInTheDocument();
    expect(screen.getByText("or click to browse from your computer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select File" })).toBeInTheDocument();
    expect(screen.getByText("Supported: .obo, .owl")).toBeInTheDocument();
  });

  it("clicking Select File triggers the hidden file input", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    render(<UploadBox />);

    fireEvent.click(screen.getByRole("button", { name: "Select File" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("clears selection state, starts import, and navigates when a file is chosen", () => {
    localStorage.setItem("selectedNodeId", "node-1");
    localStorage.setItem("selectedNodeIds", JSON.stringify(["node-1"]));
    localStorage.setItem("infoPanelMode", "node-info");
    localStorage.setItem("isMultiSelect", "true");
    localStorage.setItem("pathViewOnly", "true");

    render(<UploadBox />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy ontology content"], "example.obo", {
      type: "text/plain",
    });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(localStorage.getItem("selectedNodeId")).toBeNull();
    expect(localStorage.getItem("selectedNodeIds")).toBeNull();
    expect(localStorage.getItem("infoPanelMode")).toBeNull();
    expect(localStorage.getItem("isMultiSelect")).toBeNull();
    expect(localStorage.getItem("pathViewOnly")).toBeNull();

    expect(clearSelectedNodesMock).toHaveBeenCalledTimes(1);
    expect(startFileImportMock).toHaveBeenCalledTimes(1);
    expect(startFileImportMock).toHaveBeenCalledWith(file);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/manager" });
  });

  it("does nothing if no file is selected", () => {
    render(<UploadBox />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });

    expect(startFileImportMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});