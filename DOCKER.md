# Docker Run Guide

## 1) Prepare env
Create `.env.docker` from template and edit secret values.

```powershell
Copy-Item .env.docker.example .env.docker
```

## 2) Start (production mode)
```powershell
docker compose --env-file .env.docker up -d --build
```

## 3) Start (development mode, hot-reload)
```powershell
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## 4) Check status
```powershell
docker compose ps
docker compose logs -f app
```

## 5) Verify API
```powershell
curl http://localhost:3000/api/health
```

## 6) Stop
```powershell
docker compose down
```

## 7) Stop and remove volumes (full reset)
```powershell
docker compose down -v
```

## Notes
- App container name: `scheduler-app`
- Mongo container name: `scheduler-mongo`
- Mongo data is persisted in `mongo_data`
- Upload files are persisted in `uploads_data`
- If you used an old no-auth Mongo volume before this setup, run `docker compose down -v` once, then start again.
