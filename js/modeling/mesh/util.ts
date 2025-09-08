export function sameMeshEdge(edge_a: MeshEdge, edge_b: MeshEdge): boolean {
	return edge_a.equals(edge_b) || (edge_a[0] == edge_b[1] && edge_a[1] == edge_b[0])
}
