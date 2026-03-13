import { CheckCircle, XCircle } from "lucide-react";
import { Progress } from "./ui/progress";
import { useStore } from "../store/useStore";
import { formatDate } from "../lib/utils";

export function FileImportStatusInfo() {
    const { fileName, importStatus, importProgress, importDate, importError } = useStore();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* File */}
            <div className="p-5 flex flex-col gap-1.5">
                <span className="text-sm font-semibold tracking-wider text-sidebar-foreground">File</span>
                <span className="text-xs text-sidebar-foreground/50">
                    {fileName ?? "No file uploaded"}
                </span>
            </div>

            {/* Import Status */}
            <div className="p-5 flex flex-col gap-2">
                <span className="text-sm font-semibold tracking-wider text-sidebar-foreground">Import Status</span>
                {importStatus === 'loading' && (
                    <div className="flex flex-col gap-1.5">
                        <Progress value={importProgress} />
                        <span className="text-xs text-sidebar-foreground/50">{importProgress}%</span>
                    </div>
                )}
                {importStatus === 'complete' && (
                    <div className="flex items-center gap-1.5 text-green-500">
                        <span className="text-xs">Complete</span>
                        <CheckCircle className="w-4 h-4" />
                    </div>
                )}
                {importStatus === 'error' && (
                    <div className="flex items-center gap-1.5 text-red-500">
                        <span className="text-xs">Failed</span>
                        <XCircle className="w-4 h-4" />
                    </div>
                )}
                {importStatus === 'idle' && (
                    <span className="text-xs text-sidebar-foreground/50">—</span>
                )}
                {importStatus === 'waiting' && (
                    <span className="text-xs text-sidebar-foreground/50">Waiting...</span>
                )}
            </div>

            {/* Date Imported */}
            <div className="p-5 flex flex-col gap-1.5">
                <span className="text-sm font-semibold tracking-wider text-sidebar-foreground">Date Imported</span>
                <span className="text-xs text-sidebar-foreground/50">
                    {importDate ? formatDate(importDate) : "—"}
                </span>
            </div>
        </div>
    );
}