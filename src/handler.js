const ethers = require('ethers')
const { Relayer } = require('defender-relay-client');
const { getContracts } = require('./contracts')
async function handler(event) {
  const rinkebyRelayer = new Relayer(event);
  const {
    mumbaiRelayerApiKey,
    mumbaiRelayerSecret,
    infuraApiKey
  } = event.secrets;
  const mumbaiRelayer = new Relayer({apiKey: mumbaiRelayerApiKey, apiSecret: mumbaiRelayerSecret})

const {
  drawBeacon,
  drawHistoryRinkeby,
  prizeDistributionHistoryRinkeby,
  prizeDistributionHistoryMumbai,
  ticketRinkeby,
  ticketMumbai,
  drawPrizesRinkeby,
  drawPrizesMumbai,
  l1TimelockTriggerRinkeby,
  l2TimelockTriggerMumbai
} = getContracts(infuraApiKey)

  const nextDrawId = await drawBeacon.nextDrawId()
  const getLastRngRequestId = await drawBeacon.getLastRngRequestId()
  const isRngRequested = await drawBeacon.isBeaconPeriodOver()
  const beaconPeriodStartedAt = await drawBeacon.beaconPeriodStartedAt()
  const isBeaconPeriodOver = await drawBeacon.isRngRequested()
  const beaconPeriodSeconds = await drawBeacon.beaconPeriodSeconds()

  console.log('DrawBeacon Beacon PeriodStartedAt:', beaconPeriodStartedAt.toString())
  console.log('DrawBeacon Beacon PeriodSeconds:', beaconPeriodSeconds.toString())
  console.log('DrawBeacon Beacon PeriodOver:', isBeaconPeriodOver)
  
  console.log('Draw Settings')
  console.log('DrawBeacon next Draw.drawId:', nextDrawId)
  console.log('DrawBeacon RNG ID:', getLastRngRequestId)

  console.log('Is RNG Requested:', await drawBeacon.isRngRequested())
  console.log('Can Start Draw:', await drawBeacon.canStartDraw())
  console.log('Can Complete Draw:', await drawBeacon.canCompleteDraw())

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

  // propagate draw settings
  const rinkebyPrizeTickets = await ticketRinkeby.balanceOf(drawPrizesRinkeby.address)
  const mumbaiPrizeTickets = await ticketMumbai.balanceOf(drawPrizesMumbai.address)
  const totalEligibleTickets = (await ticketMumbai.totalSupply()).add(await ticketRinkeby.totalSupply()).sub(rinkebyPrizeTickets).sub(mumbaiPrizeTickets)
  
  console.log(`ticketRinkeby: ${ticketRinkeby.address}`)
  console.log(`ticketMumbai: ${ticketMumbai.address}`)
  console.log(`rinkebyPrizeTickets: ${rinkebyPrizeTickets.toString()}`)
  console.log(`mumbaiPrizeTickets: ${mumbaiPrizeTickets.toString()}`)
  console.log(`totalEligibleTickets: ${totalEligibleTickets.toString()}`)

  const bitRange = 2
  const cardinality = 3
  const totalPicks = (2**bitRange)**cardinality
  const drawSettings = {
    bitRangeSize: bitRange,
    matchCardinality: cardinality,
    distributions: [ethers.utils.parseUnits("0.5", 9),ethers.utils.parseUnits("0.3", 9), ethers.utils.parseUnits("0.2", 9)],
    prize: ethers.utils.parseEther('100'),
    maxPicksPerUser: 10,
    startOffsetTimestamp: 0, 
    endOffsetTimestamp: 0
  }

  const rinkebyTicketFraction = parseFloat(ethers.utils.formatEther(rinkebyPrizeTickets.mul(ethers.utils.parseEther('1')).div(totalEligibleTickets)))
  const mumbaiTicketFraction = parseFloat(ethers.utils.formatEther(mumbaiPrizeTickets.mul(ethers.utils.parseEther('1')).div(totalEligibleTickets)))

  const rinkebyPicks = Math.floor(rinkebyTicketFraction * totalPicks)
  const mumbaiPicks = Math.floor(mumbaiTicketFraction * totalPicks)

  console.log(`rinkebyPicks: ${rinkebyPicks}`)
  console.log(`mumbaiPicks: ${mumbaiPicks}`)

  const rinkebyDrawSettings = {
    ...drawSettings,
    numberOfPicks: 1000
  }

  const mumbaiDrawSettings = {
    ...drawSettings,
    numberOfPicks: 1000
  }

  let rinkebyNewestDraw = { drawId: 0 }
  let rinkebyOldestDraw = { drawId: 1 }
  try {
    rinkebyNewestDraw = await drawHistoryRinkeby.getNewestDraw()
    console.log("rinkebyNewestDraw: ", rinkebyNewestDraw, "\n")
    rinkebyOldestDraw = await drawHistoryRinkeby.getOldestDraw()
    console.log("rinkebyOldestDraw: ", rinkebyOldestDraw, "\n")
  } catch (e) {
    // console.warn(e)
  }

  console.log(`Checking Rinkeby for drawId ${Math.max(1, rinkebyOldestDraw.drawId)} to ${rinkebyNewestDraw.drawId}`)  

  for (let drawId = Math.max(1, rinkebyOldestDraw.drawId); drawId <= rinkebyNewestDraw.drawId; drawId++) {
    console.log(`Checking Rinkeby draw ${drawId}`)
    try {
      await prizeDistributionHistoryRinkeby.getDrawSetting(drawId)
      console.log(`Rinkeby Draw Settings exist for ${drawId}`)
    } catch (e) {
      
      console.log(rinkebyNewestDraw, 'rinkebyNewestDraw')
      console.log("pushing draw to L1TimelockTriggerRinkeby", drawId)

      const beaconPeriodStartedAt = await drawBeacon.beaconPeriodStartedAt()
      const beaconPeriodSeconds = await drawBeacon.beaconPeriodSeconds()
      const draw = {
        drawId: rinkebyNewestDraw.drawId,
        timestamp: rinkebyNewestDraw.timestamp,
        winningRandomNumber: rinkebyNewestDraw.winningRandomNumber,
        beaconPeriodStartedAt: beaconPeriodStartedAt,
        beaconPeriodSeconds: beaconPeriodSeconds,
      }
      console.log('Draw for Rinkeby:', draw,)

      const tx = await l1TimelockTriggerRinkeby.populateTransaction.push(draw, rinkebyDrawSettings)  
      
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
  
  console.log(`Checking Rinkeby for drawId ${Math.max(1, rinkebyOldestDraw.drawId)} to ${rinkebyNewestDraw.drawId}`)  

  for (let drawId = Math.max(1, rinkebyOldestDraw.drawId); drawId <= rinkebyNewestDraw.drawId; drawId++) {
    console.log(`Checking Mumbai draw ${drawId}`)
    let draw
    try{
      draw = await drawHistoryRinkeby.getDraw(drawId)
      console.log(`got draw for drawId ${drawId}`)
    }
    catch(e){
      console.log(`drawId ${drawId} did not exist. skipping.`)
      continue
    }
    
    try {
      await prizeDistributionHistoryMumbai.getDrawSetting(drawId)
      console.log(`Mumbai Draw Settings exist for ${drawId}`)
    } catch (e) {

      console.log("Mumbai pushing draw ", draw)
      console.log("Mumbai pushing drawSettings", mumbaiDrawSettings)

      const tx = await l2TimelockTriggerMumbai.populateTransaction.pushDrawSettings(draw.drawId, mumbaiDrawSettings)
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
  console.log("Handler Complete!")
}

exports.handler = handler
