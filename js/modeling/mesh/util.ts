export function sameMeshEdge(edge_a, edge_b) {
	return edge_a.equals(edge_b) || (edge_a[0] == edge_b[1] && edge_a[1] == edge_b[0])
}