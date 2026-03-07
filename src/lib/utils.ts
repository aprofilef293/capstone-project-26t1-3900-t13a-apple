import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Use it to adjust the colour of major nodes to denote they are diff
export function adjustColorBrightness(hex: string, percent: number): string {
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

    return `#${rr}${gg}${bb}`;
}
