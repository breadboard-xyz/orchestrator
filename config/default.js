var ms      = require('ms')
  , bytes   = require('bytes')
  , _       = require('lodash')
  , fs      = require('fs')
  ;

module.exports = {
  "orchestrator" : {
    "token" : _.trim(fs.readFileSync('./key/.jwt', 'utf-8'))
  },
  "sandbox" : {
    "limits" : {
      "idle"         : ms('10m'),
      "memorybytes"  : bytes('256mb'),
      "nanocpus"     : 1e9/2
    },
    "loadbalancer" : {
      "protocol" : 'http:',
      "hostname" : '[SWARM_MANAGER_IP]'
    }
  }
};
