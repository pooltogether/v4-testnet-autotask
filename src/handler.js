const ethers = require('ethers')
const { Relayer } = require('defender-relay-client');
const { getContracts } = require('./getContracts')

async function calculatePicks(totalPicks, draw, prizeDistributions, reserveToCalculate, otherReserve) {
  const totalPicks = (2**prizeDistributions.bitRange)**prizeDistributions.cardinality
  const sampleStartTimestamp = draw.timestamp - prizeDistributions.startTimestampOffset
  const sampleEndTimestamp = draw.timestamp - prizeDistributions.endTimestampOffset
  
  const reserveAccumulated = await reserveToCalculate.getReserveAccumulatedBetween(sampleStartTimestamp, sampleEndTimestamp)
  const otherReserveAccumulated = await otherReserve.getReserveAccumulatedBetween(sampleStartTimestamp, sampleEndTimestamp)

  let numberOfPicks
  if (reserveAccumulated.gt('0')) {
    numberOfPicks = reserveAccumulated.mul(totalPicks).div(otherReserveAccumulated.add(reserveAccumulated))
  } else {
    numberOfPicks = ethers.BigNumber.from('0')
  }

  return numberOfPicks
}

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
    console.log(`Started Draw ${nextDrawId}`)
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
    console.log(`Completed Draw ${nextDrawId}`)
    completedDraw = true
  }

  const newestDraw = await drawHistoryRinkeby.getNewestDraw()
  const { drawId: lastRinkebyDrawId, prizeDistributions: lastRinkebyPrizeDistributions } = await tsunamiPrizeDistributionsHistoryRinkeby.getNewestPrizeDistributions()
  const rinkebyTimelockElapsed = await drawCalculatorTimelockRinkeby.hasElapsed()

  // If the prize distribution hasn't propagated and we're allowed to push
  if (lastRinkebyDrawId < newestDraw.drawId && rinkebyTimelockElapsed) {
    // get the draw
    const draw = await drawHistoryRinkeby.getDraw(lastRinkebyDrawId + 1)

    // NOTE: This is bad!  Need to get this predictably and on-chain.
    const beaconPeriod = draw.beaconPeriodSeconds.toNumber()

    // compute the draw settings we want
    const bitRange = 3
    const cardinality = 5
    const prizeDistributions = {
      bitRangeSize: bitRange,
      matchCardinality: cardinality,
      distributions: [ethers.utils.parseUnits("0.5", 9),ethers.utils.parseUnits("0.3", 9), ethers.utils.parseUnits("0.2", 9)],
      maxPicksPerUser: 10,
      startTimestampOffset: beaconPeriod,
      endTimestampOffset: beaconPeriod*0.005 // basically equivalent to (one hour / week)
    }

    // calculate the fraction of picks based on reserve capture
    const picksRinkeby = await calculatePicks(draw, prizeDistributions, reserveRinkeby, reserveMumbai)

    const txData = await prizeDistributionsTimelockTriggerRinkeby.populateTransaction.pushPrizeDistributions(
      draw.drawId,
      {
        ...prizeDistributions,
        numberOfPicks: picksRinkeby.toNumber()
      }
    )

    const tx = await rinkebyRelayer.sendTransaction({
      data: txData.data,
      to: txData.to,
      speed: 'fast',
      gasLimit: 500000,
    });

    console.log(`Propagated draw ${draw.drawId} to Rinkeby: `, tx)
  }

  const { drawId: lastMumbaiDrawId } = await tsunamiPrizeDistributionsHistoryMumbai.getNewestPrizeDistribution()
  const mumbaiTimelockElapsed = await drawCalculatorTimelockMumbai.hasElapsed()
  
  if (lastMumbaiDrawId < lastRinkebyDrawId && mumbaiTimelockElapsed) {
    const drawId = lastMumbaiDrawId + 1
    const draw = await drawHistoryRinkeby.getDraw(drawId)
    const prizeDistribution = await prizeDistributionsHistoryRinkeby.getPrizeDistribution(drawId)
    
    const picksMumbai = await calculatePicks(draw, prizeDistribution, reserveMumbai, reserveRinkeby)

    const txData = await l2TimelockTriggerMumbai.populateTransaction.push(
      draw,
      {
        ...prizeDistribution,
        numberOfPicks: picksMumbai
      }
    )
    
    const tx = await mumbaiRelayer.sendTransaction({
      data: txData.data,
      to: txData.to,
      speed: 'fast',
      gasLimit: 500000,
    });

    console.log(`Propagated draw ${draw.drawId} to Mumbai: `, tx)
  }

  console.log("Handler Complete!")
}

exports.handler = handler
