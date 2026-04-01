import { useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useDeferredValue } from "react";
import { SigmaContainer, useSigma, useRegisterEvents, useCamera } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import { useStore, DEFAULT_FILTERS } from "../store/useStore";
import { useTheme } from "./theme-provider";
import { NodeBorderProgram } from "@sigma/node-border";
import { EdgeLineProgram, NodePointProgram } from "sigma/rendering";
import { adjustColorBrightness, desaturateColor } from "../lib/utils";
import { getGroups, checkMatch } from "../lib/filterUtils";
import { MultiDirectedGraph } from "graphology";

/** UI Configuration */
const GRAPH_CONFIG = {
    SELECTED_SCALE: 1.25,
    DEFAULT_NODE_SIZE: 10,
    ANIMATION_DURATION: 500,
    PADDING: 1.1,
} as const;

const EDGE_OPACITY_DARK = "rgba(255,255,255,0.6)";
const EDGE_OPACITY_LIGHT = "rgba(0,0,0,0.6)";

/** Attributes stored on Sigma nodes. */
interface NodeAttributes {
    label?: string | null;
    size?: number;
    x?: number;
    y?: number;
    color?: string;
    highlighted?: boolean;
    hidden?: boolean;
    nodeType?: string;
    type?: string;
    borderColor?: string;
    borderSize?: number;
    zIndex?: number;
    [key: string]: unknown;
}

/** Attributes stored on Sigma edges. */
interface EdgeAttributes {
    color?: string;
    hidden?: boolean;
    size?: number;
    [key: string]: unknown;
}

/** Specific settings used during drawing. */
interface SigmaDrawingSettings {
    labelSize: number;
    labelFont: string;
    labelWeight: string;
    labelColor: { color?: string; attribute?: string };
}

export interface GraphViewRef {
    zoomIn: () => void;
    zoomOut: () => void;
    resetCamera: () => void;
}

// ---------------------------------------------------------------------------
// GraphManager – syncs store data into Sigma and handles interactions
// ---------------------------------------------------------------------------

const GraphManager = forwardRef<GraphViewRef, unknown>((_, ref) => {
    const sigma = useSigma();
    const camera = useCamera({ duration: 250 });
    const registerEvents = useRegisterEvents();
    const {
        nodes, edges, isMultiSelect,
        toggleNodeSelection, selectedNodeId, setSelectedNodeId,
        searchQuery, viewLevel, setIsNodeSelecting, selectedNodeIds,
        pathNodeIds, pathEdgeIds,
        infoPanelMode, graphFilters: rawFilters, pathViewOnly
    } = useStore();
    const graphFilters = rawFilters ?? DEFAULT_FILTERS;
    const lastClickedNodeRef = useRef(false);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    // Defer search query to prevent input lag on heavy graphs
    const deferredSearchQuery = useDeferredValue(searchQuery);

    // -----------------------------------------------------------------------
    // 1. Node style computation (prominent border nodes)
    // -----------------------------------------------------------------------
    const nodeStyles = useMemo(() => {
        const styles = new Map<string, { borderColor?: string; borderSize?: number; color?: string; type?: string }>();
        if (!nodes || nodes.length === 0) return styles;

        const sizes = nodes.map(n => Number(n.size ?? GRAPH_CONFIG.DEFAULT_NODE_SIZE)).sort((a, b) => a - b);
        const mean = sizes.reduce((acc, val) => acc + val, 0) / sizes.length;
        const top5PercentSize = sizes[Math.floor(sizes.length * 0.95)] || 0;

        const prominentIds = new Set<string>();
        const communityMaxNodes = new Map<string | number, { id: string; size: number }>();
        const communityCounts = new Map<string | number, number>();

        for (const node of nodes) {
            const id = node.id as string;
            const attrs = node.attributes as Record<string, unknown>;
            const size = Number(node.size ?? GRAPH_CONFIG.DEFAULT_NODE_SIZE);

            if (attrs?.viewLevel === 5) prominentIds.add(id);
            if (size >= top5PercentSize && size > mean) prominentIds.add(id);

            const louvain = attrs?.louvain as string | number | undefined;
            if (louvain !== undefined) {
                communityCounts.set(louvain, (communityCounts.get(louvain) || 0) + 1);
                const currentMax = communityMaxNodes.get(louvain);
                if (!currentMax || size > currentMax.size) {
                    communityMaxNodes.set(louvain, { id, size });
                }
            }
        }

        communityMaxNodes.forEach((maxNode, louvainKey) => {
            const count = communityCounts.get(louvainKey) || 0;
            if (count > 1 && maxNode.size > mean * 0.5) {
                prominentIds.add(maxNode.id);
            }
        });

        for (const node of nodes) {
            const id = node.id;
            if (prominentIds.has(id)) {
                const attrs = node.attributes as Record<string, unknown>;
                const color = (node.color || attrs.color) as string | undefined;
                styles.set(id, {
                    type: "border",
                    borderColor: color ? adjustColorBrightness(color, -20) : (isDark ? "#ffffff" : "#000000"),
                    borderSize: 0.15,
                    color: color ? adjustColorBrightness(color, isDark ? 25 : -20) : undefined,
                });
            } else {
                styles.set(id, {});
            }
        }

        return styles;
    }, [nodes, isDark]);

    const communityIndex = useMemo(() => {
        const index = new Map<string | number, Set<string>>();
        for (const node of nodes) {
            const louvain = ((node.attributes as Record<string, unknown>)?.louvain) as string | number | undefined;
            if (louvain !== undefined) {
                let bucket = index.get(louvain);
                if (!bucket) { bucket = new Set<string>(); index.set(louvain, bucket); }
                bucket.add(node.id as string);
            }
        }
        return index;
    }, [nodes]);

    // Isolation data
    const isolationData = useMemo(() => {
        if (!selectedNodeId || infoPanelMode != 'node-info') return null;;

        const graph = sigma.getGraph();
        if (!graph.hasNode(selectedNodeId)) return null;

        const selectedAttrs = graph.getNodeAttribute(selectedNodeId, "attributes") as Record<string, unknown> | undefined;
        const selectedLouvain = selectedAttrs?.louvain as string | number | undefined;

        const communityNodes: Set<string> = selectedLouvain !== undefined
            ? (communityIndex.get(selectedLouvain) ?? new Set<string>())
            : new Set<string>();

        const neighborNodes = new Set<string>(graph.neighbors(selectedNodeId));

        return { communityNodes, neighborNodes, selectedLouvain };
    }, [selectedNodeId, sigma, communityIndex]);


    // Multi-select: derive path sets from store (populated by backend API)
    const multiSelectPathData = useMemo(() => {
        if (!isMultiSelect || pathNodeIds.length === 0) return null;

        // const graph = sigma.getGraph();
        const pathNodes = new Set<string>(pathNodeIds);
        const pathEdgeSet = new Set<string>(pathEdgeIds);
        const neighborNodes = new Set<string>();

        // for (const nodeId of pathNodes) {
        //     if (!graph.hasNode(nodeId)) continue;
        //     for (const nb of graph.neighbors(nodeId)) {
        //         if (!pathNodes.has(nb)) neighborNodes.add(nb);
        //     }
        // }
        for (const edge of edges) {
            if (pathNodes.has(edge.source) && !pathNodes.has(edge.target)) {
                neighborNodes.add(edge.target);
            }
            if (pathNodes.has(edge.target) && !pathNodes.has(edge.source)) {
                neighborNodes.add(edge.source);
            }
        }

        // Match backend path edges to sigma graph edges
        const graph = sigma.getGraph();
        const sigmaPathEdges = new Set<string>();
        const pathNodeArr = Array.from(pathNodes);
        for (let i = 0; i < pathNodeArr.length; i++) {
            for (let j = i + 1; j < pathNodeArr.length; j++) {
                const a = pathNodeArr[i], b = pathNodeArr[j];
                if (!graph.hasNode(a) || !graph.hasNode(b)) continue;
                for (const e of graph.edges(a, b)) sigmaPathEdges.add(e);
                for (const e of graph.edges(b, a)) sigmaPathEdges.add(e);
            }
        }
        for (const eId of pathEdgeSet) {
            if (graph.hasEdge(eId)) sigmaPathEdges.add(eId);
        }

        return { pathNodes, pathEdgeIds: sigmaPathEdges, neighborNodes };
    }, [isMultiSelect, pathNodeIds, pathEdgeIds, sigma, edges]);

    const fitToView = useCallback(() => {
        if (multiSelectPathData && isMultiSelect) {
            const nodesToFit = [...multiSelectPathData.pathNodes, ...multiSelectPathData.neighborNodes];
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let validNodesCount = 0;

            for (const id of nodesToFit) {
                const displayData = sigma.getNodeDisplayData(id) as { x: number, y: number } | undefined;
                if (displayData && typeof displayData.x === "number" && !isNaN(displayData.x) &&
                    typeof displayData.y === "number" && !isNaN(displayData.y)) {
                    minX = Math.min(minX, displayData.x);
                    maxX = Math.max(maxX, displayData.x);
                    minY = Math.min(minY, displayData.y);
                    maxY = Math.max(maxY, displayData.y);
                    validNodesCount++;
                }
            }

            if (validNodesCount > 0 && minX !== Infinity) {
                const dx = Math.max(maxX - minX, 0.05);
                const dy = Math.max(maxY - minY, 0.05);
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const ratio = Math.max(0.01, Math.min(Math.max(dx, dy) * GRAPH_CONFIG.PADDING, 1.5));
                sigma.getCamera().animate({ x: centerX, y: centerY, ratio }, { duration: GRAPH_CONFIG.ANIMATION_DURATION });
                return;
            }
        }
        if (isolationData && selectedNodeId) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let validCount = 0;

            const nodesToFit = [
                selectedNodeId,
                ...isolationData.communityNodes,
                ...isolationData.neighborNodes,
            ];

            for (const id of nodesToFit) {
                const d = sigma.getNodeDisplayData(id) as { x: number; y: number } | undefined;
                if (d && typeof d.x === "number" && !isNaN(d.x) && typeof d.y === "number" && !isNaN(d.y)) {
                    minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x);
                    minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
                    validCount++;
                }
            }

            if (validCount > 0 && minX !== Infinity) {
                const dx = Math.max(maxX - minX, 0.05);
                const dy = Math.max(maxY - minY, 0.05);
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const ratio = Math.max(0.01, Math.min(Math.max(dx, dy) * GRAPH_CONFIG.PADDING, 1.5));

                sigma.getCamera().animate({ x: centerX, y: centerY, ratio }, { duration: GRAPH_CONFIG.ANIMATION_DURATION });
                return;
            }
        }
        camera.reset({ duration: GRAPH_CONFIG.ANIMATION_DURATION });
    }, [sigma, camera, isolationData, selectedNodeId, multiSelectPathData, isMultiSelect]);

    useImperativeHandle(ref, () => ({
        zoomIn: camera.zoomIn,
        zoomOut: camera.zoomOut,
        resetCamera: fitToView,
    }), [camera, fitToView]);

    useEffect(() => {
        if (selectedNodeId) fitToView();
    }, [selectedNodeId, fitToView]);

    const prevNodeIds = useRef<Set<string>>(new Set());
    const prevEdgeIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        const graph = sigma.getGraph();
        const newNodeIds = new Set<string>();
        const newEdgeIds = new Set<string>();

        // Merge nodes
        for (const nodeItem of nodes) {
            const id = nodeItem.id as string;
            newNodeIds.add(id);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type, ...rest } = nodeItem;
            if (!graph.hasNode(id)) {
                graph.addNode(id, { ...rest });
            } else {
                graph.mergeNodeAttributes(id, rest);
            }
        }

        // Remove stale nodes
        for (const id of prevNodeIds.current) {
            if (!newNodeIds.has(id) && graph.hasNode(id)) graph.dropNode(id);
        }
        prevNodeIds.current = newNodeIds;

        // Merge edges
        for (const edge of edges) {
            const edgeId = edge.id as string;
            newEdgeIds.add(edgeId);
            if (!graph.hasEdge(edgeId)) {
                graph.addEdgeWithKey(edgeId, edge.source, edge.target, { ...edge });
            } else {
                graph.mergeEdgeAttributes(edgeId, edge);
            }
        }

        // Remove stale edges
        for (const id of prevEdgeIds.current) {
            if (!newEdgeIds.has(id) && graph.hasEdge(id)) graph.dropEdge(id);
        }
        prevEdgeIds.current = newEdgeIds;
    }, [nodes, edges, sigma]);

    // Click interactions
    useEffect(() => {
        registerEvents({
            clickNode: ({ node }) => {
                lastClickedNodeRef.current = true;
                setTimeout(() => {
                    if (isMultiSelect) {
                        toggleNodeSelection(node);
                    } else {
                        setIsNodeSelecting(true);
                        setSelectedNodeId(node === selectedNodeId ? null : node);
                    }
                }, 0);
            },
            doubleClickNode: () => setSelectedNodeId(null),
            clickStage: () => {
                if (lastClickedNodeRef.current) { lastClickedNodeRef.current = false; return; }
                setSelectedNodeId(null);
            },
            doubleClickStage: () => setSelectedNodeId(null),
        });
    }, [registerEvents, setSelectedNodeId, selectedNodeId, setIsNodeSelecting, isMultiSelect, toggleNodeSelection]);

    useEffect(() => {
        setIsNodeSelecting(false);
    }, [selectedNodeId, selectedNodeIds, setIsNodeSelecting]);

    useEffect(() => {
        let frameOne = 0;
        let frameTwo = 0;

        frameOne = requestAnimationFrame(() => {
            frameTwo = requestAnimationFrame(() => {
                sigma.resize(true);
                sigma.refresh();
            });
        });

        return () => {
            cancelAnimationFrame(frameOne);
            cancelAnimationFrame(frameTwo);
        };
    }, [sigma, infoPanelMode]);

    const stateRef = useRef({
        selectedNodeId,
        isMultiSelect,
        selectedNodeIds,
        nodeStyles,
        visibleNodes: new Set<string>(),
        isolationData,
        multiSelectPathData,
        isDark,
        pathViewOnly,
        // Edge endpoint cache to avoid graph.source()/target() per frame
        edgeEndpoints: new Map<string, { source: string; target: string }>(),
    });

    // Keep ref in sync
    useEffect(() => {
        stateRef.current.selectedNodeId = selectedNodeId;
        stateRef.current.isMultiSelect = isMultiSelect;
        stateRef.current.selectedNodeIds = selectedNodeIds;
        stateRef.current.nodeStyles = nodeStyles;
        stateRef.current.isolationData = isolationData;
        stateRef.current.multiSelectPathData = multiSelectPathData;
        stateRef.current.isDark = isDark;
        stateRef.current.pathViewOnly = pathViewOnly;
        sigma.refresh();
    }, [selectedNodeId, isMultiSelect, selectedNodeIds, nodeStyles, isolationData, multiSelectPathData, isDark, pathViewOnly, sigma]);
    
    useEffect(() => {
        const graph = sigma.getGraph();
        const cache = new Map<string, { source: string; target: string }>();
        graph.forEachEdge((edge: string) => {
            cache.set(edge, { source: graph.source(edge), target: graph.target(edge) });
        });
        stateRef.current.edgeEndpoints = cache;
    }, [edges, sigma]);

    // Visibility filter – runs on search/viewLevel/selection/filter changes
    useEffect(() => {
        const graph = sigma.getGraph();
        const query = deferredSearchQuery.toLowerCase();
        const labelGroups = getGroups(graphFilters.labelKeywords || []);
        const descGroups = getGroups(graphFilters.descriptionKeywords || []);

        const visibleNodes = new Set<string>();

        graph.forEachNode((id: string, attrs: NodeAttributes) => {
            const label = String(attrs.label ?? "");
            const matchesSearch = !!selectedNodeId || !query || label.toLowerCase().includes(query);
            const level = ((attrs.attributes as Record<string, unknown>)?.viewLevel as number) ?? 1;

            const nodeAttrs = attrs.attributes as Record<string, unknown>;
            const matchesLabel = checkMatch(label, labelGroups);
            const matchesDesc = checkMatch(
                ((nodeAttrs?.definition as string) ?? '') +
                ((nodeAttrs?.synonyms as string[]) ?? []).join(' '),
                descGroups
            );
            const rank = (nodeAttrs?.percentile_rank as number) ?? 0;
            const matchesImportance = rank >= graphFilters.minImportance;
            const matchesColor = !graphFilters.excludedColors.has(attrs.color as string);

            let isVisible = matchesSearch && level >= viewLevel && matchesLabel && matchesDesc && matchesImportance && matchesColor;

            if (selectedNodeId && isolationData) {
                isVisible = isVisible && (
                    id === selectedNodeId ||
                    isolationData.communityNodes.has(id) ||
                    isolationData.neighborNodes.has(id)
                );
            }

            // Multi-select path isolation
            if (isMultiSelect && multiSelectPathData) {
                isVisible = multiSelectPathData.pathNodes.has(id) ||
                    (multiSelectPathData.neighborNodes.has(id) && level >= viewLevel);
            }

            if (isVisible) visibleNodes.add(id);
        });

        stateRef.current.visibleNodes = visibleNodes;
        // update graph (note: this does not perform a hard refresh on the browser)
        sigma.refresh();
    }, [nodes, edges, deferredSearchQuery, viewLevel, selectedNodeId, isolationData, isMultiSelect, multiSelectPathData, selectedNodeIds, sigma, graphFilters]);

    useEffect(() => {
        const graph = sigma.getGraph();

        sigma.setSetting("nodeReducer", (node: string, data: NodeAttributes) => {
            const state = stateRef.current;
            const isSelected = state.isMultiSelect
                ? state.selectedNodeIds.includes(node)
                : node === state.selectedNodeId;

            let opacity = 1;
            let hidden = false;
            let color = data.color;

            if (state.isMultiSelect && state.selectedNodeIds.length >= 2) {
                const isRelated = state.multiSelectPathData
                    ? state.multiSelectPathData.pathNodes.has(node)
                    : state.selectedNodeIds.includes(node);

                if (!isRelated) {
                    if (state.pathViewOnly) {
                        hidden = true; // path view: hide unrelated nodes
                    } else {
                        opacity = 0.08;
                        color = desaturateColor(color || "#888", 0.7);
                    }
                }
            } else if (!state.isMultiSelect) {
                if (!state.visibleNodes.has(node)) {
                    hidden = true;
                }
            }

            const size = Math.max(0.1, Number(data.size) || GRAPH_CONFIG.DEFAULT_NODE_SIZE);
            let finalSize = isSelected ? size * GRAPH_CONFIG.SELECTED_SCALE : size;
            let highlighted = isSelected;

            // Multi-select path styling
            if (state.isMultiSelect && state.multiSelectPathData) {
                if (state.multiSelectPathData.pathNodes.has(node)) {
                    finalSize = size * GRAPH_CONFIG.SELECTED_SCALE;
                    if (isSelected) {
                        highlighted = true; // selected endpoints = orange overlay
                    } else {
                        highlighted = false;
                    }
                } else if (state.multiSelectPathData.neighborNodes.has(node)) {
                    color = adjustColorBrightness(color || "#888", state.isDark ? -30 : 30);
                }
            }

            const style = state.nodeStyles.get(node) ?? {};

            return {
                type: "circle",
                ...data,
                ...style,
                size: finalSize,
                color,
                highlighted,
                zIndex: finalSize,
                // hidden: !state.visibleNodes.has(node),
                hidden,
                opacity: opacity
            };
        });

        sigma.setSetting("edgeReducer", (edge: string, data: EdgeAttributes) => {
            const state = stateRef.current;
            // Use cached endpoints – avoids per-frame graph lookups
            const ep = state.edgeEndpoints.get(edge);
            if (!ep) return { ...data, hidden: true };
            const { source, target } = ep;

            const res = { ...data, size: Math.max(0.1, Number(data.size) || 1) };

            if (!state.visibleNodes.has(source) || !state.visibleNodes.has(target)) {
                return { ...res, hidden: true };
            }

            res.color = state.isDark ? EDGE_OPACITY_DARK : EDGE_OPACITY_LIGHT;

            // Multi-select path edge styling
            if (state.isMultiSelect && state.multiSelectPathData && graph.hasEdge(edge)) {
                if (state.multiSelectPathData.pathEdgeIds.has(edge)) {
                    res.color = "#ef4444"; // path edges = red
                    res.size = 5;
                } else {
                    res.color = state.isDark // all other edges = white
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.2)";
                    res.size = 1;
                }
                return res;
            }

            if (state.selectedNodeId && graph.hasEdge(edge)) {
                const selId = state.selectedNodeId;
                const isConnected = source === selId || target === selId;

                if (isConnected) {
                    const neighborId = source === selId ? target : source;
                    const sLouvain = (graph.getNodeAttribute(selId, "attributes") as Record<string, unknown>)?.louvain;
                    const nLouvain = (graph.getNodeAttribute(neighborId, "attributes") as Record<string, unknown>)?.louvain;

                    if (sLouvain !== undefined && sLouvain === nLouvain) {
                        res.color = (graph.getNodeAttribute(selId, "color") as string) || (state.isDark ? "#ffffff" : "#000000");
                        res.size = 2;
                    } else {
                        res.color = "#fbbf24";
                        res.size = 3;
                    }
                } else if (state.isolationData) {
                    const { communityNodes } = state.isolationData;
                    if (communityNodes.has(source) && communityNodes.has(target)) {
                        res.color = state.isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
                        res.size = 1;
                    } else {
                        return { ...res, hidden: true };
                    }
                } else {
                    res.color = state.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
                }
            }
            return res;
        });
        
        sigma.refresh();

        return () => {
            sigma.setSetting("nodeReducer", null);
            sigma.setSetting("edgeReducer", null);
        };
    }, [sigma]);

    return null;
});

// ---------------------------------------------------------------------------
// GraphView – public component wrapping SigmaContainer with themed settings
// ---------------------------------------------------------------------------

export const GraphView = forwardRef<GraphViewRef, unknown>((_, ref) => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const colours = useMemo(
        () => ({
            label: isDark ? "#f8fafc" : "#0f172a",
            highlight: "#fbbf24",
            highlightLabel: "#000000",
        }),
        [isDark],
    );

    const lastFontRef = useRef<string>("");

    const drawOverlay = useCallback(
        (ctx: CanvasRenderingContext2D, data: NodeAttributes, settings: SigmaDrawingSettings) => {
            const { label, x, y, size } = data;
            if (!label || x === undefined || y === undefined || size === undefined) return;

            const { labelSize, labelFont, labelWeight } = settings;
            const pad = 4;
            const font = `${labelWeight} ${labelSize}px ${labelFont}`;

            if (lastFontRef.current !== font) { ctx.font = font; lastFontRef.current = font; }
            const textW = ctx.measureText(label).width;

            // Highlight ring
            ctx.beginPath();
            ctx.fillStyle = colours.highlight;
            ctx.arc(x, y, size + pad, 0, Math.PI * 2);
            ctx.fill();

            // Label pill
            const rx = x + size + pad;
            const ry = y - labelSize / 2 - pad;

            ctx.beginPath();
            ctx.fillStyle = colours.highlight;
            ctx.shadowColor = "rgba(0,0,0,0.2)";
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;

            if (ctx.roundRect) ctx.roundRect(rx, ry, textW + pad * 2, labelSize + pad * 2, 4);
            else ctx.rect(rx, ry, textW + pad * 2, labelSize + pad * 2);

            ctx.fill();
            ctx.shadowBlur = 0;

            // Label text
            ctx.fillStyle = colours.highlightLabel;
            ctx.fillText(label, rx + pad, y + labelSize / 3);
        },
        [colours],
    );

    const defaultDrawNodeLabel = useCallback(
        (ctx: CanvasRenderingContext2D, data: NodeAttributes, settings: SigmaDrawingSettings) => {
            const { label, x, y, size, highlighted } = data;
            if (!label || x === undefined || y === undefined || size === undefined) return;
            if (highlighted) return drawOverlay(ctx, data, settings);

            const font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
            if (lastFontRef.current !== font) { ctx.font = font; lastFontRef.current = font; }
            ctx.fillStyle = colours.label;
            ctx.fillText(label, x + size + 4, y + settings.labelSize / 3);
        },
        [colours, drawOverlay],
    );

    const sigmaSettings = useMemo(
        () => ({
            allowInvalidContainer: true,
            zIndex: true,
            renderLabels: true,
            renderEdgeLabels: false,
            labelDensity: 0.5,
            labelGridCellSize: 100,
            zoomToSizeRatioFunction: (ratio: number) => ratio,
            labelFont: "Inter, system-ui, sans-serif",
            labelSize: 11,
            labelWeight: "500",
            labelColor: { color: colours.label },
            defaultNodeColor: colours.label,
            defaultEdgeColor: isDark ? EDGE_OPACITY_DARK : EDGE_OPACITY_LIGHT,
            defaultDrawNodeHover: drawOverlay,
            defaultDrawNodeLabel: defaultDrawNodeLabel,
            nodeProgramClasses: {
                circle: NodePointProgram,
                border: NodeBorderProgram,
            },
            defaultNodeType: "circle",
            edgeProgramClasses: {
                line: EdgeLineProgram,
            },
            defaultEdgeType: "line",
        }),
        [colours, drawOverlay, defaultDrawNodeLabel, isDark],
    );

    return (
        <SigmaContainer
            graph={MultiDirectedGraph}
            className={`absolute inset-0 w-full h-full ${isDark ? "!bg-black" : "!bg-white"} bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[length:24px_24px]`}
            settings={sigmaSettings}
        >
            <GraphManager ref={ref} />
        </SigmaContainer>
    );
});
