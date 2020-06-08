import {expect} from 'chai';
import 'mocha';

import {Orchestrator} from '../../lib/orchestrator';
import { Sandbox } from '../../lib/sandbox_k8s';

// const should = chai.should();

describe('Blobs', () => {
  // it('should deploy service', async () => {
  //   const result = await Orchestrator.deploy({
  //     remote: 'https://github.com/a7medkamel/taskmill-help.git',
  //     sha: 'master',
  //     filename: 'helloworld.js',
  //   });
    
  //   console.log(result);
  // }).timeout(60 * 1000);

  // it('should list deployments', async () => {
  //   const result = await Sandbox.list();
  // });

  it('should sweep all old services and pods', async () => {
    const result = await Sandbox.sweep();
  });
});
