FROM python:3.12-slim AS base
WORKDIR /app
ENV HF_HOME=/app/.model_cache

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    pkg-config \
    libfftw3-dev \
    libfftw3-bin \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./

RUN poetry install --no-interaction --no-ansi

COPY . .
EXPOSE 8000

FROM base AS dev
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
