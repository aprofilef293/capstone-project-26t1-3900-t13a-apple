import type { GraphNode, GraphFilters, TagKeyword } from "../store/useStore";

/*  Helper functions for graph filtering.
 *  Main Contributors: Joseph, Lucy
 */

export type KeywordGroups = {
    include: string[];
    mandatory: string[];
    exclude: string[];
};

export function getGroups(kws: TagKeyword[]): KeywordGroups {
    return {
        include: kws.filter(k => k.mode === 'include').map(k => k.text.toLowerCase().trim()).filter(Boolean),
        mandatory: kws.filter(k => k.mode === 'mandatory').map(k => k.text.toLowerCase().trim()).filter(Boolean),
        exclude: kws.filter(k => k.mode === 'exclude').map(k => k.text.toLowerCase().trim()).filter(Boolean),
    };
}

export function checkMatch(text: string, groups: KeywordGroups): boolean {
    const t = text.toLowerCase();
    if (groups.exclude.some(kw => t.includes(kw))) return false;
    if (groups.mandatory.length > 0 && !groups.mandatory.every(kw => t.includes(kw))) return false;
    if (groups.include.length > 0 && !groups.include.some(kw => t.includes(kw))) return false;
    return true;
}

export function hasActiveGraphFilters(filters: GraphFilters): boolean {
    return (
        filters.labelKeywords.length > 0 ||
        filters.descriptionKeywords.length > 0 ||
        filters.minImportance > 0 ||
        filters.excludedColors.size > 0
    );
}

export function matchesGraphFilters(node: GraphNode, filters: GraphFilters): boolean {
    const label = node.label || node.id;
    const attrs = node.attributes;
    const rank = (attrs?.percentile_rank as number) ?? 0;

    if (rank < filters.minImportance) return false;
    if (filters.excludedColors.has(node.color)) return false;

    const labelGroups = getGroups(filters.labelKeywords || []);
    const descGroups = getGroups(filters.descriptionKeywords || []);

    const descText =
        ((attrs?.definition as string) ?? '') +
        ((attrs?.synonyms as string[]) ?? []).join(' ');

    const isSimpleMode = (filters.descriptionKeywords || []).length === 0;
    if (isSimpleMode) {
        if (!checkMatch(label + ' ' + descText, labelGroups)) return false;
    } else {
        // Advanced mode: name must match labelGroups AND description must match descGroups
        if (!checkMatch(label, labelGroups)) return false;
        if (!checkMatch(descText, descGroups)) return false;
    }

    return true;
}
