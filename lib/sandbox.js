"use strict";

var Promise         = require('bluebird')
  , _               = require('lodash')
  , winston         = require('winston')
  , config          = require('config')
  , ms              = require('ms')
  , make_sdk        = require('taskmill-core-make-sdk')
  , { api }         = require('./api')
  ;

// '/var/run/docker.sock'
// /* Pattern */ 'http://unix:SOCKET:PATH'
// /* Example */ request.get('http://unix:/absolute/path/to/unix.socket:/request/path')

const hostname  = config.get('orchestrator.swarm.hostname')
    , port      = config.get('orchestrator.swarm.port')
    ;

// todo [akamel] if service fails to boot, detect wait-on timeout and del redis entry (let it get deleted)
class Sandbox {
  static sweep() {
    return Sandbox
            .list()
            .then((result) => {
              return _.chain(result)
                      .map((item) => {
                        let { ID, CreatedAt } = item
                          , { make_hash }     = item.Spec.Labels
                          ;

                        let now     = (new Date).getTime()
                          , age     = now - (new Date(CreatedAt)).getTime()
                          , expired = age > ms('10m')
                          ;

                        return { id : ID, created_at : CreatedAt, age, expired, make_hash };
                      })
                      .value();
            })
            .then((list) => {
              _.each(list, (item) => {
                let { id, expired, make_hash } = item;

                if (expired) {
                  Sandbox.delete(id);
                  return;
                }

                // todo [akamel] don't just extend. make sure it's the same port otherwise we can have multiple service with same hash that will never delete (timing issue)
                if (make_hash) {
                  make_sdk.extend(make_hash, { ttl : ms('10s') / 1000 });
                }
              });
            });
  }

  static list(options = {}) {
    return api({ hostname, port, pathname : `/services`, ...options });
  }

  static inspect(id, options = {}) {
    return api({ hostname, port, pathname : `/services/${id}`, ...options });
  }

  static delete(id, options = {}) {
    // todo [akamel] delete from redis right away
    // return make_sdk.del(lock);

    return api({ method : 'DELETE', hostname, port, pathname : `/services/${id}`, json : false, ...options });
  }

  static create(name, image, options = {}) {
    let { limits : { idle, memorybytes, nanocpus }, replicas, secret, tailf, blob, filename, make_hash } = options;

    let container_config = {
        sandbox : {
            secret
          , tailf
          , blob
          // , blob_type
          , filename
        }
    };

    let body = {
      "Name": name,
      "TaskTemplate": {
        "ContainerSpec": {
          "Image": image,
          "Env" : [
            `NODE_CONFIG=${JSON.stringify(container_config)}`
          ]

          // "Secrets": [
          //   {
          //     "File": {
          //       "Name": "www.example.org.key",
          //       "UID": "33",
          //       "GID": "33",
          //       "Mode": 384
          //     },
          //     "SecretID": "fpjqlhnwb19zds35k8wn80lq9",
          //     "SecretName": "example_org_domain_key"
          //   }
          // ]
        },
        "Placement": {
          "Constraints" : [
            "node.role != manager"
          ]
        },
        "Resources": {
          "Limits": {
            "MemoryBytes": memorybytes,
            "NanoCPUs" : nanocpus
          }
        },
        "RestartPolicy": {
          "Condition": "any",
          "Delay": ms('1s') * 1000000, // in ns
          "MaxAttempts": 10
        }
      },
      "Mode": {
        "Replicated": {
          "Replicas": replicas
        }
      },
      "EndpointSpec": {
        "Ports": [
          {
            "Protocol": "tcp",
            // "PublishedPort": 8080,
            "TargetPort": 8080
          }
        ]
      },
      "Labels": {
        make_hash
      }
    }

    let payload     = _.pick(config.get('orchestrator.registry'), ['username', 'password', 'serveraddress'])
      , base64_auth = new Buffer(JSON.stringify(payload)).toString('base64')
      , headers     = { 'X-Registry-Auth' : base64_auth }
      ;

    return api({ method : 'POST', hostname, port, pathname : `/services/create`, headers, body });
  }

  static set(data) {
    let { id } = data;

    return make_sdk.set(data, { ttl : ms('5s') / 1000 });
  }
}

Sandbox.sweep();

setInterval(() => {
  Sandbox.sweep();
}, ms('5s'));

module.exports = Sandbox;
