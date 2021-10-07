const ethers = require('ethers')

const DrawBeaconRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawBeacon.json')

const DrawBufferRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawBuffer.json')

const PrizeDistributionBufferRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/PrizeDistributionBuffer.json')
const PrizeDistributionBufferMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/PrizeDistributionBuffer.json')

const DrawCalculatorTimelockRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/DrawCalculatorTimelock.json')
const DrawCalculatorTimelockMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/DrawCalculatorTimelock.json')

const L1TimelockTriggerRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/L1TimelockTrigger.json')
const L2TimelockTriggerMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/L2TimelockTrigger.json')

const TicketRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/Ticket.json')
const TicketMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/Ticket.json')

const PrizeDistributorRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/PrizeDistributor.json')
const PrizeDistributorMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/PrizeDistributor.json')

const PrizeFlushRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/PrizeFlush.json')
const PrizeFlushMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/PrizeFlush.json')

const ReserveRinkeby = require('@pooltogether/v4-testnet/deployments/rinkeby/Reserve.json')
const ReserveMumbai = require('@pooltogether/v4-testnet/deployments/mumbai/Reserve.json')

function getContracts(infuraApiKey) {
  // first let's check the beacon
  const ethereumProvider = new ethers.providers.InfuraProvider('rinkeby', infuraApiKey)
  const polygonProvider = new ethers.providers.JsonRpcProvider(`https://polygon-mumbai.infura.io/v3/${infuraApiKey}`)
  
  const drawBeacon = new ethers.Contract(DrawBeaconRinkeby.address, DrawBeaconRinkeby.abi, ethereumProvider)
  
  const drawBufferRinkeby = new ethers.Contract(DrawBufferRinkeby.address, DrawBufferRinkeby.abi, ethereumProvider)
  
  const prizeDistributionBufferRinkeby = new ethers.Contract(PrizeDistributionBufferRinkeby.address, PrizeDistributionBufferRinkeby.abi, ethereumProvider)
  const prizeDistributionBufferMumbai = new ethers.Contract(PrizeDistributionBufferMumbai.address, PrizeDistributionBufferMumbai.abi, polygonProvider)
  
  const ticketRinkeby = new ethers.Contract(TicketRinkeby.address, TicketRinkeby.abi, ethereumProvider)
  const ticketMumbai = new ethers.Contract(TicketMumbai.address, TicketMumbai.abi, polygonProvider)
  
  const prizeDistributorRinkeby = new ethers.Contract(PrizeDistributorRinkeby.address, PrizeDistributorRinkeby.abi, ethereumProvider)
  const prizeDistributorMumbai = new ethers.Contract(PrizeDistributorMumbai.address, PrizeDistributorMumbai.abi, polygonProvider)
  
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
    drawBufferRinkeby,
    prizeFlushRinkeby,
    prizeFlushMumbai,
    prizeDistributionBufferRinkeby,
    prizeDistributionBufferMumbai,
    drawCalculatorTimelockRinkeby,
    drawCalculatorTimelockMumbai,
    ticketRinkeby,
    ticketMumbai,
    reserveRinkeby,
    reserveMumbai,
    prizeDistributorRinkeby,
    prizeDistributorMumbai,
    l1TimelockTriggerRinkeby,
    l2TimelockTriggerMumbai,
  }
}

module.exports = {
  getContracts
}