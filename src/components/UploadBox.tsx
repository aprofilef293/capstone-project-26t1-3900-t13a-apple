import { FileUp } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/store/useStore";
import { useRef } from "react";

interface UploadBoxProps {
    className?: string;
    title?: string;
    description?: string;
}

export function UploadBox({
    className,
    title = "Drop your OBO file here",
    description = "or click to browse from your computer",
}: UploadBoxProps) {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const startFileImport = useStore((s) => s.startFileImport);

    const handleUpload = () => {
        navigate({ to: '/manager' });
        inputRef.current?.click()
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        startFileImport(file.name);
        navigate({ to: '/manager' });
    };

    return (
        <div className={cn("w-full border-2 border-dashed border-sidebar-border rounded-xl bg-sidebar/50 flex flex-col items-center justify-center py-16 transition-colors hover:bg-sidebar-accent/20", className)}>
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6">
                <FileUp className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold text-sidebar-foreground mb-2">{title}</h3>
            <p className="text-sm text-sidebar-foreground/60 mb-8">{description}</p>
            <div className="flex items-center gap-4 flex-col sm:flex-row">
                <input
                    ref={inputRef}
                    type="file"
                    accept=".obo,.owl"
                    className="hidden"
                    onChange={handleFileChange}
                />
                
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-8" onClick={handleUpload}>
                    Select File
                </Button>
                <span className="text-xs font-semibold tracking-wider text-sidebar-foreground/40 uppercase">Supported: .obo, .owl</span>
            </div>
        </div>
    );
}
