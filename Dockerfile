FROM node as builder

RUN cd /tmp && \
    wget https://github.com/digitalocean/doctl/releases/download/v1.44.0/doctl-1.44.0-linux-amd64.tar.gz && \
    tar xf ./doctl-1.44.0-linux-amd64.tar.gz && \
    mv ./doctl /usr/local/bin && \
    rm -R -f /tmp/*

WORKDIR /src

COPY . .

RUN npm ci

RUN npm run compile

CMD [ "./boot.sh" ]
