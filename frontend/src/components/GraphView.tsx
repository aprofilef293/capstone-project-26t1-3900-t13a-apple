import { useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useDeferredValue } from "react";
import { SigmaContainer, useSigma, useRegisterEvents, useCamera } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import { useStore } from "../store/useStore";
import { useTheme } from "./theme-provider";
import { NodeBorderProgram } from "@sigma/node-border";
import { EdgeLineProgram } from "sigma/rendering";
import { adjustColorBrightness } from "../lib/utils";

/** UI Configuration */
const GRAPH_CONFIG = {
    SELECTED_SCALE: 1.25,
    DEFAULT_NODE_SIZE: 10,
    ANIMATION_DURATION: 500,
    MIN_BBOX_SIZE: 0.05,
    PADDING: 1.1,
    ISOLATION_OPACITY: {
        DARK: "rgba(255,255,255,0.15)",
        LIGHT: "rgba(0,0,0,0.15)"
    },
    EDGE_OPACITY: {
        DARK: "rgba(255,255,255,0.6)",
        LIGHT: "rgba(0,0,0,0.6)"
    }
} as const;

/** Attributes stored on Sigma nodes. */
interface NodeAttributes {
    label: string | null;
    size: number;
    x: number;
    y: number;
    color: string;
    highlighted?: boolean;
    hidden?: boolean;
    nodeType?: string;
    type?: string;
    borderColor?: string;
    borderSize?: number;
    [key: string]: unknown;
}

/** Attributes stored on Sigma edges. */
interface EdgeAttributes {
    color: string;
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
    const { nodes, edges, selectedNodeId, setSelectedNodeId, searchQuery, viewLevel } = useStore();
    const lastClickedNodeRef = useRef(false);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    // Defer the search query to prevent input lag on heavy graphs
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const largestNodesIds = useMemo(() => {
        if (!nodes || nodes.length === 0) return new Set<string>();

        // Calculate Global Size Percentiles & Average
        const sizes = nodes.map(n => Number(n.size ?? GRAPH_CONFIG.DEFAULT_NODE_SIZE)).sort((a, b) => a - b);
        const sum = sizes.reduce((acc, val) => acc + val, 0);
        const mean = sum / sizes.length;

        // Find the top 5% threshold
        const p95Index = Math.floor(sizes.length * 0.95);
        const top5PercentSize = sizes[p95Index] || 0;

        const prominentIds = new Set<string>();
        const communityMaxNodes = new Map<string | number, { id: string; size: number }>();
        const communityCounts = new Map<string | number, number>();

        nodes.forEach(node => {
            const id = node.id as string;
            const attrs = node.attributes as Record<string, unknown>;
            const size = Number(node.size ?? GRAPH_CONFIG.DEFAULT_NODE_SIZE);
            const isHub = attrs?.viewLevel === 5;
            const louvain = attrs?.louvain as string | number | undefined;
            if (isHub) {
                prominentIds.add(id);
            }

            if (size >= top5PercentSize && size > mean) {
                prominentIds.add(id);
            }

            if (louvain !== undefined) {
                communityCounts.set(louvain, (communityCounts.get(louvain) || 0) + 1);

                const currentMax = communityMaxNodes.get(louvain);
                if (!currentMax || size > currentMax.size) {
                    communityMaxNodes.set(louvain, { id, size });
                }
            }
        });

        communityMaxNodes.forEach((maxNode, louvainKey) => {
            const count = communityCounts.get(louvainKey) || 0;
            if (count > 1 && maxNode.size > mean * 0.5) {
                prominentIds.add(maxNode.id);
            }
        });

        return prominentIds;
    }, [nodes]);

    // Calculate community and neighbor isolation sets
    const isolationData = useMemo(() => {
        if (!selectedNodeId) return null;

        const graph = sigma.getGraph();
        if (!graph.hasNode(selectedNodeId)) return null;

        const selectedAttrs = graph.getNodeAttribute(selectedNodeId, "attributes") as Record<string, unknown> | undefined;
        const selectedLouvain = selectedAttrs?.louvain;

        const communityNodes = new Set<string>();
        const neighborNodes = new Set<string>(graph.neighbors(selectedNodeId));

        if (selectedLouvain !== undefined) {
            graph.forEachNode((node: string, attrs: unknown) => {
                const nodeAttrs = (attrs as NodeAttributes).attributes as Record<string, unknown> | undefined;
                if (nodeAttrs?.louvain === selectedLouvain) {
                    communityNodes.add(node);
                }
            });
        }

        return {
            communityNodes,
            neighborNodes,
            selectedLouvain
        };
    }, [selectedNodeId, sigma]);
    useImperativeHandle(ref, () => ({
        zoomIn: camera.zoomIn,
        zoomOut: camera.zoomOut,
        resetCamera: () => {
            if (isolationData) {

                const nodesToFit = Array.from(new Set([
                    selectedNodeId!,
                    ...isolationData.communityNodes,
                    ...isolationData.neighborNodes
                ]));

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
                    let dx = maxX - minX;
                    let dy = maxY - minY;

                    dx = Math.max(dx, 0.05);
                    dy = Math.max(dy, 0.05);

                    const centerX = (minX + maxX) / 2;
                    const centerY = (minY + maxY) / 2;
                    // 10% padding
                    let ratio = Math.max(dx, dy) * GRAPH_CONFIG.PADDING;

                    ratio = Math.max(0.01, Math.min(ratio, 1.5));

                    sigma.getCamera().animate(
                        { x: centerX, y: centerY, ratio },
                        { duration: GRAPH_CONFIG.ANIMATION_DURATION }
                    );
                    return;
                }
            }

            // Fallback or default reset
            camera.reset({ duration: GRAPH_CONFIG.ANIMATION_DURATION });
        },
    }), [camera, isolationData, selectedNodeId, sigma]);

    useEffect(() => {
        const graph = sigma.getGraph();

        if (graph.order === 0 && nodes.length > 0) {
            graph.import({
                nodes: nodes.map(({ type, ...data }) => ({
                    key: data.id as string,
                    attributes: { ...data, nodeType: type }
                })),
                edges: edges.map((e) => ({
                    key: e.id as string,
                    source: e.source as string,
                    target: e.target as string,
                    attributes: e
                }))
            });
            return;
        }

        const currentNodes = new Set(graph.nodes() as string[]);
        const currentEdges = new Set(graph.edges() as string[]);
        const incomingNodeIds = new Set(nodes.map(n => n.id as string));
        const incomingEdgeIds = new Set(edges.map(e => e.id as string));

        currentNodes.forEach(id => !incomingNodeIds.has(id) && graph.dropNode(id));
        currentEdges.forEach(id => !incomingEdgeIds.has(id) && graph.dropEdge(id));

        nodes.forEach(({ type, ...data }) => {
            const id = data.id as string;
            if (!graph.hasNode(id)) {
                graph.addNode(id, { ...data, nodeType: type });
            } else {
                graph.mergeNodeAttributes(id, { ...data, nodeType: type });
            }
        });

        edges.forEach(edge => {
            if (!graph.hasEdge(edge.id as string)) {
                graph.addEdgeWithKey(edge.id as string, edge.source as string, edge.target as string, edge);
            } else {
                graph.mergeEdgeAttributes(edge.id as string, edge);
            }
        });
    }, [nodes, edges, isDark, sigma]);

    // Click interactions
    useEffect(() => {
        registerEvents({
            clickNode: ({ node }) => {
                lastClickedNodeRef.current = true;
                setSelectedNodeId(node === selectedNodeId ? null : node);
            },
            doubleClickNode: () => setSelectedNodeId(null),
            clickStage: () => {
                if (lastClickedNodeRef.current) {
                    lastClickedNodeRef.current = false;
                    return;
                }
                setSelectedNodeId(null);
            },
            doubleClickStage: () => setSelectedNodeId(null),
        });
    }, [registerEvents, setSelectedNodeId, selectedNodeId]);

    // Node & Edge Styling (Reducers)
    useEffect(() => {
        const graph = sigma.getGraph();

        sigma.setSetting("nodeReducer", (node: string, data: NodeAttributes) => {
            const isSelected = node === selectedNodeId;
            const size = data.size ?? GRAPH_CONFIG.DEFAULT_NODE_SIZE;
            const finalSize = isSelected ? size * GRAPH_CONFIG.SELECTED_SCALE : size;

            const newData: NodeAttributes = {
                ...data,
                size: finalSize,
                highlighted: isSelected,
            };

            if (largestNodesIds.has(node)) {
                newData.type = "border";
                newData.borderColor = isDark ? "#ffffff" : "#000000";
                newData.borderSize = 0.15;
                if (data.color) {
                    newData.color = adjustColorBrightness(data.color, isDark ? 25 : -20);
                }
            }

            return newData;
        });

        sigma.setSetting("edgeReducer", (edge: string, data: EdgeAttributes) => {
            const res = { ...data };
            res.color = isDark ? GRAPH_CONFIG.EDGE_OPACITY.DARK : GRAPH_CONFIG.EDGE_OPACITY.LIGHT;
            res.size = data.size || 1;

            if (selectedNodeId && graph.hasEdge(edge)) {
                const source = graph.source(edge);
                const target = graph.target(edge);
                const isConnected = source === selectedNodeId || target === selectedNodeId;

                if (isConnected) {
                    const neighborId = source === selectedNodeId ? target : source;
                    const sAttrs = graph.getNodeAttribute(selectedNodeId, "attributes") as Record<string, unknown>;
                    const nAttrs = graph.getNodeAttribute(neighborId, "attributes") as Record<string, unknown>;

                    if (sAttrs?.louvain !== undefined && sAttrs.louvain === nAttrs?.louvain) {
                        res.color = (graph.getNodeAttribute(selectedNodeId, "color") as string) || (isDark ? "#ffffff" : "#000000");
                        res.size = 2;
                    } else {
                        res.color = isDark ? "#ffffff" : "#fbbf24";
                        res.size = 3;
                    }
                } else if (isolationData) {
                    if (isolationData.communityNodes.has(source) && isolationData.communityNodes.has(target)) {
                        res.color = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
                        res.size = 1;
                    } else {
                        res.hidden = true;
                    }
                } else {
                    res.color = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
                }
            }
            return res;
        });

        return () => {
            sigma.setSetting("nodeReducer", null);
            sigma.setSetting("edgeReducer", null);
        };
    }, [selectedNodeId, largestNodesIds, isolationData, isDark, sigma]);

    // Visibility Filtering
    useEffect(() => {
        const graph = sigma.getGraph();
        const query = deferredSearchQuery.toLowerCase();
        const visibleNodes = new Set<string>();

        graph.forEachNode((id: string, attrs: NodeAttributes) => {
            const matchesSearch = !!selectedNodeId || !query || String(attrs.label ?? "").toLowerCase().includes(query);
            const level = ((attrs.attributes as Record<string, unknown>)?.viewLevel as number) ?? 1;
            let isVisible = matchesSearch && level >= viewLevel;

            // Apply node community Isolation if a node is selected
            if (selectedNodeId && isolationData) {
                const isRelated = id === selectedNodeId ||
                    isolationData.communityNodes.has(id) ||
                    isolationData.neighborNodes.has(id);
                isVisible = isVisible && isRelated;
            }

            graph.setNodeAttribute(id, "hidden", !isVisible);
            if (isVisible) visibleNodes.add(id);
        });

        graph.forEachEdge((edge: string, _a: EdgeAttributes, source: string, target: string) => {
            graph.setEdgeAttribute(edge, "hidden", !visibleNodes.has(source) || !visibleNodes.has(target));
        });
    }, [deferredSearchQuery, viewLevel, selectedNodeId, sigma, isolationData]);

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
            highlight: isDark ? "#ffffff" : "#000000",
            highlightLabel: isDark ? "#000000" : "#ffffff",
        }),
        [isDark],
    );

    /** Draws a highlight ring + label pill for hovered / selected nodes. */
    const drawOverlay = useCallback(
        (ctx: CanvasRenderingContext2D, data: NodeAttributes, settings: SigmaDrawingSettings) => {
            if (!data.label) return;

            const { labelSize, labelFont, labelWeight } = settings;
            const pad = 4;

            ctx.font = `${labelWeight} ${labelSize}px ${labelFont}`;
            const textW = ctx.measureText(data.label).width;

            // Highlight ring
            ctx.beginPath();
            ctx.fillStyle = colours.highlight;
            ctx.arc(data.x, data.y, data.size + pad, 0, Math.PI * 2);
            ctx.fill();

            // Label pill
            const rx = data.x + data.size + pad;
            const ry = data.y - labelSize / 2 - pad;

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
            ctx.fillText(data.label, rx + pad, data.y + labelSize / 3);
        },
        [colours],
    );

    const sigmaSettings = useMemo(
        () => ({
            allowInvalidContainer: true,
            renderLabels: true,
            renderEdgeLabels: false, // Don't render text on edges
            labelDensity: 0.5, // Only show labels for prominent nodes when zoomed out
            labelGridCellSize: 100, // Increase grid size to cull overlapping labels
            zoomToSizeRatioFunction: (ratio: number) => ratio,
            labelFont: "Inter, system-ui, sans-serif",
            labelSize: 11,
            labelWeight: "500",
            labelColor: { color: colours.label },
            defaultNodeColor: colours.label,
            defaultEdgeColor: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
            defaultDrawNodeHover: drawOverlay,
            defaultDrawNodeLabel: (
                ctx: CanvasRenderingContext2D,
                data: NodeAttributes,
                settings: SigmaDrawingSettings,
            ) => {
                if (!data.label) return;
                if (data.highlighted) return drawOverlay(ctx, data, settings);

                ctx.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
                ctx.fillStyle = colours.label;
                ctx.fillText(data.label, data.x + data.size + 4, data.y + settings.labelSize / 3);
            },
            nodeProgramClasses: {
                border: NodeBorderProgram,
            },
            edgeProgramClasses: {
                line: EdgeLineProgram,
            },
            defaultEdgeType: "line",
        }),
        [colours, drawOverlay, isDark],
    );

    return (
        <SigmaContainer
            className="absolute inset-0"
            style={{
                width: "100%",
                height: "100%",
                backgroundColor: isDark ? "#000000" : "#ffffff",
                backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
            }}
            settings={sigmaSettings}
        >
            <GraphManager ref={ref} />
        </SigmaContainer>
    );
});
