async function getTotalEligibleTickets([ticketRinkeby, ticketMumbai]) {
  const rinkebyPrizeTickets = await ticketRinkeby.balanceOf(drawPrizesRinkeby.address)
  const mumbaiPrizeTickets = await ticketMumbai.balanceOf(drawPrizesMumbai.address)
  const totalEligibleTickets = (await ticketMumbai.totalSupply()).add(await ticketRinkeby.totalSupply()).sub(rinkebyPrizeTickets).sub(mumbaiPrizeTickets)
  return totalEligibleTickets
}

module.exports = {
  getTotalEligibleTickets
}