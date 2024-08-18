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
  let dampeningDefault = 0.1;

  let input_sliders = [
    {
      id: "radius",
      label: "Radius",
      min: 2,
      max: 10,
      default: 5,
      onUpdate: r => v_dom_nodes.attr("r", r)
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
      min: -0.01,
      max: 0.01,
      default: spiralForceDefault,
      onUpdate: f => simulation
        .force("spiral", spiralForce(width/2, height/2, f))
        .alphaTarget(0.3).restart()
    },
    {
      id: "dampening",
      label: "Dampening",
      min: 0.01,
      max: 1,
      default: dampeningDefault,
      onUpdate: f => simulation.velocityDecay(f)
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

  const canvas = d3.select("#canvas-main");
  const canvas_hidden = d3.select("#canvas-hidden");
  const svg = d3.select("svg");
  const nodes = graph.nodes;
  const edges = graph.edges;
  const groups = graph.groups;
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  let width = +canvas.node().getBoundingClientRect().width;
  let height = +canvas.node().getBoundingClientRect().height;

  let next_col = 1; // used to assign each node a unique colour for selection.
  let colour_to_node = {}; // map each unique colour to the associated node.
  
  let scale = 1;

  let hold_focus = false;
  let focus = null;
  let selected = null;

  svg.on("mousemove", () => {
    let pixel_ratio = window.devicePixelRatio;
    let mouse_x = d3.event.offsetX * pixel_ratio;
    let mouse_y = d3.event.offsetY * pixel_ratio;

    let col = ctx_hidden.getImageData(mouse_x, mouse_y, 1, 1).data;
    let col_key = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
    let node_data = colour_to_node[col_key];

    if (node_data) {
      setFocus(node_data, false);
    }
  });

  function setFocus(node, hold) {
    console.log(node)
    if (hold_focus) {
      return;
    }

    if (focus) focus.attr("r", get_slider_prop("radius"));
    if (focus == node) {
      focus = null;
      hold_focus = false;
    } else {
      focus = v_dom_nodes.filter(d => d.id == node.id);
      // console.log(focus);
      hold_focus = hold;
      focus.attr("r", 2 * get_slider_prop("radius"));
    }
    svg_select_text.text(node.title);
  }

  function uniqueColour() {
    if (next_col >= 16777215) {
      // unlikely to ever come up
      alert("Warning: Used up all unique colours");
    }
    
    var ret = [];
    ret.push(next_col & 0x0000ff);          // R
    ret.push((next_col & 0x00ff00) >> 8);   // G
    ret.push((next_col & 0xff0000) >> 16); // B

    next_col += 10;
    return "rgb(" + ret.join(',') + ")";
  }

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
    v_dom_edges.attr("transform", d3.event.transform);
    v_dom_nodes.attr("transform", d3.event.transform);
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

        d3.select("#edge-" + edge.index).remove();

        const index = edges.indexOf(edge);
        edges.splice(index, 1);

        // d3.select()
      } else {
        // add edge

        // console.log(JSON.stringify(edges[0], null, 4));

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

  const ctx = canvas.node().getContext('2d');
  const ctx_hidden = canvas_hidden.node().getContext('2d');

  // This is the virtual DOM. We create objects inside it with d3
  // as normal, then render those objects to the canvas.
  const v_dom_base = document.createElement("v_dom");
  const v_dom = d3.select(v_dom_base);
  
  const v_dom_edges = v_dom.append("g")
    .attr("class", "edges")
    .selectAll("line")
    .data(edges).enter()
    .append("line")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6);
  const v_dom_nodes = v_dom.append("g")
    .attr("class", "nodes")
    .selectAll("circle")
    .data(nodes).enter()
    .append("circle")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("r", 5)
    .attr("class", node => "group-" + node.group)
    .attr("fill", node => color(node.group))
    .attr("fill-hidden", node => {
      if (!node.hidden_colour) {
        let c = uniqueColour();
        node.hidden_colour = c;
        colour_to_node[c] = node;
      }

      return node.hidden_colour;      
    })
    .on("click", clickNode)
    .on("mouseover", startHover);
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
  const svg_select_text = svg.append("text")
    .text("")
    .attr("x", "50%")
    .attr("y", "1em")
    .attr("text-anchor", "middle")
    .attr("dy", "1em")
    .attr("font-size", "2em")
    .attr("stroke", "white")
    .attr("stroke-width", "7")
    .attr("fill", "black")
    .attr("paint-order", "stroke");

  // compute the node_edge map so that we can add/remove edges
  // efficiently.
  const node_edge_map = new Map();
  v_dom_edges.each(e => {
    edgeD = d3.select(this);
    
    node_edge_map.set(e.source + " " + e.target, e);
    node_edge_map.set(e.target + " " + e.source, e);
  });

  v_dom_nodes.append("title").text(node => node.title);
  v_dom_nodes.call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended));
  svg.call(d3.zoom().on("zoom", pan))

  function drawToCanvas(canvas, ctx, hidden) {
    let pixel_ratio = window.devicePixelRatio;

    canvas.attr("width", width * pixel_ratio);
    canvas.attr("height", height * pixel_ratio);
    ctx.setTransform(pixel_ratio, 0, 0, pixel_ratio, 0, 0);
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // don't draw edges to hidden since can't interact with them
    if (!hidden) {    
      // Draw each edge
      v_dom_edges.each((edge_data, i, v_edges) => {
        let edge = d3.select(v_edges[i]);
      
        ctx.strokeStyle = edge.attr("stroke");
        ctx.lineWidth = edge.attr("stroke-width");

        ctx.beginPath();
        ctx.moveTo(edge_data.source.x, edge_data.source.y);
        ctx.lineTo(edge_data.target.x, edge_data.target.y);
        ctx.stroke();
      });
    }

    v_dom_nodes.each((node_data, i, v_nodes) => {
      let node = d3.select(v_nodes[i]);

      ctx.strokeStyle = hidden ? node.attr("fill-hidden") : node.attr("stroke");
      ctx.lineWidth = node.attr("stroke-width");
      ctx.fillStyle = hidden ? node.attr("fill-hidden") : node.attr("fill");

      ctx.beginPath();
      ctx.arc(node_data.x, node_data.y, node.attr("r"), 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.stroke();
    });
  }

  function ticked() {
    width = +canvas.node().getBoundingClientRect().width;
    height = +canvas.node().getBoundingClientRect().height;

    // draw to canvas for visuals, and to canvas_hidden to make interaction
    // with individual nodes using unique colours work.
    drawToCanvas(canvas, ctx, false);
    drawToCanvas(canvas_hidden, ctx_hidden, true);
    
    for (group of svg_group_text.data()) {
      let sum_x = 0;
      let sum_y = 0;
      let group_nodes = v_dom_nodes.filter((d, i) => d.group == group.index).data();
      let n = group_nodes.length;
      for (circ of group_nodes) {
        sum_x += circ.x;
        sum_y += circ.y;
      }

      d3.selectAll("#group-title-" + group.index)
        .attr("x", sum_x / n)
        .attr("y", sum_y / n)
    }
  }

  const simulation = d3.forceSimulation(nodes)
    .velocityDecay(dampeningDefault) 
    .force("connection", d3.forceLink(edges).id(node => node.id).distance(edge => 1 + 10/edge.weight).strength(edge => 1.2/edge.weight))
    .force("repel", d3.forceManyBody().strength(-20))
    .force("centerX", d3.forceX(width / 2).strength(0.05))
    .force("centerY", d3.forceY(height / 2).strength(0.05))
    .force("spiral", spiralForce(width/2, height/2, spiralForceDefault))
    .on("tick", ticked);

  
  input_sliders.forEach((slider, i) => updateSlider(slider, slider.default));
})

