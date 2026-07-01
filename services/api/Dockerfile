FROM node:24-alpine AS build
WORKDIR /app
COPY services/api/package.json services/api/tsconfig.json ./
COPY services/api/src ./src
COPY packages/shared-types ./packages/shared-types
RUN sed -i 's|"workspace:\*"|"file:./packages/shared-types"|' package.json && \
    node -e "const fs=require('fs');const ts=JSON.parse(fs.readFileSync('tsconfig.json'));ts.compilerOptions.paths['@fleetvolt/shared-types']=['./packages/shared-types/src/schema.d.ts'];fs.writeFileSync('tsconfig.json',JSON.stringify(ts,null,2));" && \
    npm install && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY services/api/package.json ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
