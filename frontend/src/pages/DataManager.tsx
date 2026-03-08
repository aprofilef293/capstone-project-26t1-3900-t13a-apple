import { UploadBox } from "../components/UploadBox";
import { PageHeader } from "../components/layout/PageHeader";
import { useStore } from "../store/useStore";
import { useEffect } from "react";
import { FileImportStatusInfo } from "../components/FileImportStatusInfo";

export function DataManager() {
    const {importStatus, setImportProgress, completeImport } = useStore();

    // upload progress (note: this will increment 10% every 200ms until we hit 100% but we can replace it with real progress updates when we have the backend set up)
    useEffect(() => {
        if (importStatus !== 'loading') return;
        const interval = setInterval(() => {
            const current = useStore.getState().importProgress;
            if (current >= 100) {
                clearInterval(interval);
                completeImport();
            } else {
                setImportProgress(Math.min(current + 10, 100));
            }
        }, 200);
        return () => clearInterval(interval);
    }, [importStatus, setImportProgress, completeImport]);

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
