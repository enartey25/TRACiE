/* Diagram types with no bespoke HTML design. They render from Mermaid text.
 * payload: { diagram_source: string, caption?: string }
 * (The core also routes ANY diagram type with diagram_source to Mermaid.)          */
(function () {
  const LABELS = {
    sequence_diagram:  'Sequence diagram',
    state_diagram:     'State diagram',
    mindmap:           'Mind map',
    dependency_graph:  'Dependency graph',
    data_flow:         'Data flow',
    component_diagram: 'Component diagram',
    system_diagram:    'System diagram',
  };
  Object.keys(LABELS).forEach((type) => UIRenderer.register(type, {
    category: 'Diagrams and Architecture',
    label: LABELS[type],
    render(p, { notice }) {
      // Only reached when diagram_source is missing, because the core routes Mermaid text first
      return notice('warning', `${type} needs payload.diagram_source (Mermaid text).`);
    },
  }));
})();
