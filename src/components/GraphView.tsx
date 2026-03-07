import { useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useDeferredValue } from "react";
import { SigmaContainer, useSigma, useRegisterEvents, useCamera } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import { useStore } from "../store/useStore";
import { useTheme } from "./theme-provider";
import { NodeBorderProgram } from "@sigma/node-border";
import { EdgeLineProgram } from "sigma/rendering";
import { adjustColorBrightness } from "../lib/utils";

/** Scale factor applied to a selected node. */
const SELECTED_SCALE = 1.25;
/** Default node size when none is specified. */
const DEFAULT_NODE_SIZE = 10;

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



    useImperativeHandle(ref, () => ({
        zoomIn: camera.zoomIn,
        zoomOut: camera.zoomOut,
        resetCamera: () => camera.reset({ duration: 500 }),
    }));

    // Sync graph data from store → Sigma
    useEffect(() => {
        const graph = sigma.getGraph();
        const themeEdgeColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";

        if (graph.order === 0 && nodes.length > 0) {
            // Massive initial load – format for Graphology native import
            const importNodes = nodes.map(({ type, ...data }) => ({
                key: data.id,
                attributes: { ...data, nodeType: type }
            }));

            const importEdges = edges.map((e) => ({
                key: e.id,
                source: e.source,
                target: e.target,
                attributes: { ...e, color: themeEdgeColor }
            }));

            graph.import({
                nodes: importNodes,
                edges: importEdges
            });
            return;
        }

        // --- Incremental updates (Graph already has data) ---
        // 1. Determine incoming node/edge IDs
        const incomingNodeIds = new Set(nodes.map(n => n.id));
        const incomingEdgeIds = new Set(edges.map(e => e.id));

        // 2. Remove nodes and edges that no longer exist
        graph.forEachNode((id: string) => {
            if (!incomingNodeIds.has(id)) {
                graph.dropNode(id);
            }
        });

        graph.forEachEdge((id: string) => {
            if (!incomingEdgeIds.has(id)) {
                graph.dropEdge(id);
            }
        });

        // 3. Add or update nodes with static X/Y positions
        for (const { type, ...data } of nodes) {
            if (!graph.hasNode(data.id)) {
                graph.addNode(data.id, { ...data, nodeType: type });
            } else {
                graph.mergeNodeAttributes(data.id, {
                    ...data,
                    nodeType: type,
                    x: data.x,
                    y: data.y
                });
            }
        }

        // 4. Add or update edges with theme-aware color
        for (const edge of edges) {
            const edgeAttrs = { ...edge, color: themeEdgeColor };
            if (!graph.hasEdge(edge.id)) {
                graph.addEdgeWithKey(edge.id, edge.source, edge.target, edgeAttrs);
            } else {
                graph.mergeEdgeAttributes(edge.id, edgeAttrs);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, isDark, sigma]);


    // Click interactions
    useEffect(() => {
        registerEvents({
            clickNode: ({ node }) => {
                lastClickedNodeRef.current = true;
                setSelectedNodeId(node);
            },
            clickStage: () => {
                if (lastClickedNodeRef.current) {
                    lastClickedNodeRef.current = false;
                    return;
                }
                setSelectedNodeId(null);
            },
        });
    }, [registerEvents, setSelectedNodeId, sigma]);

    const largestNodesIds = useMemo(() => {
        const communityMaxNodes = new Map<string | number, { id: string; size: number }>();

        nodes.forEach(node => {
            const attrs = node.attributes as Record<string, unknown>;
            const louvain = attrs?.louvain as string | number | undefined;
            const size = node.size ?? DEFAULT_NODE_SIZE;

            const isHub = attrs?.viewLevel === 5;

            if (louvain !== undefined) {
                const currentMax = communityMaxNodes.get(louvain);
                if (!currentMax || size > currentMax.size) {
                    communityMaxNodes.set(louvain, { id: node.id, size });
                }
            } else if (isHub) {
                communityMaxNodes.set(`hub-${node.id}`, { id: node.id, size });
            }
        });

        return new Set(Array.from(communityMaxNodes.values()).map(n => n.id));
    }, [nodes]);

    useEffect(() => {
        sigma.setSetting("nodeReducer", (node: string, data: NodeAttributes) => {
            const isSelected = node === selectedNodeId;
            const originalSize = data.size ?? DEFAULT_NODE_SIZE;
            const finalSize = isSelected ? originalSize * SELECTED_SCALE : originalSize;

            const newData = {
                ...data,
                size: finalSize,
                highlighted: isSelected,
            };

            if (largestNodesIds.has(node)) {
                newData.type = "border";
                newData.borderColor = isDark ? "#ffffff" : "#000000";
                newData.borderSize = 0.15; // Proportional border size

                if (data.color) {
                    newData.color = adjustColorBrightness(data.color, isDark ? 25 : -20);
                }
            }

            return newData;
        });

        return () => {
            sigma.setSetting("nodeReducer", null);
        };
    }, [selectedNodeId, largestNodesIds, isDark, sigma]);

    useEffect(() => {
        const graph = sigma.getGraph();
        // Calculate lowercase query once per render instead of per node
        const query = deferredSearchQuery.toLowerCase();

        // Track visible nodes so we can efficiently filter edges without querying graph attributes 
        const visibleNodes = new Set<string>();

        // 1. Update node visibility
        graph.forEachNode((id: string, attrs: NodeAttributes) => {
            const matchesSearch = !query || String(attrs.label ?? "").toLowerCase().includes(query);
            const nodeViewLevel = (attrs.attributes as Record<string, unknown>)?.viewLevel;
            const level = typeof nodeViewLevel === 'number' ? nodeViewLevel : 1;
            const matchesLevel = level >= viewLevel;

            const isVisible = matchesSearch && matchesLevel;
            graph.setNodeAttribute(id, "hidden", !isVisible);

            if (isVisible) {
                visibleNodes.add(id);
            }
        });

        // 2. Update edge visibility (edge is hidden if EITHER source or target is hidden)
        graph.forEachEdge(
            (edge: string, _attrs: EdgeAttributes, source: string, target: string) => {
                const hidden = !visibleNodes.has(source) || !visibleNodes.has(target);
                graph.setEdgeAttribute(edge, "hidden", hidden);
            },
        );
    }, [deferredSearchQuery, viewLevel, sigma]);

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
            edge: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
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
            defaultEdgeColor: colours.edge,
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
        [colours, drawOverlay],
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
