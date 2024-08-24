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

const visibility_elements = document.getElementsByClassName("toggle-visible");
for (const element of visibility_elements) {
  console.log(element);
  element.onclick = function (event) {
    console.log("hi");
    if (element.classList.contains("hidden")) {
      element.classList.remove("hidden");
    } else {
      element.classList.add("hidden");
    }
    event.stopPropagation();
  }
}

d3.json("data/mindmap.json", function(e, graph) {
  if (e) throw e;

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
      default: 1.2,
      onUpdate: f => {
        edge_force.strength(edge => f/edge.weight);

        simulation.alphaTarget(0.3).restart();
      }
    },
    {
      id: "distance-connection",
      label: "Connection Distance",
      min: 0.5,
      max: 40,
      default: 10,
      onUpdate: d => {
        edge_force.distance(edge => 1 + d/edge.weight);

        simulation.alphaTarget(0.3).restart();
      }
    },
    {
      id: "force-spiral",
      label: "Spiral Force",
      min: -0.01,
      max: 0.01,
      default: 0.001,
      onUpdate: f => simulation
        .force("spiral", spiralForce(width/2, height/2, f))
        .alphaTarget(0.3).restart()
    },
    {
      id: "dampening",
      label: "Dampening",
      min: 0.01,
      max: 1,
      default: 0.1,
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

  const canvas = d3.select("#canvas-main").attr("draggable", false);
  const canvas_hidden = d3.select("#canvas-hidden").attr("draggable", false);
  const svg = d3.select("svg").attr("draggable", false);
  const nodes = graph.nodes;
  const edges = graph.edges;
  const groups = graph.groups;
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  let width = +canvas.node().getBoundingClientRect().width;
  let height = +canvas.node().getBoundingClientRect().height;

  let next_col = 1; // used to assign each node a unique colour for selection.
  let colour_to_node = {}; // map each unique colour to the associated node.
  
  let scale = 1;
  let offset_x = 0;
  let offset_y = 0;

  let hold_focus = false;
  let focus = null;
  let selected = null;
  let dragged = null;

  function nodeFromEvent(event) {
    let pixel_ratio = window.devicePixelRatio;
    let mouse_x = (event.offsetX || event.x) * pixel_ratio;
    let mouse_y = (event.offsetY || event.y) * pixel_ratio;

    let col = ctx_hidden.getImageData(mouse_x, mouse_y, 1, 1).data;
    let col_key = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
    return colour_to_node[col_key];
  }

  // Based upon https://observablehq.com/@d3/force-directed-graph/2?intent=fork
  svg.call(d3.drag()
    .on("start", () => {
      let node_data = nodeFromEvent(d3.event);
      if (!node_data)
        return;
      dragged = v_dom_nodes.filter(d => d.id == node_data.id);
      
      node_data.fx = node_data.x;
      node_data.fy = node_data.y;
      setFocus(node_data, true);
    })
    .on("drag", () => {
      if (!dragged)
        return;
      
      let node_data = dragged.datum();

      node_data.fx = (event.x - offset_x) / scale;
      node_data.fy = (event.y - offset_y) / scale;
    })
    .on("end", () => {
      if (!dragged)
        return;
      
      let dragged_data = dragged.datum();
      dragged_data.fx = null;
      dragged_data.fy = null;
      hold_focus = false;
      setFocus(dragged_data, false);

      dragged = null;
    }));

  svg.on("mousemove", () => {
    let node_data = nodeFromEvent(d3.event);
    if (!node_data)
      return;

    setFocus(node_data, false);
  });

  svg.on("click", () => {
    node_data = nodeFromEvent(d3.event);
    if (!node_data)
      return;

    let clicked = v_dom_nodes.filter(d => d.id == node_data.id);
    
    clickNode(clicked);
  });

  svg.call(
    d3.zoom().on("zoom", () => {
      let event = d3.event.sourceEvent;

      if (!event)
        return;

      if (event.movementX) {
        offset_x += event.movementX;
        offset_y += event.movementY;
      }

      if (event.wheelDelta) {
        let scale_old = scale;
        scale *= 1 + event.wheelDelta / 180.0 / 8.0;
        offset_x += (event.clientX - offset_x) * (scale_old - scale) / scale_old;
        offset_y += (event.clientY - offset_y) * (scale_old - scale) / scale_old;
      }
    }).filter(() => event.button == 1 || event.type === "wheel")
  );

  function setFocus(node, hold) {
    if (hold_focus) {
      return;
    }

    if (focus) focus.attr("r", get_slider_prop("radius"));
    if (focus == node) {
      focus = null;
      hold_focus = false;
    } else {
      focus = v_dom_nodes.filter(d => d.id == node.id);
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

  function clickNode(node) {
    if (selected) {
      other = d3.select(node);
      if (other == selected) {
        selected.attr("stroke", "$fff");
        selected = null;
        return;
      }

      let selected_id = selected.datum().id;
      let other_id = node.datum().id;
      let edge = node_edge_map.get(selected_id + " " + other_id);
      if (edge) {
        // remove edge

        node_edge_map.delete(selected_id + " " + other_id);
        node_edge_map.delete(other_id + " " + selected_id);

        v_dom_edges.filter("#edge-" + edge.index).remove();

        const index = edges.indexOf(edge);
        edges.splice(index, 1);

        updateVDomData(nodes, edges);
        updateSimulationData(nodes, edges);

        // d3.select()
      } else {
        // add edge

        let edge = {
          label: "0.5",
          source: selected_id,
          target: other_id,
          weight: 5.0
        };

        edges.push(edge);

        node_edge_map.set(selected_id + " " + other_id, edge);
        node_edge_map.set(other_id + " " + selected_id, edge);

        updateVDomData(nodes, edges);
        updateSimulationData(nodes, edges);
      }

      selected.attr("stroke", "$fff");
      selected = null;
    } else {
      selected = node;
      selected.attr("stroke", "#000")
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
  
  let v_dom_edges;
  let v_dom_nodes;

  function updateVDomData(nodes, edges) {
    v_dom_edges = v_dom.append("g")
      .attr("class", "edges")
      .selectAll("line")
      .data(edges).enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6);
    v_dom_nodes = v_dom.append("g")
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
      });
  }

  updateVDomData(nodes, edges);

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

  function drawToCanvas(canvas, ctx, hidden) {
    let pixel_ratio = window.devicePixelRatio;

    canvas.attr("width", width * pixel_ratio);
    canvas.attr("height", height * pixel_ratio);
    ctx.setTransform(
      pixel_ratio * scale,
      0, 0,
      pixel_ratio * scale,
      pixel_ratio * offset_x,
      pixel_ratio * offset_y
    );

    let min_x = -offset_x / scale;
    let max_x = -offset_x / scale + width / scale;
    let min_y = -offset_y / scale;
    let max_y = -offset_y / scale + height / scale;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // don't draw edges to hidden since can't interact with them
    if (!hidden) {    
      // Draw each edge
      v_dom_edges.each((edge_data, i, v_edges) => {
        let edge = d3.select(v_edges[i]);

        let sx = edge_data.source.x;
        let sy = edge_data.source.y;
        let tx = edge_data.target.x;
        let ty = edge_data.target.y;

        if (sx < min_x && tx < min_x || sx > max_x && tx > max_x ||
            sy < min_y && ty < min_y || sy > max_y && ty > max_y)
          return;
      
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

      let r = node.attr("r");
      let sw = node.attr("stroke-width");
      let fr = r;

      let nx = node_data.x;
      let ny = node_data.y;

      // if (nx > min_x && nx < min_x + 20)
      //   console.log(nx + " " + fr + " " + min_x);

      if (nx + 2*fr < min_x || nx - 2*fr > max_x ||
          ny + 2*fr < min_y || ny - 2*fr > max_y)
        return;

      ctx.strokeStyle = hidden ? node.attr("fill-hidden") : node.attr("stroke");
      ctx.lineWidth = sw;
      ctx.fillStyle = hidden ? node.attr("fill-hidden") : node.attr("fill");

      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, 2 * Math.PI, false);
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
        .attr("x", scale * sum_x / n + offset_x)
        .attr("y", scale * sum_y / n + offset_y);
    }
  }

  const edge_force = d3.forceLink(edges)
    .id(node => node.id)
    .distance(edge => 1 + 10/edge.weight)
    .strength(edge => 1.2/edge.weight);

  // other forces created by sliders
  const simulation = d3.forceSimulation(nodes)
    .force("connection", edge_force)
    .on("tick", ticked);

  function updateSimulationData(nodes, edges) {
    simulation.nodes(nodes);
    edge_force.links(edges);
  }
  
  input_sliders.forEach((slider, i) => updateSlider(slider, slider.default));
})

