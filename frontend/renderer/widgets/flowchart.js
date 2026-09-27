/* flowchart / architecture_diagram widget
 * Renders payload.nodes + payload.edges as a horizontal node-row.
 * Falls back to drawMermaid when any node has 2+ outgoing edges (branching).
 * payload: { nodes: [{ id, label, sub?, emphasis?, tone? }], edges: [{ from, to, label? }] }
 */
(function () {
  'use strict';

  function buildMermaidSource(nodes, edges) {
    const lines = ['flowchart LR'];
    nodes.forEach(function (n) {
      lines.push('  ' + n.id + '[' + n.label + ']');
    });
    edges.forEach(function (e) {
      if (e.label) {
        lines.push('  ' + e.from + ' -->|' + e.label + '| ' + e.to);
      } else {
        lines.push('  ' + e.from + ' --> ' + e.to);
      }
    });
    return lines.join('\n');
  }

  function render(p, ctx) {
    var h = ctx.h;
    var notice = ctx.notice;
    var drawMermaid = ctx.drawMermaid;

    /* ── Missing payload guard ── */
    var nodes = Array.isArray(p.nodes) ? p.nodes : [];
    var edges = Array.isArray(p.edges) ? p.edges : [];

    if (!nodes.length || !edges.length) {
      return notice('info', 'Flowchart payload is missing nodes or edges.');
    }

    /* ── Branch detection: count outgoing edges per node ── */
    var outCount = {};
    edges.forEach(function (e) {
      outCount[e.from] = (outCount[e.from] || 0) + 1;
    });
    var hasBranch = Object.keys(outCount).some(function (k) { return outCount[k] >= 2; });

    if (hasBranch) {
      /* drawMermaid(host, source) — pass a container element */
      var host = h('div', { class: 'uir-diagram', role: 'img', 'aria-label': 'flowchart' });
      drawMermaid(host, buildMermaidSource(nodes, edges));
      return host;
    }

    /* ── Build ordered node sequence by walking edges ── */
    /* Start from the node that is never a "to" target */
    var toSet = new Set(edges.map(function (e) { return e.to; }));
    var nodeMap = {};
    nodes.forEach(function (n) { nodeMap[n.id] = n; });

    /* Find root (not a target of any edge); fall back to first node */
    var rootId = null;
    nodes.forEach(function (n) { if (!toSet.has(n.id) && rootId === null) { rootId = n.id; } });
    if (rootId === null) { rootId = nodes[0].id; }

    /* Walk the linear chain */
    var edgeMap = {};
    edges.forEach(function (e) { edgeMap[e.from] = e; });

    var orderedNodes = [];
    var orderedEdges = [];
    var current = rootId;
    var visited = new Set();
    while (current && !visited.has(current)) {
      visited.add(current);
      if (nodeMap[current]) { orderedNodes.push(nodeMap[current]); }
      var edge = edgeMap[current];
      if (edge) {
        orderedEdges.push(edge);
        current = edge.to;
      } else {
        current = null;
      }
    }

    /* Append any nodes not reached by the walk (isolated nodes) */
    nodes.forEach(function (n) {
      if (!visited.has(n.id)) { orderedNodes.push(n); }
    });

    /* ── DOM assembly ──
     * Structure:
     *   <div.uir-flowchart>
     *     <div.uir-flowchart__node>   ← first node, no preceding edge
     *     <div.uir-flowchart__step>   ← unbreakable unit: connector + node
     *       <div.uir-flowchart__connector>
     *       <div.uir-flowchart__node>
     *     </div>
     *     …
     *   </div>
     * The step wrapper has white-space:nowrap so the row never breaks
     * between an arrow and the node it points to.
     */
    var children = [];

    orderedNodes.forEach(function (node, idx) {
      /* Build the node box element */
      var classes = ['uir-flowchart__node'];
      if (node.emphasis) { classes.push('uir-flowchart__node--emphasis'); }
      else if (node.tone === 'sand') { classes.push('uir-flowchart__node--sand'); }

      var labelEl = h('span', { class: 'uir-flowchart__node-label' }, node.label);
      var boxChildren = [labelEl];
      if (node.sub) {
        boxChildren.push(h('span', { class: 'uir-flowchart__node-sub' }, node.sub));
      }
      var nodeEl = h('div', { class: classes.join(' ') }, ...boxChildren);

      if (idx === 0) {
        /* First node: no preceding edge, sits directly in the flex container */
        children.push(nodeEl);
      } else {
        /* Find the edge that leads INTO this node (previous node → this node) */
        var inEdge = edges.find(function (e) { return e.to === node.id; });
        /* Arrow first in DOM; CSS uses order/flex-direction to position label
           above arrow (horizontal) or arrow before label (vertical). */
        var connParts = [h('span', { class: 'uir-flowchart__arrow' }, '→')];
        if (inEdge && inEdge.label) {
          connParts.push(h('span', { class: 'uir-flowchart__edge-label' }, inEdge.label));
        }
        var connector = h('div', { class: 'uir-flowchart__connector' }, ...connParts);

        /* Wrap connector + node together so they never break apart */
        children.push(h('div', { class: 'uir-flowchart__step' }, connector, nodeEl));
      }
    });

    return h('div', { class: 'uir-flowchart' }, ...children);
  }

  var def = {
    category: 'Diagrams and Architecture',
    label: 'Flowchart',
    render: render,
  };

  UIRenderer.register('flowchart', def);
  UIRenderer.register('architecture_diagram', def);
})();
