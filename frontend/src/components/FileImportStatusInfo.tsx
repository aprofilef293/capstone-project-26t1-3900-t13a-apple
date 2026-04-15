import { CheckCircle, XCircle, LoaderIcon } from "lucide-react";
import { Progress } from "./ui/progress";
import { useStore } from "../store/useStore";
import { formatDate } from "../lib/utils";
import { useEffect, useState } from "react";

export function FileImportStatusInfo() {
    const { fileName, importStatus, importProgress, importDate, importError } = useStore();
    const [showSpinner, setShowSpinner] = useState(false);

    useEffect(() => {
        if (importStatus !== "loading") {
            setShowSpinner(false);
            return;
        }

        setShowSpinner(false);

        const timer = window.setTimeout(() => {
            if (useStore.getState().importStatus === "loading") {
                setShowSpinner(true);
            }
        }, 450);

        return () => window.clearTimeout(timer);
    }, [importStatus, importProgress]);

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
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-sidebar-foreground/50">
                                {Math.round(importProgress)}%
                            </span>
                            {showSpinner && (
                                <LoaderIcon className="w-3.5 h-3.5 animate-spin text-sidebar-foreground/50" />
                            )}
                        </div>
                    </div>
                )}
                {importStatus === 'complete' && (
                    <div className="flex items-center gap-1.5 text-green-500">
                        <span className="text-xs">Complete</span>
                        <CheckCircle className="w-4 h-4" />
                    </div>
                )}
                {importStatus === 'error' && (
                    <div className="flex flex-col gap-1.5 text-red-500">
                        <div className="flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span className="text-xs">
                                Failed {importError && typeof importError !== "string" && importError.code != null
                                    ? `(${importError.code})`
                                    : ""}
                            </span>
                        </div>
                        {importError && (
                            <span
                                className="text-xs text-red-400 whitespace-pre-wrap break-words max-h-28 overflow-y-auto cursor-default"
                                title={typeof importError === "string" ? importError : importError.message}
                            >
                                {typeof importError === "string" ? importError : importError.message}
                            </span>
                        )}
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