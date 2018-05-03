var Promise       = require('bluebird')
  , config        = require('config-url')
  , Orchestrator  = require('./lib/orchestrator')
  ;

process.on('unhandledRejection', (err, p) => {
  console.error(new Date().toUTCString(), 'unhandledRejection', err.message);
  console.error(err.stack);
});

process.on('uncaughtException', (err) => {
  console.error(new Date().toUTCString(), 'uncaughtException', err.message);
  console.error(err.stack);
});

function main() {
  let name  = config.get('orchestrator.name')
    , token = config.get('orchestrator.token')
    , url   = config.getUrl('make')
    ;

  (new Orchestrator({ name })).connect(url, { token });
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
