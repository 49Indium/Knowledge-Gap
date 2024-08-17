let toggle_hidden = false;

function spiralForce(x, y, strength) {
  var nodes;
  function force() {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].x += strength * (nodes[i].y - y);
      nodes[i].y -= strength * (nodes[i].x - x);
    }
  }
  force.initialize = function(ns) {
    nodes = ns;
  }
  return force;
}

d3.select("#toggle-visible").on("click", event => {
  toggle_hidden = !toggle_hidden;

  if (toggle_hidden) {
    d3.select("#inputs-container")
      .attr("class", "hidden");
  } else {
    d3.select("#inputs-container")
      .attr("class", null);
  }
});

d3.json("data/mindmap.json", function(e, graph) {
  if (e) throw e;

  let forceConnection = 1.2;
  let distanceConnection = 10;
  let spiralForceDefault = 0.001;

  let input_sliders = [
    {
      id: "radius",
      label: "Radius",
      min: 2,
      max: 10,
      default: 5,
      onUpdate: r => svg_nodes.attr("r", r)
    },
    {
      id: "force-centre",
      label: "Centre Force",
      min: 0.01,
      max: 0.1,
      default: 0.05,
      onUpdate: f => simulation
          .force("centerX", d3.forceX(width  / 2).strength(f))
          .force("centerY", d3.forceY(height / 2).strength(f))
          .alphaTarget(0.3).restart()
    },
    {
      id: "force-repel",
      label: "Repulsion Force",
      min: 10,
      max: 40,
      default: 20,
      onUpdate: f => simulation
          .force("repel", d3.forceManyBody().strength(-f))
          .alphaTarget(0.3).restart()
    },
    {
      id: "force-connection",
      label: "Connection Force",
      min: 0.5,
      max: 2,
      default: forceConnection,
      onUpdate: f => {
        forceConnection = f;
        
        simulation
          .force("connection", d3.forceLink(edges)
          .id(node => node.id)
          .distance(edge => 1 + distanceConnection/edge.weight)
          .strength(edge => f/edge.weight))
          .alphaTarget(0.3).restart();
      }
    },
    {
      id: "distance-connection",
      label: "Connection Distance",
      min: 0.5,
      max: 40,
      default: distanceConnection,
      onUpdate: d => {
        distanceConnection = d;

        simulation
          .force("connection", d3.forceLink(edges)
          .id(node => node.id)
          .distance(edge => 1 + d/edge.weight)
          .strength(edge => forceConnection/edge.weight))
          .alphaTarget(0.3).restart();
      }
    },
    {
      id: "force-spiral",
      label: "Spiral Force",
      min: -0.03,
      max: 0.03,
      default: spiralForceDefault,
      onUpdate: f => simulation
        .force("spiral", spiralForce(width/2, height/2, f))
        .alphaTarget(0.3).restart()
    }
  ]

  function get_slider_prop(label) {
    return d3.select("#slider-" + label)
      .attr("value")
  }

  function updateSlider(slider, v) {
    d3.select("#slider-" + slider.id).attr("value", v);
    slider.onUpdate(v);
  }

  input_sliders.forEach((slider, i) => {
    const sliderDom = d3.select("#input-sliders")
        .append("div")
        .attr("class", "slider");

    sliderDom.append("label")
      .attr("for", "slider-" + slider.id)
      .attr("class", "slider-label")
      .text(slider.label);

    sliderDom.append("input")
      .attr("type", "range")
      .attr("step", "any")
      .attr("min", slider.min)
      .attr("max", slider.max)
      .attr("id", "slider-" + slider.id)
      .on("input", function() {
        updateSlider(slider, +this.value);
      });
  });

  const svg = d3.select("svg");
  const width = +svg.node().getBoundingClientRect().width;
  const height = +svg.node().getBoundingClientRect().height;
  const nodes = graph.nodes;
  const edges = graph.edges;
  const groups = graph.groups;
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  let hold_focus = false;
  let focus = null;
  let selected = null;

  function setFocus(node, hold) {
    if (hold_focus) {
      return;
    }

    if (focus) d3.select(focus).attr("r", get_slider_prop("radius"));
    if (focus == node) {
      focus = null;
      hold_focus = false;
    } else {
      focus = node;
      hold_focus = hold;
      d3.select(focus).attr("r", 2 * get_slider_prop("radius"));
    }
    svg_select_text.text(node.textContent);
  }
  
  let scale = 1;

  // Based upon https://observablehq.com/@d3/force-directed-graph/2?intent=fork
  function dragstarted(node) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    node.fx = node.x;
    node.fy = node.y;

    setFocus(this, true);
  }
  function dragged(node) {
    node.fx = d3.event.x;
    node.fy = d3.event.y;
  }
  function dragended(node) {
    // no longer want to stop simulation since we are orbitting
    // if (!d3.event.active) simulation.alphaTarget(0);
    node.fx = null;
    node.fy = null;

    setFocus(this, false);
  }
  function pan() {
    scale = d3.event.transform.k;
    svg_edges.attr("transform", d3.event.transform);
    svg_nodes.attr("transform", d3.event.transform);
  }
  function startHover(node) {
    setFocus(d3.event.target, false);
  }

  function clickNode(node) {
    if (selected) {
      other = d3.event.target;
      if (other == selected) {
        d3.select(selected).attr("stroke", "$fff");
        selected = null;
        return;
      }

      let selected_id = selected.__data__.id;
      let other_id = other.__data__.id;
      let edge = node_edge_map.get(selected_id + " " + other_id);
      if (edge) {
        // remove edge

        node_edge_map.delete(selected_id + " " + other_id);
        node_edge_map.delete(other_id + " " + selected_id);

        d3.select("#edge-" + edge.source.id + "-" + edge.target.id).remove();

        const index = edges.indexOf(edge);
        edges.splice(index, 1);

        // d3.select()
      } else {
        // add edge

        console.log(JSON.stringify(edges[0], null, 4));

        // proved more annoying than expected, moving on for now
        
        // let edge = {
        //   label: "0.5",
        //   source: selected_id,
        //   target: other_id,
        //   weight: 5.0
        // };
        
        // edges.push(edge);

        // node_edge_map.set(selected_id + " " + other_id, edge);
        // node_edge_map.set(other_id + " " + selected_id, edge);
      }

      d3.select(selected).attr("stroke", "$fff");
      selected = null;
    } else {
      selected = d3.event.target;
      d3.select(selected)
        .attr("stroke", "#000")
        .attr("stroke-width", 1.5)
        .attr("class", v => v.class + " selected");
    }
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
    .on("click", clickNode)
    .on("mouseover", startHover);
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
    .text(group => group.title)
    .attr("dy", "1em");

  // compute the node_edge map so that we can add/remove edges
  // efficiently.
  const node_edge_map = new Map();
  svg_edges.each(e => {
    edgeD = d3.select(this);
    
    node_edge_map.set(e.source + " " + e.target, e);
    node_edge_map.set(e.target + " " + e.source, e);
  });

  svg_nodes.append("title").text(node => node.title);
  svg_nodes.call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended));
  svg.call(d3.zoom().on("zoom", pan))

  function ticked() {
    svg_edges.attr("x1", edge => edge.source.x)
      .attr("y1", edge => edge.source.y)
      .attr("x2", edge => edge.target.x)
      .attr("y2", edge => edge.target.y)
      .attr("id", edge => "edge-" + edge.source.id + "-" + edge.target.id);
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
    .force("spiral", spiralForce(width/2, height/2, spiralForceDefault))
    .on("tick", ticked);

  
  input_sliders.forEach((slider, i) => updateSlider(slider, slider.default));
})

