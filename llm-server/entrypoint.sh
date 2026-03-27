#!/bin/bash
set -e

MODEL="${LLM_MODEL:-gemma3}"

# Start Ollama server in background
ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
echo "Waiting for Ollama server to start..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
done
echo "Ollama server is ready."

# Pull the configured model if not already present
echo "Ensuring model '$MODEL' is available..."
ollama pull "$MODEL"
echo "Model '$MODEL' is ready."

# Keep the server running
wait $OLLAMA_PID
