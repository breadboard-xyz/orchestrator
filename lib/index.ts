import config from 'config-url';
import ms from 'ms';
import { Orchestrator } from './orchestrator';
import { Sandbox } from './sandbox_k8s';

process.on('unhandledRejection', (err: Error, p) => {
  console.error(new Date().toUTCString(), 'unhandledRejection', err.message);
  console.error(err.stack);
});

process.on('uncaughtException', (err: Error) => {
  console.error(new Date().toUTCString(), 'uncaughtException', err.message);
  console.error(err.stack);
});

const name = config.get('orchestrator.name');
const token = config.get('orchestrator.token');
const url = config.getUrl('make');

new Orchestrator({name}).connect(url, {token});

setInterval(() => {
  Sandbox.sweep();
}, ms('5s'));
