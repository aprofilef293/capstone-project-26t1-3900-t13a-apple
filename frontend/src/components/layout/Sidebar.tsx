import { Activity, GitMerge, Settings, Plus, ChevronLeft, ChevronRight, HardDrive } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import Logo from "../../assets/Logo.svg";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { ThemeToggle } from "../theme-toggle";
import { useState } from "react";
import { cn } from "../../lib/utils";

const navigation = [
    { name: "Dashboard", href: "/", icon: Activity },
    { name: "Data Manager", href: "/manager", icon: HardDrive },
    { name: "Network Graph", href: "/explorer", icon: GitMerge },
    { name: "Settings", href: "/settings", icon: Settings },
];



export function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth < 768);

    return (
        <div
            className={cn(
                "flex flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground h-screen transition-all duration-300 relative z-30",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            {/* Logo Area */}
            <Link to="/" className={cn("flex h-16 shrink-0 items-center px-6 gap-3", isCollapsed ? "justify-center px-0" : "justify-between")}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 overflow-hidden">
                        <img src={Logo} alt="Site Logo" className="h-full w-full object-cover dark:invert transition-all" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold tracking-tight text-foreground truncate">OBO Explorer</span>
                        </div>
                    )}
                </div>
            </Link>

            <ScrollArea className="flex-1 px-3 py-4">
                {/* Main Navigation */}
                <nav className="flex flex-col gap-1">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                title={isCollapsed ? item.name : undefined}
                                className={cn(
                                    "flex items-center rounded-md text-sm font-medium transition-colors",
                                    isCollapsed ? "justify-center p-3 w-10 h-10 mx-auto" : "py-2.5 px-3 gap-3",
                                    isActive
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                            >
                                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                                {!isCollapsed && <span className="truncate">{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-8 px-3">
                    <Link to="/manager" className="block w-full">
                        <Button
                            size={isCollapsed ? "icon" : "default"}
                            className={cn(
                                "w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2",
                                isCollapsed && "aspect-square w-full"
                            )}
                            title={isCollapsed ? "New Project" : undefined}
                        >
                            <Plus className="h-4 w-4 shrink-0" />
                            {!isCollapsed && <span>New Project</span>}
                        </Button>
                    </Link>
                </div>

            </ScrollArea>

            {/* Footer Area with Theme and Collapse Toggle */}
            <div className={cn("mt-auto p-4 border-t border-sidebar-border flex items-center transition-all duration-300", isCollapsed ? "justify-center flex-col gap-4" : "justify-between")}>
                <ThemeToggle />
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-full"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
            </div>
        </div>
    );
}
