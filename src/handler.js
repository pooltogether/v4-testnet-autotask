const { Relayer } = require('defender-relay-client');
const ethers = require('ethers')

const DrawBeaconRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawBeacon.json')
const DrawHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawHistory.json')
const PrizeDistributionHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/PrizeDistributionHistory.json')
const PrizeDistributionHistoryMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/PrizeDistributionHistory.json')
const ReserveRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/Reserve.json')
const ReserveMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/Reserve.json')
const L1TimelockTrigger = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawSettingsTimelockTrigger.json')
const L2TimelockTriggerMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/L2TimelockTrigger.json')

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

  // first let's check the beacon
  const ethereumProvider = new ethers.providers.InfuraProvider('rinkeby', infuraApiKey)
  const polygonProvider = new ethers.providers.JsonRpcProvider(`https://polygon-mumbai.infura.io/v3/${infuraApiKey}`)

  const drawBeacon = new ethers.Contract(DrawBeaconRinkeby.address, DrawBeaconRinkeby.abi, ethereumProvider)
  const drawHistoryRinkeby = new ethers.Contract(DrawHistoryRinkeby.address, DrawHistoryRinkeby.abi, ethereumProvider)
  const tsunamiDrawSettingsHistoryRinkeby = new ethers.Contract(PrizeDistributionHistoryRinkeby.address, PrizeDistributionHistoryRinkeby.abi, ethereumProvider)
  const tsunamiDrawSettingsHistoryMumbai = new ethers.Contract(PrizeDistributionHistoryMumbai.address, PrizeDistributionHistoryMumbai.abi, polygonProvider)
  const drawCalculatorTimelockRinkeby = new ethers.Contract(DrawCalculatorTimelockRinkeby.address, DrawCalculatorTimelockRinkeby.abi, ethereumProvider)
  const drawCalculatorTimelockMumbai = new ethers.Contract(DrawCalculatorTimelockMumbai.address, DrawCalculatorTimelockMumbai.abi, polygonProvider)
  const reserveRinkeby = new ethers.Contract(ReserveRinkeby.address, ReserveRinkeby.abi, ethereumProvider)
  const reserveMumbai = new ethers.Contract(ReserveMumbai.address, ReserveMumbai.abi, polygonProvider)
  const l1TimelockTriggerRinkeby = new ethers.Contract(L1TimelockTrigger.address, L1TimelockTrigger.abi, ethereumProvider)
  const l2TimelockTriggerMumbai = new ethers.Contract(L2TimelockTriggerMumbai.address, L2TimelockTriggerMumbai.abi, polygonProvider)

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

    const txData = await l1TimelockTriggerRinkeby.populateTransaction.pushDrawSettings(
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

    const txData = await l2TimelockTriggerMumbai.populateTransaction.push(draw, {
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
