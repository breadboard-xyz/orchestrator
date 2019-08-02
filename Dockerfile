from node as builder

WORKDIR /src

COPY package*.json ./

RUN npm install

from node:alpine

WORKDIR /src

COPY . .

RUN rm -rf ./node_modules

COPY --from=builder /src/node_modules ./node_modules

CMD [ "node", "index.js" ]
