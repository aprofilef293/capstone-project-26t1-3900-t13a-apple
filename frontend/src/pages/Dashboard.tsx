import { UploadBox } from "../components/UploadBox";
import { PageHeader } from "../components/layout/PageHeader";

export function Dashboard() {
    return (
        <div className="flex-1 flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-y-auto">
            <PageHeader
                title="Dashboard"
                description="Visualise and Query OBO Ontologies instantly."
            />

            <div className="flex-1 flex flex-col items-center px-10 py-12 w-full">
                <div className="max-w-4xl w-full mb-12">
                    <h1 className="text-5xl font-bold tracking-tight text-sidebar-foreground mb-4 leading-tight">
                        Research-Scale Ontology<br />Exploration
                    </h1>
                    <p className="text-lg text-sidebar-foreground/70 leading-relaxed max-w-2xl">
                        Upload your OBO file to start exploring hierarchical data and network graphs. Designed for researchers, built for scale.
                    </p>
                </div>

                <UploadBox className="max-w-4xl py-20 mb-8 shadow-inner bg-sidebar-accent/5" />
            </div>
        </div>
    );
}

