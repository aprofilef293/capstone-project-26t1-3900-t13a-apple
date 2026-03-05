import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";

export function RootLayout() {
    return (
        <div className="flex h-screen w-full bg-sidebar text-sidebar-foreground overflow-hidden font-sans transition-colors">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 bg-sidebar overflow-hidden relative">
                <Outlet />
            </main>
        </div>
    );
}
