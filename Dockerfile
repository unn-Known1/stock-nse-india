FROM node:20-bookworm-slim
WORKDIR /app
COPY src/ src/
COPY examples/ examples/
COPY package.json package-lock.json ./
COPY tsconfig.json ./
ENV TZ="Asia/Kolkata"
ENV HUSKY=0
ENV NODE_ENV=production
RUN npm ci --omit=dev && npx rimraf ./build && npx tsc && npx copyfiles -f "./src/**/*.graphql" build/graphql-schema
ENV PORT=3001
EXPOSE 3001
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://localhost:3001/api/marketStatus',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "build/server.js"]
