var _       = require('lodash')
  , fs      = require('fs')
  ;

module.exports = {
  "orchestrator" : {
    "token" : _.trim(fs.readFileSync('./key/.jwt', 'utf-8'))
  }
};
