FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/public ./public
COPY --from=build /app/resource ./resource
COPY --from=build /app/weight ./weight
COPY --from=build /app/server.mjs ./server.mjs
COPY --from=build /app/readme.md ./readme.md

EXPOSE 5173

CMD ["node", "server.mjs", "--booth"]
