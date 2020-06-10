const Promise = require('bluebird'),
  config = require('config-url'),
  Orchestrator = require('./build/lib/orchestrator'),
  Sandbox = require('./build/lib/sandbox_k8s');
process.on('unhandledRejection', (err, p) => {
  console.error(new Date().toUTCString(), 'unhandledRejection', err.message);
  console.error(err.stack);
});

process.on('uncaughtException', err => {
  console.error(new Date().toUTCString(), 'uncaughtException', err.message);
  console.error(err.stack);
});

function main() {
  const name = config.get('orchestrator.name'),
    token = config.get('orchestrator.token'),
    url = config.getUrl('make');
  new Orchestrator({name}).connect(url, {token});

  setInterval(() => {
    Sandbox.sweep();
  }, ms('5s'));
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
