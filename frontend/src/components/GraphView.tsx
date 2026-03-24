import { useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useDeferredValue } from "react";
import { SigmaContainer, useSigma, useRegisterEvents, useCamera } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import { useStore } from "../store/useStore";
import { useTheme } from "./theme-provider";
import { NodeBorderProgram } from "@sigma/node-border";
import { EdgeLineProgram, NodeCircleProgram } from "sigma/rendering";
import { adjustColorBrightness } from "../lib/utils";
import { MultiDirectedGraph } from "graphology";

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
    const { nodes, edges, isMultiSelect, toggleNodeSelection, selectedNodeId, setSelectedNodeId, searchQuery, viewLevel, setIsNodeSelecting, selectedNodeIds } = useStore();
    const lastClickedNodeRef = useRef(false);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    
    // Defer the search query to prevent input lag on heavy graphs
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const nodeStyles = useMemo(() => {
        const styles = new Map<string, { borderColor?: string; borderSize?: number; color?: string; type?: string }>();
        if (!nodes || nodes.length === 0) return styles;

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

        // Pre-calculate style for each node
        nodes.forEach(node => {
            const id = node.id;
            if (prominentIds.has(id)) {
                const attrs = node.attributes as Record<string, unknown>;
                const color = (node.color || attrs.color) as string | undefined;

                styles.set(id, {
                    type: "border",
                    borderColor: color ? adjustColorBrightness(color, -20) : (isDark ? "#ffffff" : "#000000"),
                    borderSize: 0.15,
                    color: color ? adjustColorBrightness(color, isDark ? 25 : -20) : undefined
                });
            } else {
                styles.set(id, {});
            }
        });

        return styles;
    }, [nodes, isDark]);

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
    const fitToView = useCallback(() => {
        if (isolationData && selectedNodeId) {
            const nodesToFit = Array.from(new Set([
                selectedNodeId,
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
    }, [sigma, camera, isolationData, selectedNodeId]);

    useImperativeHandle(ref, () => ({
        zoomIn: camera.zoomIn,
        zoomOut: camera.zoomOut,
        resetCamera: fitToView,
    }), [camera, fitToView]);

    // Automatically fit to view when a node is selected
    useEffect(() => {
        if (selectedNodeId) {
            fitToView();
        }
    }, [selectedNodeId, fitToView]);

    useEffect(() => {
        const graph = sigma.getGraph();

        graph.clear();

        // Add or update nodes - only if data changed
        nodes.forEach((nodeItem) => {
            const id = nodeItem.id;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type, ...node } = nodeItem;
            if (!graph.hasNode(id)) {
                graph.addNode(id, { ...node });
            } else {
                graph.mergeNodeAttributes(id, { ...node });
            }
        });

        // Add or update edges
        edges.forEach((edge) => {
            const edgeId = edge.id;
            if (!graph.hasEdge(edgeId)) {
                graph.addEdgeWithKey(edgeId, edge.source, edge.target, { ...edge });
            } else {
                graph.mergeEdgeAttributes(edgeId, { ...edge });
            }
        });
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
                        const newId = node === selectedNodeId ? null : node;
                        setSelectedNodeId(newId);
                    }
                }, 0);
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
    }, [registerEvents, setSelectedNodeId, selectedNodeId, setIsNodeSelecting, isMultiSelect, toggleNodeSelection]);

    useEffect(() => {
        setIsNodeSelecting(false);
    }, [selectedNodeId, selectedNodeIds, setIsNodeSelecting]);

    // Node & Edge Styling (Reducers)
    useEffect(() => {
        const graph = sigma.getGraph();

        sigma.setSetting("nodeReducer", (node: string, data: NodeAttributes) => {
            const attrs = data as NodeAttributes;
            const isSelected = isMultiSelect 
                ? selectedNodeIds.includes(node) 
                : node === selectedNodeId;
            const size = attrs.size ?? GRAPH_CONFIG.DEFAULT_NODE_SIZE;
            const finalSize = isSelected ? size * GRAPH_CONFIG.SELECTED_SCALE : size;

            const style = nodeStyles.get(node);
            const newData: NodeAttributes = {
                ...attrs,
                ...style,
                size: finalSize,
                highlighted: isSelected,
                zIndex: finalSize,
            };

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
                        res.color = "#fbbf24";
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
    }, [selectedNodeId, isMultiSelect, selectedNodeIds, nodeStyles, isolationData, isDark, sigma]);

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

        graph.forEachEdge((edge: string, _: EdgeAttributes, source: string, target: string) => {
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
            highlight: "#fbbf24",
            highlightLabel: "#000000",
        }),
        [isDark],
    );

    const drawOverlay = useCallback(
        (ctx: CanvasRenderingContext2D, data: NodeAttributes, settings: SigmaDrawingSettings) => {
            const { label, x, y, size } = data;
            if (!label || x === undefined || y === undefined || size === undefined) return;

            const { labelSize, labelFont, labelWeight } = settings;
            const pad = 4;

            ctx.font = `${labelWeight} ${labelSize}px ${labelFont}`;
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

    const sigmaSettings = useMemo(
        () => ({
            allowInvalidContainer: true,
            zIndex: true,
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
                const { label, x, y, size, highlighted } = data;
                if (!label || x === undefined || y === undefined || size === undefined) return;
                if (highlighted) return drawOverlay(ctx, data, settings);

                ctx.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
                ctx.fillStyle = colours.label;
                ctx.fillText(label, x + size + 4, y + settings.labelSize / 3);
            },
            nodeProgramClasses: {
                circle: NodeCircleProgram,
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
            graph={MultiDirectedGraph}
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