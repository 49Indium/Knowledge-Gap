
d3.json("data/mindmap.json", function(e, graph) {
  if (e) throw e;
  const svg = d3.select("svg");
  const width = +svg.node().getBoundingClientRect().width;
  const height = +svg.node().getBoundingClientRect().height;
  const nodes = graph.nodes;
  const edges = graph.edges;

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
  svg_nodes.append("title").text(node => node.title);
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
    .velocityDecay(0.1) 
    .force("connection", d3.forceLink(edges).id(node => node.id).distance(edge => 1 + 10/edge.weight).strength(edge => 1.2/edge.weight))
    .force("repel", d3.forceManyBody().strength(-20))
    .force("centerX", d3.forceX(width / 2).strength(0.05))
    .force("centerY", d3.forceY(height / 2).strength(0.05))
    .on("tick", ticked);

  // return svg.node();
})

