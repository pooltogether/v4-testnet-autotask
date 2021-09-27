const ethers = require('ethers')
const { Relayer } = require('defender-relay-client');
const { getContracts } = require('./getContracts')

async function calculatePicks(totalPicks, draw, drawSettings, reserveToCalculate, otherReserve) {
  const totalPicks = (2**drawSettings.bitRange)**drawSettings.cardinality
  const sampleStartTimestamp = draw.timestamp - drawSettings.drawStartTimestampOffset
  const sampleEndTimestamp = draw.timestamp - drawSettings.drawEndTimestampOffset
  
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
  const { drawId: lastRinkebyDrawId, drawSettings: lastRinkebyDrawSettings } = await tsunamiDrawSettingsHistoryRinkeby.getNewestDrawSettings()
  const rinkebyTimelockElapsed = await drawCalculatorTimelockRinkeby.hasElapsed()

  // If the draw settings hasn't propagated and we're allowed to push
  if (lastRinkebyDrawId < newestDraw.drawId && rinkebyTimelockElapsed) {
    // get the draw
    const draw = await drawHistoryRinkeby.getDraw(lastRinkebyDrawId + 1)

    // NOTE: This is bad!  Need to get this predictably and on-chain.
    const drawPeriod = (await drawBeacon.beaconPeriodSeconds()).toNumber()

    // compute the draw settings we want
    const bitRange = 3
    const cardinality = 5
    const drawSettings = {
      bitRangeSize: bitRange,
      matchCardinality: cardinality,
      distributions: [ethers.utils.parseUnits("0.5", 9),ethers.utils.parseUnits("0.3", 9), ethers.utils.parseUnits("0.2", 9)],
      maxPicksPerUser: 10,
      drawStartTimestampOffset: drawPeriod,
      drawEndTimestampOffset: drawPeriod*0.005 // basically equivalent to (one hour / week)
    }

    // calculate the fraction of picks based on reserve capture
    const picksRinkeby = await calculatePicks(draw, drawSettings, reserveRinkeby, reserveMumbai)

    const txData = await drawSettingsTimelockTriggerRinkeby.populateTransaction.pushDrawSettings(
      draw.drawId,
      {
        ...drawSettings,
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

  const { drawId: lastMumbaiDrawId } = await tsunamiDrawSettingsHistoryMumbai.getNewestDrawSettings()
  const mumbaiTimelockElapsed = await drawCalculatorTimelockMumbai.hasElapsed()
  
  if (lastMumbaiDrawId < lastRinkebyDrawId && mumbaiTimelockElapsed) {
    const draw = await drawHistoryRinkeby.getDraw(lastRinkebyDrawId)
    
    const picksMumbai = await calculatePicks(draw, lastRinkebyDrawSettings, reserveMumbai, reserveRinkeby)

    const txData = await fullTimelockTriggerMumbai.populateTransaction.push(draw, {
      ...lastRinkebyDrawSettings,
      numberOfPicks: picksMumbai
    })
    
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
