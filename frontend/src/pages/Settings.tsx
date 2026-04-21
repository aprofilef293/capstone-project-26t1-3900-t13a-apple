import { useState, useEffect, useCallback } from "react";
import { Activity, Database, Server, Key, Save, RefreshCw, X } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import {
    fetchHealthStatus,
    fetchApiKeyStatus,
    updateApiKeys,
    validateApiKeys,
    type HealthStatus,
    type ApiKeyStatus,
    type ApiKeyValidation,
} from "../lib/api";

type SaveState = "idle" | "saving" | "error";

const persistedValid = { hf: false, gemini: false };

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ ok }: { ok: boolean }) {
    return (
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ok
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
            {ok ? "Online" : "Offline"}
        </span>
    );
}

function KeyStatusBadge({ valid, hasInput }: { valid: boolean | null; hasInput: boolean }) {
    if (hasInput) return (
        <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-sidebar-foreground/5 text-sidebar-foreground/40 border-sidebar-border">
            Unsaved
        </span>
    );
    if (valid === true) return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Valid
        </span>
    );
    if (valid === false) return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-500 border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Invalid
        </span>
    );
    return (
        <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-sidebar-foreground/5 text-sidebar-foreground/40 border-sidebar-border">
            Not set
        </span>
    );
}

interface ApiKeyRowProps {
    label: string;
    description: string;
    placeholder: string;
    configured: boolean;
    valid: boolean | null;
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
}

function ApiKeyRow({ label, description, placeholder, configured, valid, value, onChange, onClear }: ApiKeyRowProps) {
    return (
        <div className="flex flex-col gap-3 py-5 border-b border-sidebar-border last:border-0">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-sidebar-foreground">{label}</span>
                    <span className="text-xs text-sidebar-foreground/50">{description}</span>
                </div>
                <KeyStatusBadge valid={valid} hasInput={value.length > 0} />
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function Settings() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [keyStatus, setKeyStatus] = useState<ApiKeyStatus | null>(null);
    const [healthLoading, setHealthLoading] = useState(true);

    const [hfInput, setHfInput] = useState("");
    const [geminiInput, setGeminiInput] = useState("");
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveError, setSaveError] = useState("");

    // Only valid=true persists navigation
    const [validation, setValidation] = useState<ApiKeyValidation>(() => ({
        huggingface_valid: persistedValid.hf ? true : null,
        gemini_valid: persistedValid.gemini ? true : null,
    }));

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

    // On every load check configured keys and update badges
    useEffect(() => {
        refreshStatus();
        validateApiKeys().then(result => {
            if (result.huggingface_valid === false) persistedValid.hf = false;
            if (result.gemini_valid === false) persistedValid.gemini = false;
            setValidation(prev => ({
                huggingface_valid: result.huggingface_valid !== null ? result.huggingface_valid : prev.huggingface_valid,
                gemini_valid: result.gemini_valid !== null ? result.gemini_valid : prev.gemini_valid,
            }));
        }).catch(() => { });
    }, [refreshStatus]);

    async function handleSave() {
        if (!hfInput && !geminiInput) return;
        setSaveState("saving");
        setSaveError("");
        try {
            const payload: { huggingface_token?: string; gemini_api_key?: string } = {};
            if (hfInput) payload.huggingface_token = hfInput;
            if (geminiInput) payload.gemini_api_key = geminiInput;

            const result = await updateApiKeys(payload);

            if (result.huggingface_valid !== null) persistedValid.hf = result.huggingface_valid === true;
            if (result.gemini_valid !== null) persistedValid.gemini = result.gemini_valid === true;

            setValidation(prev => ({
                huggingface_valid: result.huggingface_valid !== null ? result.huggingface_valid : prev.huggingface_valid,
                gemini_valid: result.gemini_valid !== null ? result.gemini_valid : prev.gemini_valid,
            }));
            setHfInput("");
            setGeminiInput("");
            await refreshStatus();
            setSaveState("idle");
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Save failed");
            setSaveState("error");
        }
    }

    async function handleClear(key: "hf" | "gemini") {
        try {
            await updateApiKeys(key === "hf" ? { huggingface_token: "" } : { gemini_api_key: "" });
            if (key === "hf") {
                persistedValid.hf = false;
                setValidation(prev => ({ ...prev, huggingface_valid: null }));
            } else {
                persistedValid.gemini = false;
                setValidation(prev => ({ ...prev, gemini_valid: null }));
            }
            await refreshStatus();
        } catch { }
    }

    const canSave = (hfInput.trim().length > 0 || geminiInput.trim().length > 0) && saveState !== "saving";

    const systemItems = [
        { id: 1, name: "Graph Database", ok: health?.database ?? false, icon: Database },
        { id: 2, name: "LLM Query Service", ok: health?.query_engine ?? false, icon: Server },
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
                                className={`flex items-center justify-between px-5 py-4 ${i < systemItems.length - 1 ? "border-b border-sidebar-border" : ""
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
                        Keys are stored on the server and persist across restarts. They are never returned or saved to the browser — enter a new value to overwrite.
                    </p>

                    <div className="rounded-xl border border-sidebar-border px-5">
                        <ApiKeyRow
                            label="HuggingFace Token"
                            description="Required for remote HuggingFace inference embeddings."
                            placeholder="hf_…"
                            configured={keyStatus?.huggingface_configured ?? false}
                            valid={validation.huggingface_valid}
                            value={hfInput}
                            onChange={setHfInput}
                            onClear={() => handleClear("hf")}
                        />
                        <ApiKeyRow
                            label="Gemini API Key"
                            description="Enables Gemini-powered query expansion for richer search results."
                            placeholder="AIza…"
                            configured={keyStatus?.gemini_configured ?? false}
                            valid={validation.gemini_valid}
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
                            {saveState === "saving" ? "Saving & validating…" : "Save"}
                        </button>
                        {saveState === "error" && (
                            <span className="text-xs text-red-500">{saveError}</span>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
}
