#!/usr/bin/env node

const { program } = require('commander');
program.option('-n, --network <string>', 'select network (mainnet, rinkeby, polygon or binance)')
program.parse(process.argv)

const options = program.opts()

const { AutotaskClient } = require('defender-autotask-client');
const fs = require('fs')

async function updateAutotask(autotaskId, file) {
  const client = new AutotaskClient({apiKey: process.env.DEFENDER_TEAM_API_KEY, apiSecret: process.env.DEFENDER_TEAM_SECRET_KEY});
  const source = fs.readFileSync(file);
  console.log(`Updating autotask ${autotaskId} with sourcefile ${file}`)
  await client.updateCodeFromSources(autotaskId, {
    'index.js': source
  });
}

async function run() {
  await updateAutotask(process.env.RINKEBY_AUTOTASK_ID, './dist/handler-bundle.js')
}

run()
