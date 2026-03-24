FROM python:3.12-slim

WORKDIR /app

# Install system compilers 
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    pkg-config \
    libfftw3-dev \
    libfftw3-bin \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

ENV PIP_DEFAULT_TIMEOUT=300
ENV POETRY_HTTP_TIMEOUT=300

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry config installer.max-workers 1

COPY pyproject.toml poetry.lock* ./

RUN poetry install --no-interaction --no-ansi --only main

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]