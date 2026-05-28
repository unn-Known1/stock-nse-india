FROM node:20
WORKDIR /app
COPY src/ src/
COPY examples/ examples/
COPY package.json ./
COPY yarn.lock ./
COPY tsconfig.json ./
ENV TZ="Asia/Kolkata"
ENV HUSKY=0
ENV NODE_ENV=production
RUN yarn install --frozen-lockfile
RUN yarn build
ENV PORT=3001
EXPOSE 3001
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://localhost:3001/api/marketStatus',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "build/server.js"]
