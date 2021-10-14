const ethers = require('ethers')
const { Relayer } = require('defender-relay-client');
const { getContracts } = require('./getContracts')
const { computePrizeDistribution } = require('./computePrizeDistribution')
const debug = require('debug')('pt:handler')

async function handler(event) {
  const rinkebyRelayer = new Relayer(event);
  const {
    mumbaiRelayerApiKey,
    mumbaiRelayerSecret,
    infuraApiKey
  } = event.secrets;
  const mumbaiRelayer = new Relayer({apiKey: mumbaiRelayerApiKey, apiSecret: mumbaiRelayerSecret})

  const {
    drawBufferRinkeby,
    prizeDistributionBufferRinkeby,
    prizeDistributionBufferMumbai,
    drawCalculatorTimelockRinkeby,
    drawCalculatorTimelockMumbai,
    l1TimelockTriggerRinkeby,
    l2TimelockTriggerMumbai,
    ticketMumbai,
    ticketRinkeby,
    prizeTierHistoryRinkeby
  } = getContracts(infuraApiKey)

  let newestDraw
  try {
    newestDraw = await drawBufferRinkeby.getNewestDraw()
  } catch (e) {
    console.warn(e)
    console.log("Nope.  Nothing yet.")
    return
  }

  console.log(`Newest draw id is ${newestDraw.drawId}`)

  /// Rinkeby Prize Distribution (L1 Trigger)

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
    const drawId = lastRinkebyPrizeDistributionDrawId + 1
    const draw = await drawBufferRinkeby.getDraw(drawId)

    const prizeDistribution = await computePrizeDistribution(
      draw,
      prizeTierHistoryRinkeby,
      ticketRinkeby,
      ticketMumbai
    )
    
    const txData = await l1TimelockTriggerRinkeby.populateTransaction.push(draw, prizeDistribution)

    console.log(`Pushing rinkeby prize distrubtion for draw ${drawId}...`)

    const tx = await rinkebyRelayer.sendTransaction({
      data: txData.data,
      to: txData.to,
      speed: 'fast',
      gasLimit: 500000,
    });

    console.log(`Propagated prize distribution for draw ${draw.drawId} to Rinkeby: `, tx)
  }



  /// Mumbai Prize Distribution (L2 Trigger)

  let lastMumbaiPrizeDistributionDrawId = 0
  try {
    const { drawId } = await prizeDistributionBufferMumbai.getNewestPrizeDistribution()
    lastMumbaiPrizeDistributionDrawId = drawId
  } catch (e) {
  }

  console.log(`Last Mumbai prize distribution draw id is ${lastMumbaiPrizeDistributionDrawId}`)

  const mumbaiTimelockElapsed = await drawCalculatorTimelockMumbai.hasElapsed()
  
  if (lastMumbaiPrizeDistributionDrawId < newestDraw.drawId && mumbaiTimelockElapsed) {
    const drawId = lastMumbaiPrizeDistributionDrawId + 1
    const draw = await drawBufferRinkeby.getDraw(drawId)

    const prizeDistribution = await computePrizeDistribution(
      draw,
      prizeTierHistoryRinkeby,
      ticketMumbai,
      ticketRinkeby
    )

    const txData = await l2TimelockTriggerMumbai.populateTransaction.push(draw, prizeDistribution)

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
