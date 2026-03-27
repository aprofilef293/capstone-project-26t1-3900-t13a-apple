# LLM Server

```bash
cd llm-server
docker compose up
```

The server will be available at `http://localhost:11434`. The backend's `LLM_API_URL` defaults to `http://host.docker.internal:11434/v1` when running in Docker.

## Deploying on UNSW Katana

### 1. Submit the job

```bash
cd llm-server
qsub katana.pbs
```

This will:
- Pull the Ollama Singularity image (first run only, cached on scratch)
- Start the server on a GPU node
- Print SSH tunnel instructions in the job log

### 2. Check the job log for connection info

```bash
cat llm-server.log
```

You'll see output like:
```
LLM server starting on: k123:11434

To connect from your machine, run:
  ssh -N -L 11434:k123:11434 z1234567@katana.restech.unsw.edu.au
```

### 3. Set up the SSH tunnel

From your local machine (where the backend runs):

```bash
ssh -N -L 11434:<compute-node>:11434 <zID>@katana.restech.unsw.edu.au
```

### 4. Configure the backend

Set these environment variables for the backend:

```
LLM_API_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=gemma3
```

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `LLM_MODEL` | `gemma3` | Ollama model to pull and serve |
| `OLLAMA_PORT` | `11434` | Port to listen on |

### Customising the PBS job

Edit `katana.pbs` to adjust:
- `ncpus`, `mem`, `ngpus` - resource requests
- `walltime` - max runtime (default 12h)
- `LLM_MODEL` - which model to serve
