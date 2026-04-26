import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";

/*  Tests for app navigation sidebar (settings and access to different pages)
 *  Main Contributors: Lucy
 */

let mockPathname = "/";
let mockTheme: "light" | "dark" = "light";

const setThemeMock = vi.fn((nextTheme: "light" | "dark") => {
  mockTheme = nextTheme;
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: setThemeMock,
  }),
}));

describe("tests for left sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
    mockTheme = "light";
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      writable: true,
      configurable: true,
    });
  });

  it("left sidebar correctly switches betweenlight and dark mode", () => {
    const { rerender } = render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(setThemeMock).toHaveBeenCalledWith("dark");

    rerender(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(setThemeMock).toHaveBeenLastCalledWith("light");
  });

  it("clicking on chevron btn opens/ closes left sidebar", () => {
    const { container } = render(<Sidebar />);

    expect(screen.getByText("OBO Explorer")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(container.querySelector(".lucide-chevron-left")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);

    expect(screen.queryByText("OBO Explorer")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByTitle("Dashboard")).toBeInTheDocument();
    expect(container.querySelector(".lucide-chevron-right")).toBeInTheDocument();
    fireEvent.click(buttons[buttons.length - 1]);

    expect(screen.getByText("OBO Explorer")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(container.querySelector(".lucide-chevron-left")).toBeInTheDocument();
  });
});