const ethers = require('ethers')
const { Relayer } = require('defender-relay-client');
const { getContracts } = require('./getContracts')

async function calculatePicks(draw, prizeDistribution, reserveToCalculate, otherReserve) {
  
  const totalPicks = (2**prizeDistribution.bitRangeSize)**prizeDistribution.matchCardinality
  const sampleStartTimestamp = draw.timestamp - prizeDistribution.startTimestampOffset
  const sampleEndTimestamp = draw.timestamp - prizeDistribution.endTimestampOffset
  
  const reserveAccumulated = await reserveToCalculate.getReserveAccumulatedBetween(sampleStartTimestamp, sampleEndTimestamp)

  console.log(`${reserveToCalculate.address} reserveAccumulated ${ethers.utils.formatEther(reserveAccumulated)}`)

  const otherReserveAccumulated = await otherReserve.getReserveAccumulatedBetween(sampleStartTimestamp, sampleEndTimestamp)

  console.log(`${otherReserve.address} otherReserveAccumulated ${ethers.utils.formatEther(otherReserveAccumulated)}`)

  let numberOfPicks
  if (reserveAccumulated.gt('0')) {
    console.log(`reserveAccumulated gt 0 ..`)

    numberOfPicks = reserveAccumulated.mul(totalPicks).div(otherReserveAccumulated.add(reserveAccumulated))
  } else {
    console.log(`calculatePicks setting numberOfPicks: 0`)
    numberOfPicks = ethers.BigNumber.from('0')
  }
  console.log(`returning numberOfPicks ${Math.floor(numberOfPicks)}`)
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
  drawBufferRinkeby,
  prizeDistributionBufferRinkeby,
  prizeDistributionBufferMumbai,
  drawCalculatorTimelockRinkeby,
  drawCalculatorTimelockMumbai,
  l1TimelockTriggerRinkeby,
  l2TimelockTriggerMumbai
} = getContracts(infuraApiKey)

  let newestDraw
  try {
    newestDraw = await drawBufferRinkeby.getNewestDraw()
  } catch (e) {
    console.warn(e)
    console.log("Nope.  Nothing yet.")
    return
  }
  
  let lastRinkebyPrizeDistributionDrawId = 0
  try {
    const { drawId } = await prizeDistributionBufferRinkeby.getNewestPrizeDistribution()
    lastRinkebyPrizeDistributionDrawId = drawId
  } catch (e) {
  }
  const rinkebyTimelockElapsed = await drawCalculatorTimelockRinkeby.hasElapsed()

  console.log(`Last Rinkeby prize distribution draw id is ${lastRinkebyPrizeDistributionDrawId}`)

  // If the prize distribution hasn't propagated and we're allowed to push
  if (lastRinkebyPrizeDistributionDrawId < newestDraw.drawId && rinkebyTimelockElapsed) {
    // get the draw
    const drawId = lastRinkebyPrizeDistributionDrawId + 1
    const draw = await drawBufferRinkeby.getDraw(drawId)

    const beaconPeriod = draw.beaconPeriodSeconds
    console.log("beaconPeriod:", beaconPeriod)

    const firstTier = [ethers.utils.parseUnits("0.5", 9),ethers.utils.parseUnits("0.3", 9), ethers.utils.parseUnits("0.2", 9)]
    let tiers = new Array(16 - firstTier.length).fill(0)
    tiers = firstTier.concat(tiers)

    // compute the draw settings we want
    const bitRange = 3
    const cardinality = 5
    const prizeDistributions = {
      bitRangeSize: bitRange,
      matchCardinality: cardinality,
      tiers,
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
        numberOfPicks: picksRinkeby
      }
    )

    console.log(`Pushing rinkeby prize distrubtion for draw ${drawId}...`)

    const tx = await rinkebyRelayer.sendTransaction({
      data: txData.data,
      to: txData.to,
      speed: 'fast',
      gasLimit: 500000,
    });

    console.log(`Propagated prize distribution for draw ${draw.drawId} to Rinkeby: `, tx)
  }

  let lastMumbaiPrizeDistributionDrawId = 0
  try {
    const { drawId } = await prizeDistributionBufferMumbai.getNewestPrizeDistribution()
    lastMumbaiPrizeDistributionDrawId = drawId
  } catch (e) {
  }

  console.log(`Last Mumbai prize distribution draw id is ${lastMumbaiPrizeDistributionDrawId}`)

  const mumbaiTimelockElapsed = await drawCalculatorTimelockMumbai.hasElapsed()
  
  if (lastMumbaiPrizeDistributionDrawId < lastRinkebyPrizeDistributionDrawId && mumbaiTimelockElapsed) {
    const drawId = lastMumbaiPrizeDistributionDrawId + 1
    const draw = await drawBufferRinkeby.getDraw(drawId)
    const prizeDistribution = await prizeDistributionBufferRinkeby.getPrizeDistribution(drawId)
    
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
