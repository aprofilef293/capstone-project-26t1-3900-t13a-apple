import { useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { SigmaContainer, useSigma, useRegisterEvents, useCamera } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import { useStore } from "../store/useStore";
import { useTheme } from "./theme-provider";

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
}

// ---------------------------------------------------------------------------
// GraphManager – syncs store data into Sigma and handles interactions
// ---------------------------------------------------------------------------

const GraphManager = forwardRef<GraphViewRef, unknown>((_, ref) => {
    const sigma = useSigma();
    const camera = useCamera({ duration: 250 });
    const registerEvents = useRegisterEvents();
    const { nodes, edges, selectedNodeId, setSelectedNodeId, searchQuery } = useStore();
    const lastClickedNodeRef = useRef(false);

    useImperativeHandle(ref, () => ({
        zoomIn: camera.zoomIn,
        zoomOut: camera.zoomOut,
    }));

    // Sync graph data from store → Sigma
    useEffect(() => {
        const graph = sigma.getGraph();
        graph.clear();

        for (const { type, ...data } of nodes) {
            graph.addNode(data.id, { ...data, nodeType: type });
        }
        for (const edge of edges) {
            graph.addEdge(edge.source, edge.target, { ...edge });
        }

        requestAnimationFrame(() => camera.reset({ duration: 500 }));
    }, [nodes, edges, sigma, camera]);

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

    // Highlight & enlarge the selected node via nodeReducer
    useEffect(() => {
        sigma.setSetting("nodeReducer", (node: string, data: NodeAttributes) => {
            if (node !== selectedNodeId) return data;

            return {
                ...data,
                size: (nodes.find((n) => n.id === node)?.size ?? DEFAULT_NODE_SIZE) * SELECTED_SCALE,
                highlighted: true,
            };
        });

        return () => {
            sigma.setSetting("nodeReducer", null);
        };
    }, [selectedNodeId, nodes, sigma]);

    // Highlight connected edges in red when node is selected
    useEffect(() => {        
        const graph = sigma.getGraph();
        
        sigma.setSetting("edgeReducer", (edge: string, data: EdgeAttributes) => {
            // Get source and target from the graph using the edge key
            const source = graph.source(edge);
            const target = graph.target(edge);
            
            const isConnected = selectedNodeId && (source === selectedNodeId || target === selectedNodeId);
            
            if (isConnected) {
                return {
                    ...data,
                    color: "#ef4444", // Red highlighted edges 
                };
            }
            
            return data;
        });

        return () => {
            sigma.setSetting("edgeReducer", null);
        };
    }, [selectedNodeId, sigma]);

    // Search filtering – hide non-matching nodes and their edges
    useEffect(() => {
        const graph = sigma.getGraph();
        const query = searchQuery.toLowerCase();

        graph.forEachNode((id: string, attrs: NodeAttributes) => {
            const matches = !searchQuery || String(attrs.label ?? "").toLowerCase().includes(query);
            graph.setNodeAttribute(id, "hidden", !matches);
        });

        graph.forEachEdge(
            (edge: string, _attrs: EdgeAttributes, source: string, target: string) => {
                const hidden =
                    (graph.getNodeAttribute(source, "hidden") as boolean | undefined) ||
                    (graph.getNodeAttribute(target, "hidden") as boolean | undefined);
                graph.setEdgeAttribute(edge, "hidden", !!hidden);
            },
        );
    }, [searchQuery, sigma]);

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
