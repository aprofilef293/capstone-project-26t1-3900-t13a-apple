#!/bin/bash
set -e

MODEL="${LLM_MODEL:-gemma3}"
PORT="${OLLAMA_PORT:-11434}"

# Singularity runs as the user, so use a writable location for models
# On Katana, OLLAMA_MODELS should be set to a scratch directory
export OLLAMA_HOST="0.0.0.0:${PORT}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-${HOME}/.ollama/models}"

mkdir -p "$OLLAMA_MODELS"

# Start Ollama server in background
ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
echo "Waiting for Ollama server to start on port ${PORT}..."
until curl -sf "http://localhost:${PORT}/api/tags" > /dev/null 2>&1; do
    sleep 1
done
echo "Ollama server is ready."

# Pull the configured model if not already present
echo "Ensuring model '$MODEL' is available..."
ollama pull "$MODEL"
echo "Model '$MODEL' is ready."

echo "LLM server listening on port ${PORT}"

# Keep the server running
wait $OLLAMA_PID
