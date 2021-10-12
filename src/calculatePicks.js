const ethers = require('ethers')

const debug = require('debug')('pt:calculatePicks')

async function calculatePicks(bitRange, cardinality, startTime, endTime, reserveToCalculate, otherReserve) {

    debug(`start time: ${startTime}, end time: ${endTime}`)
    
    const totalPicks = (2**bitRange)**cardinality
    const reserveAccumulated = await reserveToCalculate.getReserveAccumulatedBetween(startTime, endTime)

    debug(`Reserve contract ${reserveToCalculate.address} accumulated: ${reserveAccumulated.toString()}`)

    // console.log(`${reserveToCalculate.address} reserveAccumulated ${ethers.utils.formatEther(reserveAccumulated)}`)
    const otherReserveAccumulated = await otherReserve.getReserveAccumulatedBetween(startTime, endTime)

    debug(`Other reserve accumulated: ${otherReserveAccumulated.toString()}`)

    // console.log(`${otherReserve.address} otherReserveAccumulated ${ethers.utils.formatEther(otherReserveAccumulated)}`)
    let numberOfPicks
    if (reserveAccumulated.gt('0')) {
      // console.log(`reserveAccumulated gt 0 ..`)
      numberOfPicks = reserveAccumulated.mul(totalPicks).div(otherReserveAccumulated.add(reserveAccumulated))
    } else {
      // console.log(`calculatePicks setting numberOfPicks: 0`)
      numberOfPicks = ethers.BigNumber.from('0')
    }
    // console.log(`returning numberOfPicks ${Math.floor(numberOfPicks)}`)
    return Math.floor(numberOfPicks)
  }
  
  module.exports = {
    calculatePicks
  }