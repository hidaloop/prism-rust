let chainsGroup = votingChainScreen.append('g').attr('class', 'chains').attr('id', 'chainsGroup')

const renderLink = d3.linkVertical().x(d => d.x+(1.25-1)/2*votingBlockSize).y(d => d.y)

const scrollVotingChain = idx => {
  let lastBlock = chainsData[idx].blocks[chainsData[idx].blocks.length-1]
  // Check if last block is below the screen's height
  while(lastBlock.y-2*votingBlockSize>height-0.4*height){
    // Select all chains and links for that specific chain and scroll by 2*votingBlockSize
    let scrollingBlocks = chainsGroup.select('#chain'+idx).selectAll('rect')
    scrollingBlocks
          .transition()
          .duration(t)
          .attr('x', d => d.x - votingBlockSize/2)
          .attr('y', d => {
            d.y = d.y-2*votingBlockSize
            return d.y
          })
    let scrollingLinks = chainsGroup.select('#links'+idx).selectAll('.chainLink')
          .transition()
          .duration(t)
          .attr('d', d => {
            if(!d.source) return
            let l = renderLink({source: d.target, target: {x: d.source.x, y: d.source.y+votingBlockSize}})
            return l
          })
    const regex = /M([^,]*),([^,]*) Q([^,]*),([^,]*) ([^,]*),([^,]*)/
    voteGroup.selectAll('.voteLink')
      .filter(d => d.fromChain==idx)
      .attr('d', d => {
        const groups = d.curve.match(regex)
        const sourceX = groups[1]
        const sourceY = parseInt(groups[2])
        const targetX = groups[5]
        const targetY = groups[6]
        d.curve = `M${sourceX},${sourceY-2*votingBlockSize} Q${sourceX-50},${sourceY-50-2*votingBlockSize} ${targetX},${targetY}`
        return `M${sourceX},${sourceY} Q${sourceX-50},${sourceY-50} ${targetX},${targetY}`
       })
      .transition()
      .duration(t)
      .attr('d', d => {
        return d.curve
      }) 
      .on('interrupt', d => {
          d3.select('#'+d.id).attr('d', d.curve)
       })
    if(chainsData[idx].shouldShift){
      voteGroup.selectAll('.voteLink')
               .filter(d => d.from===chainsData[idx].blocks[0].blockId)
               .remove()
      voteData = voteData.filter(d => d.from!==chainsData[idx].blocks[0].blockId)
      chainsData[idx].blocks.shift()
      chainsData[idx].links.shift()
    }
    else
      chainsData[idx].shouldShift = true 
    lastBlock = chainsData[idx].blocks[chainsData[idx].blocks.length-1]
  }
}

const drawVotingChain = (idx, votes) => {
  // Create data join
  let chainGroup = chainsGroup.select('#chain'+idx)
  let votingBlocks = chainGroup.selectAll('g.votingBlock').data(chainsData[idx].blocks, d => d.blockId)

  // Add group tags for each votingBlock
  let votingBlocksEnter = votingBlocks.enter().append('g')
                      .attr('class', 'votingBlock')

  // Add new blocks
  votingBlocksEnter.append('rect')
         .attr('class', 'votingBlock')
         .style('filter', 'url(#blockGlow)')
         .attr('id', d => 'votingBlock'+d.blockId)
         .attr('height', votingBlockSize)
         .attr('width', votingBlockSize*1.25)
         .attr('rx', 3)
         .attr('x', d => {
           // Voting block's x coordinate is equivalent to chain's x coordinate
           d.x = chainsData[idx].x
           return d.sourceNodeLocation ? d.sourceNodeLocation[0]-0.6*width + worldMapShift : d.x - votingBlockSize/2
          })
         .attr('y', d => {
           // Voting block's y coordinate is 2 below it's parent.
           // If parent does not exist, the block should appear at the top of the screen.
           d.y = d.parent ? d.parent.y+2*votingBlockSize : votingBlockSize/2
           return d.sourceNodeLocation ? d.sourceNodeLocation[1]+(height-0.6*height) : d.y
         })
         .transition()
         .duration(3*t)
         .attr('x', d => { 
           return d.x - votingBlockSize/2
         })
         .attr('y', d => {
           return d.y
         })
        .on('end', (d, i) => {
          if(i==chainsData[idx].blocks.length-1){
            const didScroll = scrollVotingChain(idx)
            if(didScroll){
              d3.timeout(() => castVotes(idx, votes), t)
            }
            else
              castVotes(idx, votes)
          }
        })
  // Remove extra blocks
  votingBlocks.exit().remove()

  // Create data join from specific link chain
  let linkGroup = chainsGroup.select('#links'+idx)
  let link = linkGroup.selectAll('.chainLink').data(chainsData[idx].links, d => d.target.blockId)

  // Add new links
  link.enter().append('path', '.votingBlock')
      .attr('class', 'chainLink')
      .attr('d', d => d.source ? renderLink({source: d.target, target: d.target}) : null)
      .transition()
      .delay(t)
      .duration(t)
      .attr('d', d => d.source ? renderLink({source: d.target, target: {x: d.source.x, y: d.source.y+votingBlockSize}}) : null)
      .transition()
      .delay(1)
      .attr('marker-end', 'url(#vote-arrow)')
  // Remove extra links
  link.exit().remove()

}

const addVotingBlock = (idx, blockId, sourceNodeId, parentId, votes) => {
  if(!chainsData[idx].blocks) return
  const sourceNode = globalNodesData.find(node => node.nodeId==sourceNodeId)
  const sourceNodeLocation = [sourceNode.x, sourceNode.y]
  const parent = parentId!==null ? chainsData[idx].blocks.find(b => b.blockId===parentId) : null
  const newNode = {parent, blockId, children: [], sourceNodeLocation} 
  if(parent) parent.children.push(newNode)
  chainsData[idx].links.push({source: parent, target: newNode})
  chainsData[idx].blocks.push(newNode)
  // 1) Add block to voting chain and draw
  drawVotingChain(idx, votes)
}

if(mock){
  // Initialize the chains spaced by votingChainScreenWidth/numChains
  let chain = 0, x=0
  let scale = d3.scaleLinear().domain([0, numChainsToDisplay]).range([1.0, 0.0])
  while(chain<numChainsToDisplay){
    chainsData.push({x, y: 0, blocks: [], links: [], lastVotedBlock: 0, fakeBlocks: [], fakeLinks: [], shouldShift: false})
    const genesisBlock = {parent: null, blockId: votingBlockId, children: [], sourceNodeLocation: null}
    chainsData[chain].blocks.push(genesisBlock)
    votingBlockId++
    let chainGroup = chainsGroup.append('g')
                                .attr('id', 'chain'+chain)
                                .style('opacity', scale(chain))
    let linkGroup = chainsGroup.append('g')
                               .attr('id', 'links'+chain)
                                .style('opacity', scale(chain))
    drawVotingChain(chain)
    chain++
    x+=votingChainScreenWidth/(numChainsToDisplay+1)
  }

  while(chain<numChains){
    chainsData.push({blocks: [], lastVotedBlock: 0, fakeBlocks: [], fakeLinks: []})
    const genesisBlock = {parent: null, blockId: votingBlockId, children: [], sourceNodeLocation: null}
    chainsData[chain].blocks.push(genesisBlock)
    votingBlockId+=1
    chain++
  }
}
else{
  // Initialize the chains spaced by votingChainScreenWidth/numChains
  let chain = 0, x=0
  let scale = d3.scaleLinear().domain([0, numChainsToDisplay]).range([1.0, 0.0])
  let votingBlockId = 1
  while(chain<numChainsToDisplay){
    let votingBlockIdStr = votingBlockId.toString(16)
    votingBlockIdStr = votingBlockIdStr.padStart(64, '0') 
    chainsData.push({x, y: 0, blocks: [], links: [], fakeBlocks: [], fakeLinks: []})
    const genesisBlock = {parent: null, blockId: votingBlockIdStr, children: [], sourceNodeLocation: null}
    chainsData[chain].blocks.push(genesisBlock)
    votingBlockId++
    let chainGroup = chainsGroup.append('g')
                                .attr('id', 'chain'+chain)
                                .style('opacity', scale(chain))
    let linkGroup = chainsGroup.append('g')
                               .attr('id', 'links'+chain)
                                .style('opacity', scale(chain))
    drawVotingChain(chain)
    chain++
    x+=votingChainScreenWidth/(numChainsToDisplay+1)
  }

  while(chain<numChains){
    let votingBlockIdStr = votingBlockId.toString(16)
    votingBlockIdStr = votingBlockIdStr.padStart(64, '0') 
    chainsData.push({x, y: 0, blocks: [], links: [], fakeBlocks: [], fakeLinks: []})
    const genesisBlock = {parent: null, blockId: votingBlockIdStr, children: [], sourceNodeLocation: null}
    chainsData[chain].blocks.push(genesisBlock)
    votingBlockId+=1
    let chainGroup = chainsGroup.append('g')
                                .attr('id', 'chain'+chain)
    let linkGroup = chainsGroup.append('g')
                               .attr('id', 'links'+chain)
    chain++
    x+=votingChainScreenWidth/(numChainsToDisplay+1)
  }
}
