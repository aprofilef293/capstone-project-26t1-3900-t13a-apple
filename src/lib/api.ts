// Functions to connect to backend

async function fetchGraphData(endpoint = '/graph') {
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`Failed to fetch from ${endpoint}: ${response.statusText}`);
    }
    return response.json();
}

// Can use to get upload/processing progress from backend
export function listenToSSE(
    endpoint: string,
    onMessage: (data: any) => void,
    onError?: (error: Event) => void
): () => void {
    const eventSource = new EventSource(endpoint);

    eventSource.onmessage = (event) => {
        try {
            const parsedData = JSON.parse(event.data);
            onMessage(parsedData);
        } catch (err) {
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
