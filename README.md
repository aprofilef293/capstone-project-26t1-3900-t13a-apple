# README

## Setup

1. create an huggingface account. https://huggingface.co/
2. go to https://huggingface.co/settings/tokens/
3. create new token, name it whatever
4. make sure to tick `make calls to inference providers` under inference section.
5. copy `.env.example` into `.env`
6. paste the token into `EMBEDDING_HF_TOKEN`
7. run the following commands

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

## Costs
Huggingface has a free tier, 0.10 monthly limit credit. It does have an API rate limit of 1000 calls. File uploads with 1000 nodes or larger won't work. Be conservative with it.