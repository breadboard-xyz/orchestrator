import {expect} from 'chai';
import 'mocha';

import {Orchestrator} from '../../lib/orchestrator';

// const should = chai.should();

describe('Blobs', () => {
  it('should deploy service', async () => {
    return Orchestrator
    .deploy({
      remote: 'https://github.com/a7medkamel/taskmill-help.git',
      sha: 'master',
      filename: 'helloworld.js',
    })
    .then(result => {
      console.log(result);
    })
    .catch(err => {
      if (err.response) {
        console.error(err.message, err.response.body, err.body);
      }

      console.error(err.toString());
    });
  }).timeout(60 * 1000);
});
