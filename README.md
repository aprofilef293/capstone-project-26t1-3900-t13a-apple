# README

## Setup

```bash
# in root folder for production
docker compose up --build

# for dev with hot reload, any changes will be updated
docker compose -f docker-compose.dev.yml up --build

# you can run services separately in different terminals
cd backend && docker compose up --build
cd frontend && docker compose up --build

# make sure to remove the containers once done from the same place you ran compose up
docker compose down
```