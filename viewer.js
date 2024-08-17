input_sliders = [
  {
    label: "radius",
    min: 5,
    max: 15
  }
]

input_sliders.forEach((slider, i) => {
  const sliderDom = d3.select("#inputs")
      .append("div")
      .attr("class", "slider");

  sliderDom.append("label")
    .attr("for", "slider-" + slider.label)
    .attr("class", "slider-label")
    .text(slider.label);

  sliderDom.append("input")
    .attr("type", "range")
    .attr("min", slider.min)
    .attr("max", slider.max)
    .attr("id", "slider-" + slider.label)
});

function get_slider_prop(label) {
  return d3.select("#slider-" + label)
    .attr("value")
}

d3.json("data/mindmap.json", function(e, graph) {
  if (e) throw e;

  const svg = d3.select("svg");
  const width = +svg.node().getBoundingClientRect().width;
  const height = +svg.node().getBoundingClientRect().height;
  const nodes = graph.nodes;
  const edges = graph.edges;
  const groups = graph.groups;
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  
  let focus = null;
  let scale = 1;


  d3.select("#slider-radius").on("input", function() {
    update_radius(+this.value);
  });
  
  function update_radius(r) {
    d3.select("#slider-radius").attr("value", r);
    svg_nodes.attr("r", r);
  }

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
  function pan() {
    scale = d3.event.transform.k;
    svg_edges.attr("transform", d3.event.transform);
    svg_nodes.attr("transform", d3.event.transform);
  }
  function start_hover(node) {
    if (focus) d3.select(focus).attr("r", get_slider_prop("radius"));
    if (focus == d3.event.target) {
      focus = null;
    } else {
      focus = d3.event.target;
      d3.select(focus).attr("r", 2 * get_slider_prop("radius"));
    }
    svg_select_text.text(d3.event.target.textContent);
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
    .attr("r", 5)
    .attr("class", node => "group-" + node.group)
    .attr("fill", node => color(node.group))
    .on("click", start_hover)
    .on("mouseover", start_hover);
  const svg_select_text = svg.append("text")
    .text("")
    .attr("x", "50%")
    .attr("y", "1em")
    .attr("text-anchor", "middle")
    .attr("dy", "1em")
    .attr("stroke", "white")
    .attr("stroke-width", "4")
    .attr("fill", "black")
    .attr("paint-order", "stroke");
  const svg_group_text = svg.append("g")
    .attr("text-anchor", "middle")
    .attr("dy", "1em")
    .attr("stroke", "white")
    .attr("stroke-width", "4")
    .attr("fill", "black")
    .attr("paint-order", "stroke")
    .selectAll("text")
    .data(groups).enter()
    .append("text")
    .attr("id", group => "group-title-" + group.index)
    .text(group => group.title);
    .attr("dy", "1em");
  svg_nodes.append("title").text(node => node.title);
  svg_nodes.call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended));
  svg.call(d3.zoom().on("zoom", pan))

  ticked = function () {
    svg_edges.attr("x1", edge => edge.source.x)
      .attr("y1", edge => edge.source.y)
      .attr("x2", edge => edge.target.x)
      .attr("y2", edge => edge.target.y);
    svg_nodes.attr("cx", node => node.x)
      .attr("cy", node => node.y);
    for (group of svg_group_text.nodes()) {
      let sum_x = 0;
      let sum_y = 0;
      let n = d3.selectAll(".group-" + group.__data__.index).nodes().length;
      for (circ of d3.selectAll(".group-" + group.__data__.index).nodes()) {
        sum_x += circ.cx.baseVal.value;
        sum_y += circ.cy.baseVal.value;
      }
      d3.selectAll("#group-title-" + group.__data__.index)
        .attr("x", sum_x / n)
        .attr("y", sum_y / n)
    }
  }

  const simulation = d3.forceSimulation(nodes)
    .velocityDecay(0.1) 
    .force("connection", d3.forceLink(edges).id(node => node.id).distance(edge => 1 + 10/edge.weight).strength(edge => 1.2/edge.weight))
    .force("repel", d3.forceManyBody().strength(-20))
    .force("centerX", d3.forceX(width / 2).strength(0.05))
    .force("centerY", d3.forceY(height / 2).strength(0.05))
    .on("tick", ticked);
})

