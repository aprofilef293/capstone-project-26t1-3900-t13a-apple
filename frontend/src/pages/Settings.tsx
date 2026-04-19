import { useState, useEffect, useCallback } from "react";
import { Activity, Database, Server, Key, Save, RefreshCw, X } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import {
    fetchHealthStatus,
    fetchApiKeyStatus,
    updateApiKeys,
    type HealthStatus,
    type ApiKeyStatus,
} from "../lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

function StatusBadge({ ok }: { ok: boolean }) {
    return (
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            ok
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-red-500/10 text-red-500 border-red-500/20"
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
            {ok ? "Online" : "Offline"}
        </span>
    );
}

function KeyBadge({ configured }: { configured: boolean }) {
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            configured
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-sidebar-foreground/5 text-sidebar-foreground/40 border-sidebar-border"
        }`}>
            {configured ? "Configured" : "Not set"}
        </span>
    );
}

interface ApiKeyRowProps {
    label: string;
    description: string;
    placeholder: string;
    configured: boolean;
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
}

function ApiKeyRow({ label, description, placeholder, configured, value, onChange, onClear }: ApiKeyRowProps) {
    return (
        <div className="flex flex-col gap-3 py-5 border-b border-sidebar-border last:border-0">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-sidebar-foreground">{label}</span>
                    <span className="text-xs text-sidebar-foreground/50">{description}</span>
                </div>
                <KeyBadge configured={configured} />
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="password"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={configured ? "Enter new value to overwrite" : placeholder}
                    autoComplete="new-password"
                    className="flex-1 bg-sidebar border border-sidebar-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sidebar-ring placeholder:text-sidebar-foreground/30"
                />
                {configured && (
                    <button
                        type="button"
                        onClick={onClear}
                        title="Remove key"
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-sidebar-border text-sidebar-foreground/40 hover:text-red-500 hover:border-red-500/40 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

export function Settings() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [keyStatus, setKeyStatus] = useState<ApiKeyStatus | null>(null);
    const [healthLoading, setHealthLoading] = useState(true);

    const [hfInput, setHfInput] = useState("");
    const [geminiInput, setGeminiInput] = useState("");
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveError, setSaveError] = useState("");

    const refreshStatus = useCallback(async () => {
        setHealthLoading(true);
        try {
            const [h, k] = await Promise.all([fetchHealthStatus(), fetchApiKeyStatus()]);
            setHealth(h);
            setKeyStatus(k);
        } catch {
            setHealth({ database: false, query_engine: false });
        } finally {
            setHealthLoading(false);
        }
    }, []);

    useEffect(() => { refreshStatus(); }, [refreshStatus]);

    async function handleSave() {
        if (!hfInput && !geminiInput) return;
        setSaveState("saving");
        setSaveError("");
        try {
            const payload: { huggingface_token?: string; gemini_api_key?: string } = {};
            if (hfInput)     payload.huggingface_token = hfInput;
            if (geminiInput) payload.gemini_api_key    = geminiInput;

            await updateApiKeys(payload);

            setHfInput("");
            setGeminiInput("");
            const k = await fetchApiKeyStatus();
            setKeyStatus(k);

            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2500);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Save failed");
            setSaveState("error");
        }
    }

    async function handleClear(key: "hf" | "gemini") {
        try {
            await updateApiKeys(key === "hf"
                ? { huggingface_token: "" }
                : { gemini_api_key: "" }
            );
            const k = await fetchApiKeyStatus();
            setKeyStatus(k);
        } catch { /* leave badge as-is on failure */ }
    }

    const canSave = (hfInput.trim().length > 0 || geminiInput.trim().length > 0) && saveState !== "saving";

    const systemItems = [
        { id: 1, name: "Graph Database", ok: health?.database      ?? false, icon: Database },
        { id: 2, name: "Query Engine",   ok: health?.query_engine  ?? false, icon: Server   },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-y-auto">
            <PageHeader
                title="Settings"
                description="Manage application preferences and monitor system health."
            />

            <div className="px-10 py-8 max-w-3xl mx-auto w-full flex flex-col gap-10">

                {/* System Status */}
                <section>
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-sidebar-foreground/60" />
                            <h2 className="text-base font-semibold tracking-tight">System Status</h2>
                        </div>
                        <button
                            onClick={refreshStatus}
                            disabled={healthLoading}
                            className="flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors disabled:opacity-40"
                        >
                            <RefreshCw className={`w-3 h-3 ${healthLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                    </div>

                    <div className="rounded-xl border border-sidebar-border overflow-hidden">
                        {systemItems.map((item, i) => (
                            <div
                                key={item.id}
                                className={`flex items-center justify-between px-5 py-4 ${
                                    i < systemItems.length - 1 ? "border-b border-sidebar-border" : ""
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0">
                                        <item.icon className="w-3.5 h-3.5 text-sidebar-foreground/60" />
                                    </div>
                                    <span className="text-sm font-medium">{item.name}</span>
                                </div>
                                {healthLoading
                                    ? <span className="text-xs text-sidebar-foreground/30">Checking…</span>
                                    : <StatusBadge ok={item.ok} />
                                }
                            </div>
                        ))}
                    </div>
                </section>

                {/* API Keys */}
                <section>
                    <div className="flex items-center gap-2 mb-5">
                        <Key className="w-4 h-4 text-sidebar-foreground/60" />
                        <h2 className="text-base font-semibold tracking-tight">API Keys</h2>
                    </div>
                    <p className="text-xs text-sidebar-foreground/50 mb-5">
                        Keys are stored securely on the server and persist across restarts. They are never returned to the browser — enter a new value to overwrite.
                    </p>

                    <div className="rounded-xl border border-sidebar-border px-5">
                        <ApiKeyRow
                            label="HuggingFace Token"
                            description="Required for remote HuggingFace inference embeddings."
                            placeholder="hf_…"
                            configured={keyStatus?.huggingface_configured ?? false}
                            value={hfInput}
                            onChange={setHfInput}
                            onClear={() => handleClear("hf")}
                        />
                        <ApiKeyRow
                            label="Gemini API Key"
                            description="Enables Gemini-powered query expansion for richer search results."
                            placeholder="AIza…"
                            configured={keyStatus?.gemini_configured ?? false}
                            value={geminiInput}
                            onChange={setGeminiInput}
                            onClear={() => handleClear("gemini")}
                        />
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saveState === "saving"
                                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                : <Save className="w-3.5 h-3.5" />
                            }
                            {saveState === "saving" ? "Saving…" : "Save"}
                        </button>
                        {saveState === "saved" && (
                            <span className="text-xs text-emerald-500">Saved successfully.</span>
                        )}
                        {saveState === "error" && (
                            <span className="text-xs text-red-500">{saveError}</span>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
}
