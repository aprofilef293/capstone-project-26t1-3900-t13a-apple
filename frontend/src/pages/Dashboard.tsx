import { UploadBox } from "../components/UploadBox";
import { PageHeader } from "../components/layout/PageHeader";
import { QuickstartGuide } from "../components/QuickstartFeatureCard";

export function Dashboard() {
    return (
        <div className="flex-1 flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-y-auto">
            <PageHeader
                title="Dashboard"
                description="Visualise and Query OBO Ontologies instantly."
            />

            <div className="flex-1 w-full px-4 sm:px-8 lg:px-10 py-8">
                <div className="mx-auto w-full max-w-4xl space-y-8 text-left">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-sidebar-foreground leading-tight">
                        Research-Scale Ontology<br />Exploration
                    </h1>

                    <QuickstartGuide />

                    <div className="space-y-4">
                        <p className="text-base text-sidebar-foreground/70 leading-relaxed max-w-2xl">
                        Upload your OBO file to start exploring.
                        </p>

                        <UploadBox className="w-full py-20 shadow-inner bg-sidebar-accent/5" />
                    </div>
                </div>
            </div>
        </div>
    );
}

