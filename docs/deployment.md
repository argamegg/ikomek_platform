# iKOMEK 109 Deployment Plan

## Evaluation

Your order is correct: database first, backend second, then web and mobile clients with the final backend URL. The only adjustment is Docker usage:

- Backend: Docker image is useful for Render.
- Web: Vercel should normally build the Vite app directly, not from Docker. A web Dockerfile is included for Render/Railway/Fly/VM-style deployment.
- Mobile: Docker is not the deployment unit. Use EAS Build and pass the backend URL as an EAS environment variable.

## 1. MongoDB Atlas

Create an Atlas cluster and database user, then copy the connection string.

Required value:

```env
MONGO_URL=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
```

Recommended DB name:

```env
DB_NAME=ikomek_db
```

## 2. Backend On Render

Use either Render Blueprint from the repository root or create a Web Service manually.

Blueprint file:

```text
render.yaml
```

Manual Render settings:

```text
Service type: Web Service
Runtime: Docker
Dockerfile path: ./apps/backend/Dockerfile
Docker context: ./apps/backend
Health check path: /api/
```

Required Render env vars:

```env
PORT=10000
MONGO_URL=<MongoDB Atlas connection string>
DB_NAME=ikomek_db
JWT_SECRET=<long random secret>
CORS_ORIGINS=<Vercel URL>,<mobile dev URL if needed>
```

Optional env vars:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SENDER_EMAIL=
SMTP_SENDER_NAME=iKOMEK 109
SMTP_USE_TLS=true
SMTP_USE_SSL=false
GEMINI_API_KEY=
```

Backend Docker build:

```bash
docker build -t ikomek-backend:latest -f apps/backend/Dockerfile apps/backend
docker run --rm -p 8001:8001 --env-file apps/backend/.env ikomek-backend:latest
```

The backend image uses `apps/backend/requirements.prod.txt` to avoid shipping local lint/test-only dependencies.

Backend smoke check:

```bash
curl http://localhost:8001/api/
```

If you deploy Render from a prebuilt registry image instead of Git, tag and push it:

```bash
docker tag ikomek-backend:latest <registry>/<owner>/ikomek-backend:latest
docker push <registry>/<owner>/ikomek-backend:latest
```

After Render deploy, save:

```text
BACKEND_URL=https://<your-render-service>.onrender.com
```

## 3. cron-job.org

Create a GET job every 5 minutes:

```text
https://<your-render-service>.onrender.com/api/
```

This keeps the free Render instance warm and also acts as a simple uptime check.

## 4. Web On Vercel

Recommended Vercel settings:

```text
Root Directory: apps/web-app
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Required Vercel env vars:

```env
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
VITE_WS_BASE_URL=wss://<your-render-service>.onrender.com
```

The app includes `apps/web-app/vercel.json` so React Router deep links return `index.html`.

Web Docker build for non-Vercel hosts:

```bash
docker build \
  -t ikomek-web:latest \
  -f apps/web-app/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://<your-render-service>.onrender.com \
  --build-arg VITE_WS_BASE_URL=wss://<your-render-service>.onrender.com \
  apps/web-app

docker run --rm -p 8080:80 ikomek-web:latest
```

If you deploy this web image to a Docker-based host:

```bash
docker tag ikomek-web:latest <registry>/<owner>/ikomek-web:latest
docker push <registry>/<owner>/ikomek-web:latest
```

## 5. Mobile With EAS Build

Create the EAS environment variable:

```bash
cd apps/mobile-app
eas env:create --name EXPO_PUBLIC_BACKEND_URL --value https://<your-render-service>.onrender.com --environment production --visibility plaintext
```

Preview APK:

```bash
eas build --platform android --profile preview
```

Production Android App Bundle:

```bash
eas build --platform android --profile production
```

Production iOS build:

```bash
eas build --platform ios --profile production
```

## 6. Seed Demo Data

After backend deploy and Mongo connection are ready:

```bash
curl -X POST https://<your-render-service>.onrender.com/api/seed-demo
```

Then verify:

```bash
curl https://<your-render-service>.onrender.com/api/
```

## Final Order

1. Create MongoDB Atlas cluster and `MONGO_URL`.
2. Deploy backend to Render.
3. Verify `/api/`.
4. Configure cron-job.org ping.
5. Deploy web to Vercel with backend URL.
6. Update backend `CORS_ORIGINS` with final Vercel URL.
7. Create EAS env var with backend URL.
8. Build mobile with EAS.
9. Run `POST /api/seed-demo`.
10. Do final smoke test from web and mobile.
