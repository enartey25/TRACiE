/* Diagram types with no bespoke HTML design. They render from Mermaid text.
 * payload: { diagram_source: string, caption?: string }
 * (The core also routes ANY diagram type with diagram_source to Mermaid.)          */
(function () {
  const TYPES = ['sequence_diagram', 'state_diagram', 'mindmap', 'dependency_graph', 'data_flow', 'component_diagram', 'system_diagram'];
  TYPES.forEach((type) => UIRenderer.register(type, {
    category: 'Diagrams and Architecture',
    render(p, { notice }) {
      // Only reached when diagram_source is missing, because the core routes Mermaid text first
      return notice('warning', `${type} needs payload.diagram_source (Mermaid text).`);
    },
  }));
})();
