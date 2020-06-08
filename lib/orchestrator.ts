import {Sandbox} from './sandbox_k8s';

import socket_io_client from 'socket.io-client';

const Bluebird = require('bluebird'),
  winston = require('winston'),
  _ = require('lodash'),
  bluebird_retry = require('bluebird-retry'),
  ms = require('ms'),
  os = require('os'),
  config = require('config'),
  randtoken = require('rand-token'),
  codedb_sdk = require('taskmill-core-codedb-sdk'),
  core_url = require('url'),
  wait_on = require('wait-on');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({format: winston.format.simple()}),
  ],
});

function heartbeat(socket: SocketIOClient.Emitter, options = {}) {
  const name = options,
    ping = () => {
      const data = {
        name,
        uptime: process.uptime(),
        // todo [akamel] these values should reflect the swarm's capacity
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
        cpus: os.cpus(),
      };

      socket.emit('/ping', data);
    };

  setInterval(ping, ms('10s'));

  ping();
}

export interface CreateOptions {
  remote?: string;
  sha?: string;
  token?: string;
  bearer?: string;
  single_use?: boolean;
  tailf?: string;
  blob?: string;
  // blob_type
  filename?: string;
  // cache
}

export class Orchestrator {
  readonly name: string | undefined;

  constructor(options: {name?: string} = {}) {
    const {name} = options;

    this.name = name;
  }

  connect(url: string, options: {token?: string} = {}) {
    const {token} = options;

    logger.info(`[~] connecting to ${url} ...`);

    const socket = socket_io_client(url)
      .on('connect', () => {
        logger.info('[✓] connect');
        socket.emit('authenticate', {token});
      })
      .on('disconnect', () => {
        logger.info('[✗] disconnect');
      })
      .on('authenticated', () => {
        logger.info('[✓] authenticated');
      })
      .on('unauthorized', (msg: string) => {
        logger.error('[✗] unauthorized', msg);
      })
      .on(
        '/create',
        async (
          msg: CreateOptions = {},
          cb: (err: unknown, result?: unknown) => void
        ) => {
          Bluebird.resolve(Orchestrator.deploy(msg)).asCallback(cb);
        }
      );

    const {name} = this;

    heartbeat(socket, {name});
  }

  static async deploy(msg: CreateOptions) {
    // , blob_type
    // , cache
    const {remote, sha, token, bearer, single_use, tailf, blob, filename} = msg;

    if (!remote) {
      throw new Error(`remote not defined in msg '${JSON.stringify(msg)}'`);
    }

    if (!sha) {
      throw new Error(`sha not defined in msg '${JSON.stringify(msg)}'`);
    }

    const {key, hash} = Sandbox.key(remote, sha, {single_use});

    const built = await codedb_sdk.build(remote, {sha, token, bearer});

    const {image} = built,
      replicas = 1,
      secret = randtoken.generate(32),
      name = randtoken.generate(16, 'abcdefghijklnmopqrstuvwxyz-'),
      memorybytes = config.get('sandbox.limits.memorybytes'),
      nanocpus = config.get('sandbox.limits.nanocpus');
    console.log('[built]', name, image, built);

    const service = await Sandbox.create(name, image, {
      replicas,
      secret,
      limits: {memorybytes, nanocpus},
      make_hash: hash,
      tailf,
      blob,
      filename,
    });

    const {metadata} = service;

    if (!metadata) {
      throw new Error(
        `metadata not defined in service '${JSON.stringify(service)}'`
      );
    }

    const {uid: id} = metadata;

    if (!id) {
      throw new Error(
        `id not defined in service metadata'${JSON.stringify(metadata)}'`
      );
    }

    const protocol = config.get('sandbox.loadbalancer.protocol');
    const hostname = config.get('sandbox.loadbalancer.hostname');

    // todo [ahmed.kamel] looks like port is already assigned
    const endpoint = await bluebird_retry(
      async () => {
        // const body = await Sandbox.inspect(id);

        // const port = _.chain(body)
        console.log(service?.spec?.ports);
        const port = _.chain(service)
          .get('spec.ports')
          .find({targetPort: 8080})
          .get('nodePort')
          .value();

        if (!port) {
          throw new Error('port not assigned');
        }

        return {id, image, secret, protocol, hostname, port};
      },
      {timeout: ms('10s'), interval: 200}
    );

    console.log(endpoint);
    const {port} = endpoint;
    // todo [akamel] failing wait_on doesn't terminate _waiting_ on playground
    // todo [ahmed.kamel] we are not catching any exception thrown from awaits
    const healthy = await wait_on({
      resources: [`tcp:${hostname}:${port}`],
      interval: 100,
      window: 0,
      timeout: ms('75s'),
    });

    const data = {
      key,
      hash,
      id,
      single_use,
      remote,
      sha,
      protocol,
      hostname,
      port,
      secret,
      run_url: core_url.format({protocol, hostname, port}),
    };

    Sandbox.set(data);

    return data;
  }
}
