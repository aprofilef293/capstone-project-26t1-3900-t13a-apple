import { UploadBox } from "../components/UploadBox";
import { PageHeader } from "../components/layout/PageHeader";
import { FileImportStatusInfo } from "../components/FileImportStatusInfo";

export function DataManager() {

    return (
        <div className="flex-1 flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-y-auto">
            <PageHeader
                title="Data Manager"
                description="Manage, upload, and visualise your OBO ontology files."
            />

            <div className="px-10 py-8 max-w-6xl mx-auto w-full flex flex-col gap-8">
                <FileImportStatusInfo />
                <UploadBox title="Upload OBO Files" description="Drag and drop your .obo files here or click to browse." />
            </div>
        </div>
    );
}
