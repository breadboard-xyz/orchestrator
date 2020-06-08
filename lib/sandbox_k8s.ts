import _ from 'lodash';
import config from 'config';
import ms from 'ms';
import winston from 'winston';
import crypto from 'crypto';
import uuid from 'uuid';
import cache_man from 'cache-manager';

import {KubeConfig, V1Service, V1Pod, CoreV1Api, V1Binding} from '@kubernetes/client-node';

const k8sconfig = config.get('orchestrator.k8s.config');

const kc = new KubeConfig();
kc.loadFromString(k8sconfig as string);

const k8sApi = kc.makeApiClient(CoreV1Api);

const mem = cache_man.caching({store: 'memory', ttl: 5 /*seconds*/}),
  cache = cache_man.multiCaching([mem]);
export interface SandboxCreateOptions {
  secret: string;
  tailf?: string;
  blob?: string;
  filename?: string;
  make_hash: string;

  replicas: number;
  limits: {
    idle?: number;
    memorybytes: number;
    nanocpus: number;
  };
}

// todo [akamel] if service fails to boot, detect wait-on timeout and del redis entry (let it get deleted)
export class Sandbox {
  static async sweep() {
    const list = await Sandbox.list();
    const {items} = list;

    const now = new Date().getTime();

    const mapped = _.chain(items)
      .map(item => {
        const {spec, metadata} = item;

        if (!metadata) {
          return;
        }

        const {uid, creationTimestamp, labels} = metadata;

        if (!uid || !creationTimestamp || !labels) {
          // todo: [ahmed.kamel] handle this case better
          return;
        }

        const {make_hash} = labels || {};

        const age = now - new Date(creationTimestamp).getTime(),
          expired = age > ms('10m');
        return {
          id: uid,
          created_at: creationTimestamp,
          age,
          expired,
          make_hash,
        };
      })
      .value();

    _.each(mapped, item => {
      // if item is undefined, cont...
      if (!item) {
        return;
      }

      const {id, expired, make_hash} = item;

      if (expired) {
        Sandbox.delete(id, {hash: make_hash});
        return;
      }

      // todo [akamel] don't just extend. make sure it's the same port otherwise we can have multiple service with same hash that will never delete (timing issue)
      if (make_hash) {
        Sandbox.extend(make_hash).catch(err => {
          winston.error(
            `sandbox ${make_hash} not found, item:\n${JSON.stringify(
              item,
              null,
              2
            )}`
          );
          winston.error(err);
          Sandbox.delete(id, {hash: make_hash});
        });
      }
    });
  }

  static async list() {
    const ret = await k8sApi.listNamespacedService('default');

    return ret.body;
  }

  static async inspect(id: string) {
    const ret = await k8sApi.readNamespacedServiceStatus(id, 'default');

    return ret.body;
  }

  static async delete(id: string, options: {hash: string}) {
    const ret = await k8sApi.deleteNamespacedService(id, 'default');

    const {hash} = options;
    cache.del(hash);

    return ret;
  }

  static async create(
    name: string,
    image: string,
    options: SandboxCreateOptions
  ) {
    const {
      limits: {idle, memorybytes, nanocpus},
      replicas,
      secret,
      tailf,
      blob,
      filename,
      make_hash,
    } = options;

    const container_config = {
      sandbox: {
        secret,
        tailf,
        blob,
        // , blob_type
        filename,
      },
    };

    const v1service: V1Service = {
      metadata: {
        name,
        labels: {
          make_hash,
        },
      },
      spec: {
        type: 'NodePort',
        ports: [{
          port: 8080,
          targetPort: 8080 as unknown as object
        }],
        selector: {
          run: `${name}-pod`
        }
      },
    };

    const service = await k8sApi.createNamespacedService('default', v1service);

    const v1pod: V1Pod = {
      metadata: {
        // todo [ahmed.kamel] consider using generatename
        name: `${name}-pod`,
        labels: {
          run: `${name}-pod`
        }
      },
      spec: {
        containers: [{
          name: `${name}-container`,
          image,
          env: [{
            name: 'NODE_CONFIG',
            value: JSON.stringify(container_config)
          }],
          ports: [{
            containerPort: 8080
          }],
          // resources: {
          //   limits: {
          //     cpu: `${nanocpus / 1000000}m`,
          //     memory: `${memorybytes}B`,
          //   }
          // }
        }],
        // todo [ahmed.kamel] hardcoded to 10minutes
        // activeDeadlineSeconds: 10 * 60,
        imagePullSecrets: [{
          // todo [ahmed.kamel] key is pre-configured on k8s
          name: 'gcr-json-key'
        }]
      }
    };

    const pod = await k8sApi.createNamespacedPod('default', v1pod);

    return service.body;
  }

  static async get(hash: string): Promise<{hash: string}> {
    return cache.get(hash);
  }

  static async set(data: {hash: string}, ttl?: number) {
    const {hash} = data;

    if (_.isUndefined(ttl)) {
      ttl = ms('1m') / 1000;
    }

    return cache.set(hash, data, {ttl});
  }

  static async extend(hash: string) {
    const data = await Sandbox.get(hash);

    if (!data) {
      throw new Error('not found');
    }

    return Sandbox.set(data, ms('10s') / 1000);
  }

  static key(
    remote: string,
    sha: string,
    options: {single_use?: boolean} = {}
  ) {
    const {single_use} = options;

    let key = `${remote}#${sha}`;

    if (single_use) {
      const uid = uuid.v4();

      key += `+${uid}`;
    }

    // todo [ahmed.kamel] add a secret / salt to the sha
    const hash = crypto.createHmac('sha1', '').update(key).digest('hex');

    return {key, hash};
  }
}
