import { CircleQuestionMark } from "lucide-react";
import { useState, type ReactNode } from "react";

export function InfoHelpIcon({
    innerText,
}: {
    innerText: ReactNode;
}) {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <div
            onMouseOver={() => setShowInfo(true)}
            onMouseOut={() => setShowInfo(false)}>
            <CircleQuestionMark className="w-4 h-4 text-blue-500" />
            {showInfo &&
            <div className="absolute px-3 pb-2 pt-2 border border-blue-500/50 rounded-lg overflow-hidden mt-1 bg-sidebar-accent animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="text-[12px] text-muted-foreground leading-relaxed">
                    {innerText}
                </div>
            </div>}
        </div>
    )
}