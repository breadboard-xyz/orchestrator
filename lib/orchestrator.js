var Promise           = require('bluebird')
  , winston           = require('winston')
  , _                 = require('lodash')
  , ms                = require('ms')
  , os                = require('os')
  , config            = require('config')
  , randtoken         = require('rand-token')
  , socket_io_client  = require('socket.io-client')
  , codedb_sdk        = require('taskmill-core-codedb-sdk')
  , make_sdk          = require('taskmill-core-make-sdk')
  , Sandbox           = require('./sandbox')
  , core_url          = require('url')
  , wait_on           = require('wait-on')
  ;

function heartbeat(socket, options = {}) {
  let name = options
    , ping = () => {
        let data = {
            name
          , uptime    : process.uptime()
          // todo [akamel] these values should reflect the swarm's capacity
          , totalmem  : os.totalmem()
          , freemem   : os.freemem()
          , loadavg   : os.loadavg()
          , cpus      : os.cpus()
        };

        socket.emit('/ping', data);
      };

  setInterval(ping, ms('10s'));

  ping();
}

class Orchestrator {
  constructor(options = {}) {
    let { name }  = options;

    Object.assign(this, { name });
  }

  connect(url, options = {}) {
    let { token } = options;

    winston.info(`[~] connecting to ${url} ...`);

    let socket = socket_io_client(url)
                  .on('connect', () => {
                    winston.info('[✓] connect');
                    socket.emit('authenticate', { token });
                  })
                  .on('disconnect', () =>{
                    winston.info('[✗] disconnect');
                  })
                  .on('authenticated', () => {
                    winston.log(`[✓] authenticated`);
                  })
                  .on('unauthorized', (msg) => {
                    winston.error(`[✗] unauthorized`, msg);
                  })
                  .on('/create', (msg = {}, cb) => {
                    let { remote
                        , sha
                        , token
                        , bearer
                        , single_use
                        , tailf
                        , blob
                        // , blob_type
                        , filename
                        // , cache
                        }               = msg
                      , { key, hash }   = make_sdk.key(remote, sha, { single_use })
                      ;

                    // make
                    return codedb_sdk
                            .build(remote, { sha, token, bearer })
                            .then((result) => {
                              let { image }     = result
                                , replicas      = 1
                                , secret        = randtoken.generate(16)
                                , name          = randtoken.generate(8)
                                , memorybytes   = config.get('sandbox.limits.memorybytes')
                                , nanocpus      = config.get('sandbox.limits.nanocpus')
                                ;

                              // console.log('[create]', name, image, replicas, secret, memorybytes, nanocpus);
                              return Sandbox
                                      .create(name, image, { replicas, secret, limits : { memorybytes, nanocpus }, make_hash : hash, tailf, blob, filename })
                                      .then((result) => {
                                        let { ID : id } = result;

                                        let transform = ({ body }) => {
                                          let port = _.chain(body).get('Endpoint.Ports').find(['TargetPort', 8080]).get('PublishedPort').value();

                                          if (!port) {
                                            throw new Error('port not assigned');
                                          }

                                          let protocol  = config.get('sandbox.loadbalancer.protocol')
                                            , hostname  = config.get('sandbox.loadbalancer.hostname')
                                            ;

                                          return { id, image, secret, protocol, hostname, port };
                                        };

                                        return Sandbox.inspect(id, { transform, retry : true, retry_timeout : ms('20s'), retry_interval : 200 });
                                      });
                            })
                            .tap(({ id, protocol, hostname, port }) => {
                              // todo [akamel] failing wait_on doesn't terminate _waiting_ on playground
                              return Promise
                                      .fromCallback((cb) => wait_on({
                                          resources : [`tcp:${hostname}:${port}`]
                                        , interval  : 100
                                        , window    : 0
                                        , timeout   : ms('30s')
                                      }, cb));
                            })
                            .then(({ id, image, secret, protocol, hostname, port }) => {
                              return {
                                  key
                                , hash
                                , id
                                , single_use
                                , remote
                                , sha
                                , protocol
                                , hostname
                                , port
                                , secret
                                // , tailf
                                , run_url   : core_url.format({ protocol, hostname, port })
                                // , stats     : {
                                //       boottime  : new Date().getTime()
                                //     , time      : diff
                                //   }
                                };
                            })
                            .tap((data) => {
                              Sandbox.set(data);
                            })
                            .catch((err) => {
                              winston.error(err);
                              throw err;
                            })
                            .asCallback(cb);
                  });

    let { name } = this;

    heartbeat(socket, { name });
  }
}

module.exports = Orchestrator;
