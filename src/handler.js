const { Relayer } = require('defender-relay-client');
const ethers = require('ethers')

const DrawBeaconRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawBeacon.json')
const DrawHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawHistory.json')
const TsunamiDrawSettingsHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/TsunamiDrawSettingsHistory.json')
const TsunamiDrawSettingsHistoryMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/TsunamiDrawSettingsHistory.json')
const DrawSettingsTimelockTriggerRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawSettingsTimelockTrigger.json')
const FullTimelockTriggerMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/FullTimelockTrigger.json')
const TicketRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/Ticket.json')
const TicketMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/Ticket.json')
const ClaimableDrawRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/ClaimableDraw.json')
const ClaimableDrawMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/ClaimableDraw.json')

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
  const tsunamiDrawSettingsHistoryRinkeby = new ethers.Contract(TsunamiDrawSettingsHistoryRinkeby.address, TsunamiDrawSettingsHistoryRinkeby.abi, ethereumProvider)
  const tsunamiDrawSettingsHistoryMumbai = new ethers.Contract(TsunamiDrawSettingsHistoryMumbai.address, TsunamiDrawSettingsHistoryMumbai.abi, polygonProvider)
  const ticketRinkeby = new ethers.Contract(TicketRinkeby.address, TicketRinkeby.abi, ethereumProvider)
  const ticketMumbai = new ethers.Contract(TicketMumbai.address, TicketMumbai.abi, polygonProvider)
  const claimableDrawRinkeby = new ethers.Contract(ClaimableDrawRinkeby.address, ClaimableDrawRinkeby.abi, ethereumProvider)
  const claimableDrawMumbai = new ethers.Contract(ClaimableDrawMumbai.address, ClaimableDrawMumbai.abi, polygonProvider)
  const drawSettingsTimelockTriggerRinkeby = new ethers.Contract(DrawSettingsTimelockTriggerRinkeby.address, DrawSettingsTimelockTriggerRinkeby.abi, ethereumProvider)
  const fullTimelockTriggerMumbai = new ethers.Contract(FullTimelockTriggerMumbai.address, FullTimelockTriggerMumbai.abi, polygonProvider)

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

  /*

  get total supplies
  calculate fraction of liquidity for each
  calculate # of picks based on fraction and total picks
  setup draw settings

  push new draw + draw settings

  what is the next draw we need for polygon: FullTimelockTrigger, ethereum: DrawSettingsTimelockTrigger

  // need to figure out what the next draw id is for each trigger
  // then pull in the draw from the ethereum draw history

  // then push to the FullTimelockTrigger: draw + drawSettings
  // then push to the DrawSettingsTimelockTrigger: drawSettings

  */

  // propagate draw settings
  const rinkebyPrizeTickets = await ticketRinkeby.balanceOf(claimableDrawRinkeby.address)
  const mumbaiPrizeTickets = await ticketMumbai.balanceOf(claimableDrawMumbai.address)
  const totalEligibleTickets = (await ticketMumbai.totalSupply()).add(await ticketRinkeby.totalSupply()).sub(rinkebyPrizeTickets).sub(mumbaiPrizeTickets)
  
  console.log(`ticketRinkeby: ${ticketRinkeby.address}`)
  console.log(`ticketMumbai: ${ticketMumbai.address}`)
  console.log(`rinkebyPrizeTickets: ${rinkebyPrizeTickets.toString()}`)
  console.log(`mumbaiPrizeTickets: ${mumbaiPrizeTickets.toString()}`)
  console.log(`totalEligibleTickets: ${totalEligibleTickets.toString()}`)

  const bitRange = 3
  const cardinality = 6
  const totalPicks = (2**bitRange)**cardinality
  const drawSettings = {
    bitRangeSize: bitRange,
    matchCardinality: cardinality,
    distributions: [toWei('0.5'), toWei('0.1'), toWei('0.2')],
    prize: ethers.utils.parseEther('10000'),
    maxPicksPerUser: 10,
    drawStartTimestampOffset: 0, 
    drawEndTimestampOffset: 0
  }

  const rinkebyTicketFraction = parseFloat(ethers.utils.formatEther(rinkebyPrizeTickets.mul(ethers.utils.parseEther('1')).div(totalEligibleTickets)))
  const mumbaiTicketFraction = parseFloat(ethers.utils.formatEther(mumbaiPrizeTickets.mul(ethers.utils.parseEther('1')).div(totalEligibleTickets)))

  const rinkebyPicks = Math.floor(rinkebyTicketFraction * totalPicks)
  const mumbaiPicks = Math.floor(mumbaiTicketFraction * totalPicks)

  console.log(`rinkebyPicks: ${rinkebyPicks}`)
  console.log(`mumbaiPicks: ${mumbaiPicks}`)

  const rinkebyDrawSettings = {
    ...drawSettings,
    picks: rinkebyPicks
  }

  const mumbaiDrawSettings = {
    ...drawSettings,
    picks: mumbaiPicks
  }

  let rinkebyNewestDraw = { drawId: 0 }
  let rinkebyOldestDraw = { drawId: 1 }
  try {
    rinkebyNewestDraw = await drawHistoryRinkeby.getNewestDraw()
    rinkebyOldestDraw = await drawHistoryRinkeby.getOldestDraw()
  } catch (e) {
    // console.warn(e)
  }

  console.log(`ATLKING TO: ${drawSettingsTimelockTriggerRinkeby.address}`)
  for (let drawId = rinkebyOldestDraw.drawId; drawId <= rinkebyNewestDraw.drawId; drawId++) {
    console.log(`Checking Rinkeby draw ${drawId}`)
    try {
      await tsunamiDrawSettingsHistoryRinkeby.getDrawSetting(drawId)
      console.log(`Rinkeby Draw Settings exist for ${drawId}`)
    } catch (e) {
      console.log(`ATLKING TO: ${drawSettingsTimelockTriggerRinkeby.address}`)
      const tx = await drawSettingsTimelockTriggerRinkeby.populateTransaction.pushDrawSettings(drawId, rinkebyDrawSettings)  
      const txRes = await rinkebyRelayer.sendTransaction({
        data: tx.data,
        to: tx.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`Propagated draw ${drawId} to Rinkeby: `, txRes)
      break;
    }
  }

  for (let drawId = rinkebyOldestDraw.drawId; drawId <= rinkebyNewestDraw.drawId; drawId++) {
    console.log(`Checking Mumbai draw ${drawId}`)
    const draw = drawHistoryRinkeby.getDraw(drawId)
    try {
      await tsunamiDrawSettingsHistoryMumbai.getDrawSetting(drawId)
      console.log(`Mumbai Draw Settings exist for ${drawId}`)
    } catch (e) {
      const tx = await fullTimelockTriggerMumbai.populateTransaction.pushDrawSettings(draw, mumbaiDrawSettings)
      const txRes = await mumbaiRelayer.sendTransaction({
        data: tx.data,
        to: tx.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`Propagated draw ${drawId} to Mumbai: `, txRes)
      break;
    }
  }

  /*


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

  const lastDrawCalcRinkeby = await claimableDrawRinkeby.drawCalculatorAddresses(lastRinkebyDraw.drawId)
  const lastDrawCalcMumbai = await claimableDrawMumbai.drawCalculatorAddresses(lastRinkebyDraw.drawId)

  if (lastDrawCalcRinkeby == ethers.constants.AddressZero) {
    console.log(`Propagating Draw Settings for ${lastRinkebyDraw.drawId} to Rinkeby: `, drawSettings)

    const rinkebyTx = await drawCalculatorRinkeby.populateTransaction.setDrawSettings(lastRinkebyDraw.drawId, drawSettings)
    const rinkebyTxRes = await rinkebyRelayer.sendTransaction({
      data: rinkebyTx.data,
      to: rinkebyTx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Set Draw Settings on rinkeby for drawId ${lastRinkebyDraw.drawId}: `, rinkebyTxRes)
  }
  
  if (lastDrawCalcMumbai == ethers.constants.AddressZero) {
    console.log(`Propagating Draw Settings for ${lastRinkebyDraw.drawId} to Mumbai: `, drawSettings)

    const mumbaiTx = await drawCalculatorMumbai.populateTransaction.setDrawSettings(lastRinkebyDraw.drawId, drawSettings)
    const mumbaiTxRes = await mumbaiRelayer.sendTransaction({
      data: mumbaiTx.data,
      to: mumbaiTx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Set Draw Settings on mumbai: for drawId ${lastRinkebyDraw.drawId} `, mumbaiTxRes)
  }
  */
  console.log("handler complete!")
}

exports.handler = handler
