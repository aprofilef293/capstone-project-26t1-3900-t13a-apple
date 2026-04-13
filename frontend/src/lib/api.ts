// Functions to connect to backend

export async function fetchGraphData(endpoint = '/api/graph/') {
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`Failed to fetch from ${endpoint}: ${response.statusText}`);
    }
    return response.json();
}

export async function fetchShortestPath(source: string, target: string) {
    const response = await fetch(`/api/graph/path?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`);
    if (response.status === 404) return null; // no path found
    if (!response.ok) {
        throw new Error(`Failed to fetch path: ${response.statusText}`);
    }
    return response.json();
}

export async function fetchMultiShortestPaths(ids: string[]) {
    const params = ids.map(id => `ids=${encodeURIComponent(id)}`).join('&');
    const response = await fetch(`/api/graph/paths?${params}`);
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`Failed to fetch paths: ${response.statusText}`);
    }
    return response.json();
}

export async function exportMultiShortestPathsCsv(
    pathIds: string[],
    selectedIds: string[] = []
): Promise<{ blob: Blob; filename: string }> {
    if (pathIds.length === 0) {
        throw new Error("No path nodes available to export");
    }

    const params = new URLSearchParams();
    pathIds.forEach((id) => params.append("path_ids", id));
    selectedIds.forEach((id) => params.append("selected_ids", id));

    const response = await fetch(`/api/graph/paths/export?${params.toString()}`);

    if (!response.ok) {
        let detail = response.statusText;
        try {
            const body = await response.json();
            if (typeof body?.detail === "string") {
                detail = body.detail;
            }
        } catch {
            // keep status text fallback
        }
        throw new Error(`Failed to export path CSV: ${detail}`);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition");
    const filenameMatch = disposition?.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] ?? "path-export.csv";

    return { blob, filename };
}

// Can use to get upload/processing progress from backend
export function listenToSSE(
    endpoint: string,
    onMessage: (data: unknown) => void,
    onError?: (error: Event) => void
): () => void {
    const eventSource = new EventSource(endpoint);

    eventSource.onmessage = (event) => {
        try {
            const parsedData = JSON.parse(event.data);
            onMessage(parsedData);
        } catch {
            // Fallback to raw string if it's not JSON
            onMessage(event.data);
        }
    };

    eventSource.onerror = (error) => {
        console.error(`SSE Connection Error for ${endpoint}:`, error);
        if (onError) onError(error);
        eventSource.close();
    };

    return () => {
        eventSource.close();
    };
}
