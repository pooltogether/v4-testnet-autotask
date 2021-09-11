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

async function handler(event) {
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

  const nextDrawId = await drawBeacon.nextDrawId()

  if (await drawBeacon.canStartDraw()) {
    console.log(`Starting draw ${nextDrawId}...`)
    const tx = await drawBeacon.populateTransaction.startDraw()
    const txRes = await rinkebyRelayer.sendTransaction({
      data: tx.data,
      to: tx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Started Draw ${nextDrawId}: `, txRes)
  }

  let completedDraw = false
  if (await drawBeacon.canCompleteDraw()) {
    console.log(`Completing draw ${nextDrawId}...`)
    const tx = await drawBeacon.populateTransaction.completeDraw()
    const txRes = await rinkebyRelayer.sendTransaction({
      data: tx.data,
      to: tx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Completed Draw ${nextDrawId}: `, txRes)
    completedDraw = true
  }

  // propagate draws
  const lastMumbaiDraw = await drawHistoryMumbai.getLastDraw()
  const lastRinkebyDraw = await drawHistoryRinkeby.getLastDraw()

  for (let drawId = lastMumbaiDraw.drawId + 1; drawId <= lastRinkebyDraw.drawId; drawId++) {
    console.log("getting drawId ", drawId)
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

  // propagate draw settings
  const rinkebyPrizeTickets = await ticketRinkeby.balanceOf(claimableDrawRinkeby.address)
  const mumbaiPrizeTickets = await ticketMumbai.balanceOf(claimableDrawMumbai.address)
  const totalEligibleTickets = (await ticketMumbai.totalSupply()).add(await ticketRinkeby.totalSupply()).sub(rinkebyPrizeTickets).sub(mumbaiPrizeTickets)
  
  const bitRange = 3
  const cardinality = 6
  const totalPicks = (2**bitRange)**cardinality
  
  const ticketsPerPick = totalEligibleTickets.div(totalPicks)
  
  const drawSettings = {
    bitRangeSize: bitRange,
    matchCardinality: cardinality,
    pickCost : ticketsPerPick,
    distributions: [toWei('0.5'), toWei('0.1'), toWei('0.2')],
    prize: ethers.utils.parseEther('10000')
  }

  // just do last four.  kinda hacky
  for (let drawId = lastRinkebyDraw.drawId > 4 ? lastRinkebyDraw.drawId - 4 : lastRinkebyDraw.drawId; drawId < lastRinkebyDraw.drawId; drawId++) {
    console.log('Propagating Draw Settings: ', drawSettings)

    const rinkebyTx = await drawCalculatorRinkeby.populateTransaction.setDrawSettings(drawId, drawSettings)
    const rinkebyTxRes = await rinkebyRelayer.sendTransaction({
      data: rinkebyTx.data,
      to: rinkebyTx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Set Draw Settings on rinkeby for drawId ${drawId}: `, rinkebyTxRes)
  
    const mumbaiTx = await drawCalculatorMumbai.populateTransaction.setDrawSettings(drawId, drawSettings)
    const mumbaiTxRes = await mumbaiRelayer.sendTransaction({
      data: mumbaiTx.data,
      to: mumbaiTx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Set Draw Settings on mumbai: for drawId ${drawId} `, mumbaiTxRes)
  }
  
  console.log("handler complete!")
}

exports.handler = handler
