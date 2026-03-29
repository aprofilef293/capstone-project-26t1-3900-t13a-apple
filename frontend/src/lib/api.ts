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
