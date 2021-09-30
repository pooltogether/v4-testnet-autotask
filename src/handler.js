const ethers = require('ethers')
const { Relayer } = require('defender-relay-client');
const { getContracts } = require('./getContracts')

async function calculatePicks(draw, prizeDistributions, reserveToCalculate, otherReserve) {
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

  return Math.floor(numberOfPicks)
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
  reserveRinkeby,
  reserveMumbai,
  drawBeacon,
  drawHistoryRinkeby,
  prizeFlushRinkeby,
  prizeFlushMumbai,
  mockYieldSourceRinkeby,
  mockYieldSourceMumbai,
  prizeDistributionHistoryRinkeby,
  prizeDistributionHistoryMumbai,
  drawCalculatorTimelockRinkeby,
  drawCalculatorTimelockMumbai,
  l1TimelockTriggerRinkeby,
  l2TimelockTriggerMumbai
} = getContracts(infuraApiKey)

  const nextDrawId = await drawBeacon.nextDrawId()
  const getLastRngRequestId = await drawBeacon.getLastRngRequestId()
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

  const timestamp5Minutes = Math.floor(beaconPeriodStartedAt / 300)
  const doYield = timestamp5Minutes % 2 == 0;

  console.log(`timestamp5Minutes: ${timestamp5Minutes}`)
  
  if (doYield) {
    {
      console.log(`Yielding on rinkeby...`)
      const txData = await mockYieldSourceRinkeby.populateTransaction.yield(ethers.utils.parseEther("100"))
      const tx = await rinkebyRelayer.sendTransaction({
        data: txData.data,
        to: txData.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`yielded rinkeby: ${tx.hash}`)
    }
  
    {
      console.log(`Yielding on mumbai...`)
      const txData = await mockYieldSourceMumbai.populateTransaction.yield(ethers.utils.parseEther("100"))
      const tx = await mumbaiRelayer.sendTransaction({
        data: txData.data,
        to: txData.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`yielded mumbai: ${tx.hash}`)
    }
  
    {
      console.log(`Flush on rinkeby...`)
      const txData = await prizeFlushRinkeby.populateTransaction.flush()
      const tx = await rinkebyRelayer.sendTransaction({
        data: txData.data,
        to: txData.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`flushed rinkeby: ${tx.hash}`)
    }
  
    {
      console.log(`Flush on mumbai...`)
      const txData = await prizeFlushMumbai.populateTransaction.flush()
      const tx = await mumbaiRelayer.sendTransaction({
        data: txData.data,
        to: txData.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      console.log(`flushed mumbai: ${tx.hash}`)
    }  
  }
  
  if (await drawBeacon.canStartDraw()) {
    console.log(`Starting draw ${nextDrawId}...`)
    const tx = await drawBeacon.populateTransaction.startDraw()
    const txRes = await rinkebyRelayer.sendTransaction({
      data: tx.data,
      to: tx.to,
      speed: 'fast',
      gasLimit: 500000,
    });
    console.log(`Started Draw ${nextDrawId}: ${txRes.hash}`)
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
    console.log(`Completed Draw ${nextDrawId}: ${txRes.hash}`)
    completedDraw = true
  }

  let newestDraw
  try {
    newestDraw = await drawHistoryRinkeby.getNewestDraw()
  } catch (e) {
    console.warn(e)
    console.log("Nope.  Nothing yet.")
    return
  }
  
  let lastRinkebyPrizeDistributionDrawId = 0
  try {
    const { drawId } = await prizeDistributionHistoryRinkeby.getNewestPrizeDistribution()
    lastRinkebyPrizeDistributionDrawId = drawId
  } catch (e) {
  }
  const rinkebyTimelockElapsed = await drawCalculatorTimelockRinkeby.hasElapsed()

  console.log(`Last Rinkeby prize distribution draw id is ${lastRinkebyPrizeDistributionDrawId}`)

  // If the prize distribution hasn't propagated and we're allowed to push
  if (lastRinkebyPrizeDistributionDrawId < newestDraw.drawId && rinkebyTimelockElapsed) {
    // get the draw
    const drawId = lastRinkebyPrizeDistributionDrawId + 1
    const draw = await drawHistoryRinkeby.getDraw(drawId)

    const beaconPeriod = draw.beaconPeriodSeconds

    const firstDist = [ethers.utils.parseUnits("0.5", 9),ethers.utils.parseUnits("0.3", 9), ethers.utils.parseUnits("0.2", 9)]
    let distributions = new Array(16 - firstDist.length).fill(0)
    distributions = firstDist.concat(distributions)

    // compute the draw settings we want
    const bitRange = 3
    const cardinality = 5
    const prizeDistributions = {
      bitRangeSize: bitRange,
      matchCardinality: cardinality,
      distributions,
      maxPicksPerUser: 10,
      startTimestampOffset: beaconPeriod,
      prize: ethers.utils.parseEther('100'),
      endTimestampOffset: Math.floor(beaconPeriod*0.005) // basically equivalent to (one hour / week)
    }

    // calculate the fraction of picks based on reserve capture
    const picksRinkeby = await calculatePicks(draw, prizeDistributions, reserveRinkeby, reserveMumbai)

    console.log(`Rinkeby draw ${drawId} picks is ${picksRinkeby}`)

    const txData = await l1TimelockTriggerRinkeby.populateTransaction.push(
      draw.drawId,
      {
        ...prizeDistributions,
        // numberOfPicks: picksRinkeby
        // Temporary fix to get the machine running
        // numberOfPicks: ethers.BigNumber.from(ethers.utils.parseEther("1"))
        numberOfPicks: ethers.BigNumber.from('1000')
      }
    )

    console.log(`Pushing rinkeby prize distrubtion for draw ${drawId}...`)

    const tx = await rinkebyRelayer.sendTransaction({
      data: txData.data,
      to: txData.to,
      speed: 'fast',
      gasLimit: 500000,
    });

    console.log(`Propagated draw ${draw.drawId} to Rinkeby: `, tx)
  }

  let lastMumbaiPrizeDistributionDrawId = 0
  try {
    const { drawId } = await prizeDistributionHistoryMumbai.getNewestPrizeDistribution()
    lastMumbaiPrizeDistributionDrawId = drawId
  } catch (e) {
  }

  console.log(`Last Mumbai prize distribution draw id is ${lastMumbaiPrizeDistributionDrawId}`)

  const mumbaiTimelockElapsed = await drawCalculatorTimelockMumbai.hasElapsed()
  
  if (lastMumbaiPrizeDistributionDrawId < lastRinkebyPrizeDistributionDrawId && mumbaiTimelockElapsed) {
    const drawId = lastMumbaiPrizeDistributionDrawId + 1
    const draw = await drawHistoryRinkeby.getDraw(drawId)
    const prizeDistribution = await prizeDistributionHistoryRinkeby.getPrizeDistribution(drawId)
    
    const picksMumbai = await calculatePicks(draw, prizeDistribution, reserveMumbai, reserveRinkeby)

    console.log(`Mumbai draw ${drawId} has ${picksMumbai} picks`)

    const txData = await l2TimelockTriggerMumbai.populateTransaction.push(
      draw,
      {
        ...prizeDistribution,
        numberOfPicks: picksMumbai
      }
    )

    console.log(`Pushing draw ${drawId} to mumbai...`)
    
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
