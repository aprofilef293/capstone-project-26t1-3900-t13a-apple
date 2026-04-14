import { CircleQuestionMark } from "lucide-react";
import { type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { cn } from "@/lib/utils";

export function InfoHelpIcon({
    innerText,
    side,
    align,
    wide = false,
}: {
    innerText: ReactNode;
    side: "left" | "top" | "right" | "bottom";
    align: 'center' | 'start' | 'end';
    wide?: boolean;
}) {
    return (
        <HoverCard openDelay={10} closeDelay={10}>
            <HoverCardTrigger asChild>
                <CircleQuestionMark className="w-4 h-4 text-blue-500" />
            </HoverCardTrigger>
            <HoverCardContent side={side} align={align} className={cn("px-3 pb-2 pt-2 border border-blue-500/50 rounded-lg overflow-hidden mt-1 bg-sidebar-accent", wide ? "w-75" : "w-60")}>
                <div className="text-[12px] text-muted-foreground leading-relaxed">
                    {innerText}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}