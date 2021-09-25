const ethers = require('ethers')

const DrawBeaconRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawBeacon.json')
const DrawHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawHistory.json')
const PrizeDistributionHistoryRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/PrizeDistributionHistory.json')
const PrizeDistributionHistoryMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/PrizeDistributionHistory.json')
const L1TimelockTriggerRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/L1TimelockTrigger.json')
const L2TimelockTriggerMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/L2TimelockTrigger.json')
const TicketRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/Ticket.json')
const TicketMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/Ticket.json')
const DrawPrizesRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawPrizes.json')
const DrawPrizesMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/DrawPrizes.json')

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
  const drawPrizesRinkeby = new ethers.Contract(DrawPrizesRinkeby.address, DrawPrizesRinkeby.abi, ethereumProvider)
  const drawPrizesMumbai = new ethers.Contract(DrawPrizesMumbai.address, DrawPrizesMumbai.abi, polygonProvider)
  const l1TimelockTriggerRinkeby = new ethers.Contract(L1TimelockTriggerRinkeby.address, L1TimelockTriggerRinkeby.abi, ethereumProvider)
  const l2TimelockTriggerMumbai = new ethers.Contract(L2TimelockTriggerMumbai.address, L2TimelockTriggerMumbai.abi, polygonProvider)

  return {
    ethereumProvider,
    polygonProvider,
    drawBeacon,
    drawHistoryRinkeby,
    prizeDistributionHistoryRinkeby,
    prizeDistributionHistoryMumbai,
    ticketRinkeby,
    ticketMumbai,
    drawPrizesRinkeby,
    drawPrizesMumbai,
    l1TimelockTriggerRinkeby,
    l2TimelockTriggerMumbai,
  }
}

module.exports = {
  getContracts
}