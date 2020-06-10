FROM node as builder

WORKDIR /src

COPY . .

RUN npm ci

RUN npm run compile

FROM node:alpine

WORKDIR /src

COPY --from=builder /src/ ./

CMD [ "node", "./build/index.js" ]
