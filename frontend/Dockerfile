FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_IDENTITY_API_URL
ARG NEXT_PUBLIC_PROVIDER_API_URL
ARG NEXT_PUBLIC_ORDER_API_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_IDENTITY_API_URL=$NEXT_PUBLIC_IDENTITY_API_URL
ENV NEXT_PUBLIC_PROVIDER_API_URL=$NEXT_PUBLIC_PROVIDER_API_URL
ENV NEXT_PUBLIC_ORDER_API_URL=$NEXT_PUBLIC_ORDER_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
