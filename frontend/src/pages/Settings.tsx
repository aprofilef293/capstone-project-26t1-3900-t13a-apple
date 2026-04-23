import { Activity, Database, Server } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";

/*  Settings page.
 *  Main Contributors: Joseph
 */

const systemStatus = [
    { id: 1, name: "Graph Database Online", status: "online", colour: "bg-emerald-500", icon: Database },
    { id: 2, name: "Query Engine Ready", status: "online", colour: "bg-emerald-500", icon: Server }
];

export function Settings() {
    return (
        <div className="flex-1 flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-y-auto">
            <PageHeader
                title="Settings"
                description="Manage application preferences and monitor system health."
            />

            <div className="px-10 py-8 max-w-4xl mx-auto w-full flex flex-col gap-10">
                {/* System Status Section */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-sidebar-foreground/70" />
                        <h2 className="text-xl font-semibold tracking-tight text-sidebar-foreground">System Status</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {systemStatus.map((status) => (
                            <div key={status.id} className="p-5 rounded-xl border border-sidebar-border bg-sidebar/50 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
                                            <status.icon className="w-4 h-4 text-sidebar-foreground/70" />
                                        </div>
                                        <h3 className="font-medium text-sidebar-foreground">{status.name}</h3>
                                    </div>
                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 capitalize">
                                        <span className={`w-1.5 h-1.5 rounded-full ${status.colour}`}></span>
                                        {status.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
