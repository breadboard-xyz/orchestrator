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

class Sandbox {
  static sweep() {
    return Sandbox
            .list()
            .then((result) => {
              return _.chain(result)
                      .map((item) => {
                        let { ID, CreatedAt } = item;

                        let now     = (new Date).getTime()
                          , age     = now - (new Date(CreatedAt)).getTime()
                          , expired = age > ms('10m')
                          ;

                        return { id : ID, created_at : CreatedAt, age, expired };
                      })
                      .value();
            })
            // .tap((list) => {
            //   _.each(list, (i) => {
            //     if (i.expired) {
            //       let obj = Sandbox.cache[i.id];
            //       if (obj) {
            //         console.log('item expired', i.id)
            //         obj.expired = true;
            //       }
            //     }
            //   });
            // })
            // .tap((list) => {
            //   let lookup = _.keyBy(list, (i) => i.id);
            //
            //   _.each(Sandbox.cache, (i, key, obj) => {
            //     console.log('item lost', i.id)
            //     if (!lookup[key]) {
            //       obj.expired = true;
            //     }
            //   });
            // })
            // .then((list) => {
            //   _.each(list, ({ id, expired }) => {
            //     if (expired) {
            //       return Sandbox.delete(id);
            //     }
            //   })
            //
            //   _.each(Sandbox.cache, ({ hash, expired }) => {
            //     if (expired) {
            //       return make_sdk.del(hash);
            //     }
            //   })
            //   // todo [akamel] deprecate Sandbox.cache
            //   // Sandbox.cache = _.pick(Sandbox.cache, keep_ids);
            // });
  }

  static list(options = {}) {
    return api({ hostname, port, pathname : `/services`, ...options });
  }

  static inspect(id, options = {}) {
    return api({ hostname, port, pathname : `/services/${id}`, ...options });
  }

  static delete(id, options = {}) {
    return api({ method : 'DELETE', hostname, port, pathname : `/services/${id}`, json : false, ...options })
            .tap(() => {
              let data = Sandbox.cache[id];
              if (data) {
                let { lock } = data;

                delete Sandbox.cache[id];
                // return make_sdk.unlock(lock);
              }
            });
  }

  static create(name, image, options = {}) {
    let { limits : { idle, memorybytes, nanocpus }, replicas, secret } = options;

    let body = {
      "Name": name,
      "TaskTemplate": {
        "ContainerSpec": {
          "Image": image,
          // todo [akamel] send secret
          "Env" : [
            "secret="
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
        "breadboard_id": "bar"
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
