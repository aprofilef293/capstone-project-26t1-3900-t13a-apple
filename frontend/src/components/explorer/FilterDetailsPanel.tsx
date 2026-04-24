import { useState, useRef, useEffect } from "react";
import { Filter, X, RotateCcw, Check, Asterisk, Ban, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { useStore, DEFAULT_FILTERS } from "../../store/useStore";
import type { TagKeyword, TagMode } from "../../store/useStore";
import { cn } from "../../lib/utils";
import { InfoHelpIcon } from "../InfoHelpIcon";


function countActiveFilters(filters: {
    labelKeywords: TagKeyword[];
    descriptionKeywords: TagKeyword[];
    minImportance: number;
}) {
    let n = filters.labelKeywords.length + filters.descriptionKeywords.length;
    if (filters.minImportance > 0) n++;
    return n;
}


function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
            {children}
        </div>
    );
}


function TagInput({
    tags,
    onAdd,
    onRemove,
    onToggleMode,
    placeholder,
    id
}: {
    tags: TagKeyword[];
    onAdd: (text: string) => void;
    onRemove: (text: string) => void;
    onToggleMode: (text: string, mode?: TagMode) => void;
    placeholder: string;
    id: string;
}) {
    const [inputValue, setInputValue] = useState("");
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (activeMenu && !(e.target as HTMLElement).closest('.relative')) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeMenu]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = inputValue.trim().replace(/,$/, "");
            if (val && !tags.some(t => t.text === val)) {
                onAdd(val);
                setInputValue("");
            }
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            onRemove(tags[tags.length - 1].text);
        }
    };

    const handleBlur = () => {
        const val = inputValue.trim();
        if (val && !tags.some(t => t.text === val)) {
            onAdd(val);
            setInputValue("");
        }
    };

    const getModeStyles = (mode: TagMode) => {
        switch (mode) {
            case 'mandatory':
                return {
                    bg: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
                    halo: "shadow-[0_0_8px_rgba(168,85,247,0.25)]",
                    icon: <Asterisk className="w-3 h-3" />,
                    label: "Only Must"
                };
            case 'exclude':
                return {
                    bg: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
                    halo: "shadow-[0_0_8px_rgba(239,68,68,0.25)]",
                    icon: <Ban className="w-3 h-3" />,
                    label: "Exclude"
                };
            default:
                return {
                    bg: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
                    halo: "shadow-[0_0_8px_rgba(59,130,246,0.25)]",
                    icon: <Check className="w-3 h-3" />,
                    label: "Include"
                };
        }
    };

    return (
        <div className={cn(
            "flex flex-wrap gap-1.5 p-2 min-h-[38px] bg-sidebar-accent/40 border border-sidebar-border rounded-lg focus-within:ring-1 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all cursor-text",
            tags.length > 0 ? "pb-2" : ""
        )} onClick={() => document.getElementById(id)?.focus()}>
            {tags.map((tag) => {
                const styles = getModeStyles(tag.mode);
                return (
                    <div key={tag.text} className="relative">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1.5 pl-1.5 pr-1 py-1 border rounded-md text-[12px] font-medium transition-all animate-in zoom-in-95 duration-150 select-none",
                                styles.bg,
                                styles.halo
                            )}
                        >
                            <div 
                                className="pr-1 border-r border-current/20"
                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === tag.text ? null : tag.text); }}
                            >
                                <div className="flex items-center gap-0.5 cursor-pointer hover:text-black dark:hover:text-white transition-all">
                                    {styles.icon}
                                    <ChevronDown className="w-3 h-3" />
                                </div>
                            </div>
                            
                            {tag.text}
                            
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(tag.text); }}
                                className="p-0.5 rounded-sm hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white transition-all ml-0.5 cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>

                        {activeMenu === tag.text && (
                            <div className="absolute top-full left-0 mt-1.5 z-50 w-36 bg-sidebar/95 backdrop-blur-md border border-sidebar-border rounded-lg shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                {(['include', 'mandatory', 'exclude'] as TagMode[]).map((m) => {
                                    const mStyles = getModeStyles(m);
                                    return (
                                        <button
                                            key={m}
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                onToggleMode(tag.text, m); 
                                                setActiveMenu(null); 
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-medium transition-colors hover:bg-sidebar-accent",
                                                tag.mode === m ? "text-foreground" : "text-muted-foreground"
                                            )}
                                        >
                                            <span className={cn("p-0.5 rounded", mStyles.bg)}>{mStyles.icon}</span>
                                            <span className="capitalize">{m}</span>
                                            {tag.mode === m && <Check className="w-2.5 h-2.5 ml-auto text-blue-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
            <input
                id={id}
                type="text"
                value={inputValue}
                spellCheck
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={tags.length === 0 ? placeholder : "Add..."}
                className={cn(
                    "flex-1 bg-transparent border-none outline-none text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 min-w-[60px] py-1 ml-1",
                    tags.length > 0 ? "placeholder:text-sidebar-foreground/20" : ""
                )}
            />
        </div>
    );
}

function KeywordInfo() {
    return (<div className="flex flex-col gap-1.5">
        <p>Type tags to filter graph nodes. Click any active tag to change its rule:</p>
        <ul className="pl-4 space-y-0.5 list-none">
            <li className="relative before:content-[''] before:absolute before:-left-3 before:top-1.5 before:w-1 before:h-1 before:bg-blue-500 before:rounded-full">
                <span className="font-medium text-foreground/70">Include (OR):</span> Show if node has any of these.
            </li>
            <li className="relative before:content-[''] before:absolute before:-left-3 before:top-1.5 before:w-1 before:h-1 before:bg-purple-500 before:rounded-full">
                <span className="font-medium text-foreground/70">Mandatory (AND):</span> Node must have all of these.
            </li>
            <li className="relative before:content-[''] before:absolute before:-left-3 before:top-1.5 before:w-1 before:h-1 before:bg-red-500 before:rounded-full">
                <span className="font-medium text-foreground/70">Exclude (NOT):</span> Always hide if node has these.
            </li>
        </ul>
    </div>)
}

export function GraphFilterPanel() {
    const { graphFilters: rawFilters, setGraphFilters, resetGraphFilters } = useStore();
    const graphFilters = rawFilters ?? DEFAULT_FILTERS;
    const [isOpen, setIsOpen] = useState(false);
    const [isAdvanced, setIsAdvanced] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const activeCount = countActiveFilters(graphFilters);

    return (
        <div ref={panelRef} className="relative pointer-events-auto">
            <button
                id="graph-filter-toggle"
                onClick={() => setIsOpen((v) => !v)}
                className={cn(
                    "relative flex items-center justify-center w-[46px] h-[46px] rounded-lg border shadow-sm backdrop-blur-sm transition-all duration-200 cursor-pointer",
                    activeCount > 0
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                        : "bg-sidebar/95 border-sidebar-border text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
                title="Graph filters"
                aria-expanded={isOpen}
            >
                <Filter className="w-[18px] h-[18px] flex-shrink-0" />
                {activeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold border-2 border-background shadow-sm animate-in zoom-in duration-200">
                        {activeCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div
                    id="graph-filter-panel"
                    className={cn(
                        "absolute top-full left-0 mt-2 z-50",
                        "w-72 bg-sidebar/95 backdrop-blur-md border border-sidebar-border rounded-xl shadow-xl",
                        "animate-in fade-in slide-in-from-top-2 duration-150"
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
                        <div className="flex items-center gap-2">
                            <Filter className="w-3.5 h-3.5 text-sidebar-foreground/70" />
                            <span className="text-xs font-semibold text-sidebar-foreground">Graph Filter Conditions</span>
                            <InfoHelpIcon innerText={KeywordInfo()} boxWidth="w-80" side="bottom" align="start" />
                        </div>
                        <div className="flex items-center gap-1">
                            {activeCount > 0 && (
                                <button
                                    onClick={resetGraphFilters}
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
                                    title="Reset all filters"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 space-y-5">

                        {/* Keyword filters — simple or advanced */}
                        <div className="space-y-3">
                            {!isAdvanced ? (
                                /* Simple mode: single input applies to both name and description */
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <SectionLabel>Name &amp; Description</SectionLabel>
                                        <button
                                            onClick={() => setIsAdvanced(true)}
                                            className="flex items-center text-[11px] font-medium text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent px-1.5 py-0.5 mb-1 rounded transition-colors cursor-pointer"
                                            title="Split into separate name and description filters"
                                        >
                                            Split <ChevronRight className="w-3 h-3 mt-0.5" />
                                        </button>
                                    </div>
                                    <TagInput
                                        id="filter-combined-keyword"
                                        tags={graphFilters.labelKeywords}
                                        onAdd={(text) => setGraphFilters({
                                            labelKeywords: [...graphFilters.labelKeywords, { text, mode: 'include' }],
                                        })}
                                        onRemove={(text) => setGraphFilters({
                                            labelKeywords: graphFilters.labelKeywords.filter(t => t.text !== text),
                                        })}
                                        onToggleMode={(text, mode) => setGraphFilters({
                                            labelKeywords: graphFilters.labelKeywords.map(t =>
                                                t.text === text
                                                    ? { ...t, mode: mode ?? (t.mode === 'include' ? 'mandatory' : t.mode === 'mandatory' ? 'exclude' : 'include') as TagMode }
                                                    : t
                                            ),
                                        })}
                                        placeholder="Filter by keywords"
                                    />
                                </div>
                            ) : (
                                /* Advanced mode: separate inputs */
                                <>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <SectionLabel>Node name contains</SectionLabel>
                                            <button
                                                onClick={() => {
                                                    const merged = [...graphFilters.labelKeywords];
                                                    for (const tag of graphFilters.descriptionKeywords) {
                                                        if (!merged.some(t => t.text === tag.text)) merged.push(tag);
                                                    }
                                                    setGraphFilters({ labelKeywords: merged, descriptionKeywords: [] });
                                                    setIsAdvanced(false);
                                                }}
                                                className="flex items-center text-[11px] font-medium text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent px-1.5 py-0.5 mb-1 rounded transition-colors cursor-pointer"
                                                title="Combine name and description into one filter"
                                            >
                                                <ChevronLeft className="w-3 h-3 mt-0.5" /> Combine
                                            </button>
                                        </div>
                                        <TagInput
                                            id="filter-label-keyword"
                                            tags={graphFilters.labelKeywords}
                                            onAdd={(text) => setGraphFilters({ labelKeywords: [...graphFilters.labelKeywords, { text, mode: 'include' }] })}
                                            onRemove={(text) => setGraphFilters({ labelKeywords: graphFilters.labelKeywords.filter(t => t.text !== text) })}
                                            onToggleMode={(text, mode) => setGraphFilters({
                                                labelKeywords: graphFilters.labelKeywords.map(t =>
                                                    t.text === text 
                                                        ? { ...t, mode: mode ?? (t.mode === 'include' ? 'mandatory' : t.mode === 'mandatory' ? 'exclude' : 'include') as TagMode } 
                                                        : t
                                                )
                                            })}
                                            placeholder="Filter name by keywords"
                                        />
                                    </div>
                                    <div>
                                        <SectionLabel>Description contains</SectionLabel>
                                        <TagInput
                                            id="filter-description-keyword"
                                            tags={graphFilters.descriptionKeywords}
                                            onAdd={(text) => setGraphFilters({ descriptionKeywords: [...graphFilters.descriptionKeywords, { text, mode: 'include' }] })}
                                            onRemove={(text) => setGraphFilters({ descriptionKeywords: graphFilters.descriptionKeywords.filter(t => t.text !== text) })}
                                            onToggleMode={(text, mode) => setGraphFilters({
                                                descriptionKeywords: graphFilters.descriptionKeywords.map(t =>
                                                    t.text === text 
                                                        ? { ...t, mode: mode ?? (t.mode === 'include' ? 'mandatory' : t.mode === 'mandatory' ? 'exclude' : 'include') as TagMode } 
                                                        : t
                                                )
                                            })}
                                            placeholder="Filter description by keywords"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Minimal Mode Legend */}
                            <div className="flex flex-wrap flex-col gap-x-3 gap-y-1.5 px-0.5 text-[11.5px]">
                                <div className="flex items-center gap-1 text-blue-500/80">
                                    <Check className="w-2.5 h-2.5" /> <span>Include (OR)</span>
                                </div>
                                <div className="flex items-center gap-1 text-purple-500/80">
                                    <Asterisk className="w-2.5 h-2.5" /> <span>Mandatory (AND)</span>
                                </div>
                                <div className="flex items-center gap-1 text-red-500/80">
                                    <Ban className="w-2.5 h-2.5" /> <span>Exclude (NOT)</span>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-sidebar-border/60" />

                        {/* Min importance slider */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex justify-start gap-2">
                                    <SectionLabel>Min. importance</SectionLabel>
                                    <InfoHelpIcon innerText={<p>Slide right to hide less-connected nodes and focus on the core structure.</p>} boxWidth="w-65" side="bottom" align="start" />
                                </div>
                                <span className="text-[11px] font-mono text-sidebar-foreground/70 tabular-nums">
                                    {graphFilters.minImportance > 0
                                        ? `≥ ${Math.round(graphFilters.minImportance * 100)}%`
                                        : "All"}
                                </span>
                            </div>
                            <input
                                id="filter-min-importance"
                                type="range"
                                min="0"
                                max="0.99"
                                step="0.01"
                                value={graphFilters.minImportance}
                                onChange={(e) => setGraphFilters({ minImportance: Number(e.target.value) })}
                                className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                            />
                            <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                                <span>All nodes</span>
                                <span>Core nodes only</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}