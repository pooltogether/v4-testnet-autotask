const { computeCardinality } = require('./computeCardinality')
const { calculatePicks } = require('./calculatePicks')
const debug = require('debug')('pt:computePrizeDistribution')

async function computePrizeDistribution(
    draw,
    prizeTierHistory,
    reserveToCalculate,
    otherReserve,
    totalSupplyTickets,
    totalSupplyDecimals
) {
    debug('entered')

    const prizeTier = await prizeTierHistory.getPrizeTier(draw.drawId)

    const beaconPeriod = draw.beaconPeriodSeconds
    const startTimestampOffset = beaconPeriod
    const endTimestampOffset = 300 // say five minutes of offset.  enough for clock drift?

    debug('computing cardinality...')

    const matchCardinality = computeCardinality(prizeTier.bitRangeSize, totalSupplyTickets, totalSupplyDecimals)

    debug(`cardinality is ${matchCardinality}`)

    debug('computing number of picks...')

    const numberOfPicks = await calculatePicks(prizeTier.bitRangeSize, matchCardinality, draw.timestamp - startTimestampOffset, draw.timestamp - endTimestampOffset, reserveToCalculate, otherReserve)

    debug(`number of picks is ${numberOfPicks}`)

    const prizeDistribution = {
      bitRangeSize: prizeTier.bitRangeSize,
      matchCardinality,
      tiers: prizeTier.tiers,
      maxPicksPerUser: prizeTier.maxPicksPerUser,
      numberOfPicks,
      startTimestampOffset,
      prize: prizeTier.prize,
      endTimestampOffset
    }

    // debug('prize distribution: ', prizeDistribution)

    return prizeDistribution
}
  
module.exports = {
    computePrizeDistribution
}
