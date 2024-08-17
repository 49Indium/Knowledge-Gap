
d3.json("data/mindmap.json", function(e, graph) {
  if (e) throw e;
  const svg = d3.select("svg");
  const width = +svg.node().getBoundingClientRect().width;
  const height = +svg.node().getBoundingClientRect().height;
  const nodes = graph.nodes;
  const edges = graph.links;
  console.log("hi")

  // Based upon https://observablehq.com/@d3/force-directed-graph/2?intent=fork
  function dragstarted(node) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    node.fx = node.x;
    node.fy = node.y;
  }
  function dragged(node) {
    node.fx = d3.event.x;
    node.fy = d3.event.y;
  }
  function dragended(node) {
    if (!d3.event.active) simulation.alphaTarget(0);
    node.fx = null;
    node.fy = null;
  }
  
  const svg_edges = svg.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .attr("class", "edges")
    .selectAll("line")
    .data(edges).enter()
    .append("line");
  const svg_nodes = svg.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("class", "nodes")
    .selectAll("circle")
    .data(nodes).enter()
    .append("circle")
    .attr("r", 5);
  svg_nodes.append("title").text(node => node.id);
  svg_nodes.call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended));

  ticked = function () {
    svg_edges.attr("x1", edge => edge.source.x)
      .attr("y1", edge => edge.source.y)
      .attr("x2", edge => edge.target.x)
      .attr("y2", edge => edge.target.y)
    svg_nodes.attr("cx", node => node.x)
      .attr("cy", node => node.y)
  }
  
  const simulation = d3.forceSimulation(nodes)
    .force("connection", d3.forceLink(edges).id(node => node.id))
    .force("repel", d3.forceManyBody())
    .force("center", d3.forceCenter(width / 2, height / 2))
    .on("tick", ticked);

  // return svg.node();
})

