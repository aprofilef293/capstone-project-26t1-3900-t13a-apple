.PHONY: install dev format lint fix check test all docker-up docker-down llm clean loc

install:
	poetry install

dev:
	poetry run uvicorn app.main:app --reload

format:
	poetry run ruff format .

lint:
	poetry run ruff check .

fix:
	poetry run ruff check --fix .

check:
	poetry run ruff format --check .
	poetry run ruff check .

test:
	poetry run pytest

all: format fix lint test

docker-up:
	docker compose up --build

docker-down:
	docker compose down

llm:
	docker compose exec ollama ollama pull gemma3

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +

loc:
	@find . -name '*.py' -not -path './.venv/*' | xargs wc -l | tail -1
