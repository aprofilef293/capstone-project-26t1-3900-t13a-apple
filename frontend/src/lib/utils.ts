import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Cache for adjusted colors to avoid redundant parsing and calculations
const colorCache: Record<string, string> = {};

// Use it to adjust the colour of major nodes to denote they are diff
export function adjustColorBrightness(hex: string, percent: number): string {
    const cacheKey = `${hex}-${percent}`;
    if (colorCache[cacheKey]) return colorCache[cacheKey];

    const cleanHex = hex.replace(/^#/, "");

    // Parse RGB
    let r = parseInt(cleanHex.substring(0, 2), 16);
    let g = parseInt(cleanHex.substring(2, 4), 16);
    let b = parseInt(cleanHex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
    r = Math.round(Math.min(255, Math.max(0, r + (r * (percent / 100)))));
    g = Math.round(Math.min(255, Math.max(0, g + (g * (percent / 100)))));
    b = Math.round(Math.min(255, Math.max(0, b + (b * (percent / 100)))));

    // Convert back to hex
    const rr = r.toString(16).padStart(2, "0");
    const gg = g.toString(16).padStart(2, "0");
    const bb = b.toString(16).padStart(2, "0");

    const result = `#${rr}${gg}${bb}`;
    colorCache[cacheKey] = result;
    return result;
}

export function formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return `${dd}/${mm}/${yyyy} ${hours}:${minutes}${ampm}`;
}
