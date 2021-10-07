const ethers = require('ethers')

const DrawBeaconRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawBeacon.json')
const DrawHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawHistory.json')
const PrizeDistributionHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/PrizeDistributionHistory.json')
const PrizeDistributionHistoryMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/PrizeDistributionHistory.json')
const DrawCalculatorTimelockRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawCalculatorTimelock.json')
const DrawCalculatorTimelockMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/DrawCalculatorTimelock.json')
const L1TimelockTriggerRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/L1TimelockTrigger.json')
const L2TimelockTriggerMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/L2TimelockTrigger.json')
const TicketRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/Ticket.json')
const TicketMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/Ticket.json')
const DrawPrizeRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawPrize.json')
const DrawPrizeMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/DrawPrize.json')
const PrizeFlushRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/PrizeFlush.json')
const PrizeFlushMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/PrizeFlush.json')
const ReserveRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/Reserve.json')
const ReserveMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/Reserve.json')

function getContracts(infuraApiKey) {
  // first let's check the beacon
  const ethereumProvider = new ethers.providers.InfuraProvider('rinkeby', infuraApiKey)
  const polygonProvider = new ethers.providers.JsonRpcProvider(`https://polygon-mumbai.infura.io/v3/${infuraApiKey}`)
  
  const drawBeacon = new ethers.Contract(DrawBeaconRinkeby.address, DrawBeaconRinkeby.abi, ethereumProvider)
  const drawHistoryRinkeby = new ethers.Contract(DrawHistoryRinkeby.address, DrawHistoryRinkeby.abi, ethereumProvider)
  const prizeDistributionHistoryRinkeby = new ethers.Contract(PrizeDistributionHistoryRinkeby.address, PrizeDistributionHistoryRinkeby.abi, ethereumProvider)
  const prizeDistributionHistoryMumbai = new ethers.Contract(PrizeDistributionHistoryMumbai.address, PrizeDistributionHistoryMumbai.abi, polygonProvider)
  const ticketRinkeby = new ethers.Contract(TicketRinkeby.address, TicketRinkeby.abi, ethereumProvider)
  const ticketMumbai = new ethers.Contract(TicketMumbai.address, TicketMumbai.abi, polygonProvider)
  const drawPrizeRinkeby = new ethers.Contract(DrawPrizeRinkeby.address, DrawPrizeRinkeby.abi, ethereumProvider)
  const drawPrizeMumbai = new ethers.Contract(DrawPrizeMumbai.address, DrawPrizeMumbai.abi, polygonProvider)
  const prizeFlushRinkeby = new ethers.Contract(PrizeFlushRinkeby.address, PrizeFlushRinkeby.abi, ethereumProvider)
  const prizeFlushMumbai = new ethers.Contract(PrizeFlushMumbai.address, PrizeFlushMumbai.abi, polygonProvider)
  const reserveRinkeby = new ethers.Contract(ReserveRinkeby.address, ReserveRinkeby.abi, ethereumProvider)
  const reserveMumbai = new ethers.Contract(ReserveMumbai.address, ReserveMumbai.abi, polygonProvider)
  const drawCalculatorTimelockRinkeby = new ethers.Contract(DrawCalculatorTimelockRinkeby.address, DrawCalculatorTimelockRinkeby.abi, ethereumProvider)
  const drawCalculatorTimelockMumbai = new ethers.Contract(DrawCalculatorTimelockMumbai.address, DrawCalculatorTimelockMumbai.abi, polygonProvider)
  const l1TimelockTriggerRinkeby = new ethers.Contract(L1TimelockTriggerRinkeby.address, L1TimelockTriggerRinkeby.abi, ethereumProvider)
  const l2TimelockTriggerMumbai = new ethers.Contract(L2TimelockTriggerMumbai.address, L2TimelockTriggerMumbai.abi, polygonProvider)

  return {
    ethereumProvider,
    polygonProvider,
    drawBeacon,
    drawHistoryRinkeby,
    prizeFlushRinkeby,
    prizeFlushMumbai,
    prizeDistributionHistoryRinkeby,
    prizeDistributionHistoryMumbai,
    drawCalculatorTimelockRinkeby,
    drawCalculatorTimelockMumbai,
    ticketRinkeby,
    ticketMumbai,
    reserveRinkeby,
    reserveMumbai,
    drawPrizeRinkeby,
    drawPrizeMumbai,
    l1TimelockTriggerRinkeby,
    l2TimelockTriggerMumbai,
  }
}

module.exports = {
  getContracts
}