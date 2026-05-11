# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the React/Vite app
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (better caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy rest of the source
COPY . .

# Set the API URL to point to backend container (via nginx proxy later)
# In Docker, the frontend talks to backend via the internal network
ENV VITE_API_BASE_URL=/api
ENV VITE_API_PROXY_TARGET=http://backend:8080

# Build the production bundle
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Serve the built app with Nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy built files from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config that proxies /api to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
