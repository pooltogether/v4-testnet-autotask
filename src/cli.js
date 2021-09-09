const { handler } = require('./handler')

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  const { 
    RINKEBY_RELAYER_API_KEY: rinkebyRelayerAbiKey,
    RINKEBY_RELAYER_SECRET: rinkebyRelayerSecret,
    MUMBAI_RELAYER_API_KEY: mumbaiRelayerApiKey,
    MUMBAI_RELAYER_SECRET: mumbaiRelayerSecret,
    INFURA_API_KEY: infuraApiKey
  } = process.env;
  handler({
    apiKey: rinkebyRelayerAbiKey,
    apiSecret: rinkebyRelayerSecret,
    secrets: {
      mumbaiRelayerApiKey, mumbaiRelayerSecret, infuraApiKey
    }
  })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}