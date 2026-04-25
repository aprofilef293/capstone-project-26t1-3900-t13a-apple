import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadBox } from "../components/UploadBox";

/*  Tests for file upload functionality
 *  Main Contributors: Lucy
 */

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

describe("tests for uploading file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("make sure upload box renders", () => {
    render(<UploadBox />);

    expect(screen.getByText("Drop your OBO file here")).toBeInTheDocument();
    expect(screen.getByText("or click to browse from your computer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select File" })).toBeInTheDocument();
    expect(screen.getByText("Supported: .obo, .owl")).toBeInTheDocument();
  });

  it("click on select file btn and check that the button has been clicked once", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    render(<UploadBox />);

    fireEvent.click(screen.getByRole("button", { name: "Select File" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("mock file import and checks that we go to the manager page", () => {
    localStorage.setItem("selectedNodeId", "test");
    localStorage.setItem("selectedNodeIds", JSON.stringify(["test"]));
    localStorage.setItem("infoPanelMode", "node-info");
    localStorage.setItem("isMultiSelect", "true");
    localStorage.setItem("pathViewOnly", "true");

    render(<UploadBox />);

    // mocking file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test content"], "test.obo", {
      type: "text/plain",
    });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    // check localstorage
    expect(localStorage.getItem("selectedNodeId")).toBeNull();
    expect(localStorage.getItem("selectedNodeIds")).toBeNull();
    expect(localStorage.getItem("infoPanelMode")).toBeNull();
    expect(localStorage.getItem("isMultiSelect")).toBeNull();
    expect(localStorage.getItem("pathViewOnly")).toBeNull();
    // chekc num times functions are called
    expect(clearSelectedNodesMock).toHaveBeenCalledTimes(1);
    expect(startFileImportMock).toHaveBeenCalledTimes(1);
    expect(startFileImportMock).toHaveBeenCalledWith(file);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/manager" });
  });

  it("when no file is selected the system doesn't do anything", () => {
    render(<UploadBox />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });

    expect(startFileImportMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });  
});