var ms      = require('ms')
  , bytes   = require('bytes')
  , _       = require('lodash')
  , fs      = require('fs')
  ;

module.exports = {
  "codedb" : {
    "url"   : "http://code.breadboard.xyz:8585"
  },
  "make" : {
    "url" : "http://gateway.breadboard.xyz:8070"
  },
  "orchestrator" : {
    "name"      : "default_orchestrator",
    "swarm"     : {
      "hostname"  : _.trim(fs.readFileSync('/run/secrets/swarm/hostname', 'utf-8')),
      "protocol"  : 'https',
      "port"      : _.trim(fs.readFileSync('/run/secrets/swarm/port', 'utf-8')),
      "cert"      : _.trim(fs.readFileSync('/run/secrets/swarm/cert.pem', 'utf-8')),
      "key"       : _.trim(fs.readFileSync('/run/secrets/swarm/key.pem', 'utf-8')),
      "passphrase": _.trim(fs.readFileSync('/run/secrets/swarm/passphrase', 'utf-8')),
      "ca"        : _.trim(fs.readFileSync('/run/secrets/swarm/ca.pem', 'utf-8'))
    },
    "registry" : {
      "username" : _.trim(fs.readFileSync('/run/secrets/registry/username', 'utf-8')),
      "password" : _.trim(fs.readFileSync('/run/secrets/registry/password', 'utf-8')),
      "serveraddress" : _.trim(fs.readFileSync('/run/secrets/registry/serveraddress', 'utf-8'))
    },
    "token" : _.trim(fs.readFileSync('/run/secrets/token/jwt', 'utf-8'))
  },
  "sandbox" : {
    "loadbalancer" : {
      "protocol" : "http:",
      "hostname" : _.trim(fs.readFileSync('/run/secrets/loadbalancer/hostname', 'utf-8'))
    },
    "limits" : {
      "idle"         : ms('10m'),
      "memorybytes"  : bytes('256mb'),
      "nanocpus"     : 1e9/2
    }
  }
};
