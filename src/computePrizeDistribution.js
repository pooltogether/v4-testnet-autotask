const { computeCardinality } = require('./computeCardinality')
const { ethers } = require('ethers')
const debug = require('debug')('pt:computePrizeDistribution')

const { utils } = require('@pooltogether/v4-autotask-lib')

async function computePrizeDistribution(
    draw,
    prizeTierHistory,
    ticketsToCalculate,
    otherTickets
) {
    debug('entered')

    const prizeTier = await prizeTierHistory.getPrizeTier(draw.drawId)

    const beaconPeriod = draw.beaconPeriodSeconds
    const startTimestampOffset = beaconPeriod
    const endTimestampOffset = prizeTier.endTimestampOffset

    debug(prizeTier)

    const decimals = await ticketsToCalculate.decimals()

    const startTime = draw.timestamp - startTimestampOffset
    const endTime = draw.timestamp - endTimestampOffset

    const ticketAverage = await ticketsToCalculate.getAverageTotalSuppliesBetween([startTime], [endTime])
    const otherTicketAverage = await otherTickets.getAverageTotalSuppliesBetween([startTime], [endTime])

    const combinedTotalSupply = ticketAverage[0].add(otherTicketAverage[0])

    const matchCardinality = computeCardinality(prizeTier.bitRangeSize, combinedTotalSupply, decimals)

    debug(`cardinality is ${matchCardinality}`)

    debug(`total supply (combined): ${ethers.utils.formatUnits(combinedTotalSupply, decimals)}`)
    debug(`total number of picks: ${(2**prizeTier.bitRangeSize)**matchCardinality}`)

    let numberOfPicks = ethers.BigNumber.from('0')
    if (combinedTotalSupply.gt('0')) {
        numberOfPicks = await utils.calculatePicks(prizeTier.bitRangeSize, matchCardinality, startTime, endTime, ticketsToCalculate, otherTickets)
    }

    debug(`number of picks is ${numberOfPicks}`)

    const prizeDistribution = {
      bitRangeSize: prizeTier.bitRangeSize,
      matchCardinality,
      tiers: prizeTier.tiers,
      maxPicksPerUser: prizeTier.maxPicksPerUser,
      numberOfPicks,
      startTimestampOffset,
      prize: prizeTier.prize,
      endTimestampOffset,
      expiryDuration: prizeTier.validityDuration
    }

    debug(`prizeDistribution: `, prizeDistribution)

    return prizeDistribution
}

module.exports = {
    computePrizeDistribution
}
