const { utils } = require('ethers')

function computeCardinality(
    bitRangeSize,
    totalSupply,
    totalSupplyDecimals
) {
    const range = 2**bitRangeSize

    let matchCardinality = 2

    let numberOfPicks
    do {
        numberOfPicks = utils.parseUnits(`${range**++matchCardinality}`, totalSupplyDecimals)
    } while (numberOfPicks.lt(totalSupply))

    matchCardinality--

    return matchCardinality
}

module.exports = {
    computeCardinality
}