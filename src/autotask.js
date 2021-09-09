const { Relayer } = require('defender-relay-client');
const ethers = require('ethers')

const DrawBeaconRinkeby = require('@pooltogether/v4-rinkeby/deployments/rinkeby/DrawBeacon.json')
const DrawHistoryRinkeby = require('@pooltogether/v4-rinkeby/deployments/rinkeby/DrawHistory.json')
const DrawHistoryMumbai = require('@pooltogether/v4-rinkeby/deployments/mumbai/DrawHistory.json')
const TicketRinkeby = require('@pooltogether/v4-rinkeby/deployments/rinkeby/Ticket.json')
const TicketMumbai = require('@pooltogether/v4-rinkeby/deployments/mumbai/Ticket.json')
const TsunamiDrawCalculatorRinkeby = require('@pooltogether/v4-rinkeby/deployments/rinkeby/TsunamiDrawCalculator.json')
const TsunamiDrawCalculatorMumbai = require('@pooltogether/v4-rinkeby/deployments/mumbai/TsunamiDrawCalculator.json')
const ClaimableDrawRinkeby = require('@pooltogether/v4-rinkeby/deployments/rinkeby/ClaimableDraw.json')
const ClaimableDrawMumbai = require('@pooltogether/v4-rinkeby/deployments/mumbai/ClaimableDraw.json')

const toWei = ethers.utils.parseEther

exports.handler = async function(event) {
  const rinkebyRelayer = new Relayer(event);
  const {
    mumbaiRelayerApiKey,
    mumbaiRelayerSecret,
    infuraApiKey
  } = event.secrets;
  const mumbaiRelayer = new Relayer({apiKey: mumbaiRelayerApiKey, apiSecret: mumbaiRelayerSecret})

  // first let's check the beacon
  const ethereumProvider = new ethers.providers.InfuraProvider('rinkeby', infuraApiKey)
  const polygonProvider = new ethers.providers.JsonRpcProvider(`https://polygon-mumbai.infura.io/v3/${infuraApiKey}`)

  const drawBeacon = new ethers.Contract(DrawBeaconRinkeby.address, DrawBeaconRinkeby.abi, ethereumProvider)
  const drawHistoryRinkeby = new ethers.Contract(DrawHistoryRinkeby.address, DrawHistoryRinkeby.abi, ethereumProvider)
  const drawHistoryMumbai = new ethers.Contract(DrawHistoryMumbai.address, DrawHistoryMumbai.abi, polygonProvider)
  const ticketRinkeby = new ethers.Contract(TicketRinkeby.address, TicketRinkeby.abi, ethereumProvider)
  const ticketMumbai = new ethers.Contract(TicketMumbai.address, TicketMumbai.abi, polygonProvider)
  const drawCalculatorRinkeby = new ethers.Contract(TsunamiDrawCalculatorRinkeby.address, TsunamiDrawCalculatorRinkeby.abi, ethereumProvider)
  const drawCalculatorMumbai = new ethers.Contract(TsunamiDrawCalculatorMumbai.address, TsunamiDrawCalculatorMumbai.abi, polygonProvider)
  const claimableDrawRinkeby = new ethers.Contract(ClaimableDrawRinkeby.address, ClaimableDrawRinkeby.abi, ethereumProvider)
  const claimableDrawMumbai = new ethers.Contract(ClaimableDrawMumbai.address, ClaimableDrawMumbai.abi, polygonProvider)

  if (await drawBeacon.canStartRNGRequest()) {
    console.log("Starting draw...")
    const tx = await drawBeacon.populateTransaction.startDraw()
    const txRes = await rinkebyRelayer.sendTransaction({
      data: tx.data,
      to: tx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Started Draw: `, txRes)
  }

  let completedDraw = false
  if (await drawBeacon.canCompleteRNGRequest()) {
    console.log("Completing draw...")
    const tx = await drawBeacon.populateTransaction.completeDraw()
    const txRes = await rinkebyRelayer.sendTransaction({
      data: tx.data,
      to: tx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Completed Draw: `, txRes)
    completedDraw = true
  }

  const nextDrawId = await drawBeacon.nextDrawId()
  let lastDrawId = null
  if (nextDrawId > 0) {
    lastDrawId = nextDrawId - 1
  }

  let mumbaiDraws = (await drawHistoryMumbai.draws()).slice()
  let lastMumbaiDrawId
  if (mumbaiDraws[0].timestamp != 0) { // if it was initialized
    mumbaiDraws.sort((drawA, drawB) => drawB.drawId - drawA.drawId)

    lastMumbaiDrawId = mumbaiDraws[0].drawId
  } else { // back it up 1
    lastMumbaiDrawId = -1
  }
  
  console.log(`Last mumbai draw id: ${lastMumbaiDrawId}`)

  for (let drawId = lastMumbaiDrawId + 1; drawId <= lastDrawId; drawId++) {
    const rinkebyDraw = await drawHistoryRinkeby.getDraw(drawId)
    console.log(`Propagating Draw ${drawId} to Mumbai...`)
    const tx = await drawHistoryMumbai.populateTransaction.pushDraw(rinkebyDraw)
    console.log(`tx: `, JSON.stringify(tx, null, 2))
    const txRes = await mumbaiRelayer.sendTransaction({
      data: tx.data,
      to: tx.to,
      speed: 'fast',
      gasLimit: 1000000
    })
    console.log("Propagated Draw to Mumbai: ", txRes)
  }

  const rinkebyPrizeTickets = await ticketRinkeby.balanceOf(claimableDrawRinkeby.address)
  const mumbaiPrizeTickets = await ticketMumbai.balanceOf(claimableDrawMumbai.address)
  const totalEligibleTickets = (await ticketMumbai.totalSupply()).add(await ticketRinkeby.totalSupply()).sub(rinkebyPrizeTickets).sub(mumbaiPrizeTickets)
  
  // catch up the claimable draws.  This isn't really accurate but who cares.
  for (let drawId = 0; drawId <= lastDrawId; drawId++) {
    const oddSpaces = []
    for (let bitRange = 1; bitRange < 4; bitRange++) {
      for (let cardinality = 4; cardinality < 8; cardinality++) {
        let numberOfPicks = (2**bitRange)**cardinality;
        // console.log(`Draw ${drawId} number of picks: ${numberOfPicks}`)
        const pickCost = totalEligibleTickets.div(numberOfPicks)
        // console.log(`Draw ${drawId}, bitRange: ${bitRange}, cardinality: ${cardinality} pickCost: ${pickCost}`)
        if (pickCost.gt(ethers.constants.WeiPerEther)) { // ignore absurd values
          oddSpaces.push({
            pickCost, bitRange, cardinality
          })
        }
      }
    }
  
    oddSpaces.sort((a, b) => a.pickCost - b.pickCost)
  
    const prize = ethers.utils.parseEther('10000')

    const best = oddSpaces[0]

    if (best) {
      console.log("Best fit: ", best)
  
      const drawSettings = {
        bitRangeSize: best.bitRange,
        matchCardinality: best.cardinality,
        pickCost: best.pickCost,
        distributions: [toWei('0.5'), toWei('0.1'), toWei('0.2'), toWei('0.2')],
        prize
      }
  
      console.log('Propagating Draw Settings: ', drawSettings)
    
      const rinkebyTx = await drawCalculatorRinkeby.populateTransaction.setDrawSettings(drawId, drawSettings)
      const rinkebyTxRes = await rinkebyRelayer.sendTransaction({
        data: rinkebyTx.data,
        to: rinkebyTx.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`Set Draw Settings on rinkeby: `, rinkebyTxRes)
  
      const mumbaiTx = await drawCalculatorMumbai.populateTransaction.setDrawSettings(drawId, drawSettings)
      const mumbaiTxRes = await mumbaiRelayer.sendTransaction({
        data: mumbaiTx.data,
        to: mumbaiTx.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`Set Draw Settings on mumbai: `, mumbaiTxRes)
    }
  }

}

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  const { 
    RINKEBY_RELAYER_API_KEY: rinkebyRelayerAbiKey,
    RINKEBY_RELAYER_SECRET: rinkebyRelayerSecret,
    MUMBAI_RELAYER_API_KEY: mumbaiRelayerApiKey,
    MUMBAI_RELAYER_SECRET: mumbaiRelayerSecret,
    INFURA_API_KEY: infuraApiKey
  } = process.env;
  exports.handler({
    apiKey: rinkebyRelayerAbiKey,
    apiSecret: rinkebyRelayerSecret,
    secrets: {
      mumbaiRelayerApiKey, mumbaiRelayerSecret, infuraApiKey
    }
  })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}