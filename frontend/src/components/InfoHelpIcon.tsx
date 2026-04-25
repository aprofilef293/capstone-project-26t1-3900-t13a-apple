import { CircleQuestionMark } from "lucide-react";
import { type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { cn } from "@/lib/utils";

/*  Question mark icon that users can hover over to see explanation/info.
 *  Location: Network Graph page
 *  Main Contributors: Jessica
 */

export function InfoHelpIcon({
    innerText,
    iconSize = "w-4 h-4",
    side,
    align,
    boxWidth,
}: {
    innerText: ReactNode;
    iconSize?: string;
    boxWidth: string;
    side: "left" | "top" | "right" | "bottom";
    align: 'center' | 'start' | 'end';
}) {
    return (
        <HoverCard openDelay={10} closeDelay={10}>
            <HoverCardTrigger asChild>
                <CircleQuestionMark className={cn("text-blue-500", iconSize)} />
            </HoverCardTrigger>
            <HoverCardContent side={side} align={align} className={cn("px-3 pb-2 pt-2 border border-blue-500/50 rounded-lg overflow-hidden mt-1 bg-sidebar-accent", boxWidth)}>
                <div className="text-[13px] text-muted-foreground leading-relaxed pb-1">
                    {innerText}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}