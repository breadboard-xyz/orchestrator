var chai      = require('chai')
  , Client    = require('kubernetes-client').Client
  , config    = require('kubernetes-client').config
  ;

var should = chai.should();

describe('Blobs', async () => {
  const kubeconfig = config.loadKubeconfig('./secret/kube/config.yml');
  // const kubeconfig = config.fromKubeconfig();
  // const spec = require('../../secret/kube/swagger.json');
  const client = new Client({ config : kubeconfig });
// console.log(kubeconfig)
  await client.loadSpec();
  //
  let namespaces = await client.api.v1.namespaces.get();
  //
  console.log(namespaces);
  // const namespaces = await client.api.v1.namespaces.get();
  // for (let i = 0, len = namespaces.body.items.length; i < len; i++) {
  //     this.namespaces.push(namespaces.body.items[i].metadata.name);
  // }
  // this.logger.info(`Namespaces that are available: ${this.namespaces}`);
  //
  // this.currentNamespace = this.namespaces[0];
  // this.logger.info(`New current namespace is: ${this.currentNamespace}`);
});