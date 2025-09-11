export const ProportionalEdit = {
	vertex_weights: {},
	config: {
		enabled: true,
		range: 1,
		falloff: '',
		selection: '',
	},
	calculateWeights(mesh: Mesh) {
		if (!pe_toggle.value) return;

		let selected_vertices = mesh.getSelectedVertices();
		let { range, falloff, selection } = ProportionalEdit.config;
		let linear_distance = selection == 'linear';

		let all_mesh_connections;
		if (!linear_distance) {
			all_mesh_connections = {};
			for (let fkey in mesh.faces) {
				let face = mesh.faces[fkey];
				face.getEdges().forEach(edge => {
					if (!all_mesh_connections[edge[0]]) {
						all_mesh_connections[edge[0]] = [edge[1]];
					} else {
						all_mesh_connections[edge[0]].safePush(edge[1]);
					}
					if (!all_mesh_connections[edge[1]]) {
						all_mesh_connections[edge[1]] = [edge[0]];
					} else {
						all_mesh_connections[edge[1]].safePush(edge[0]);
					}
				});
			}
		}

		ProportionalEdit.vertex_weights[mesh.uuid] = {};

		for (let vkey in mesh.vertices) {
			if (selected_vertices.includes(vkey)) continue;

			let distance = Infinity;
			if (linear_distance) {
				// Linear Distance
				selected_vertices.forEach(vkey2 => {
					let pos1 = mesh.vertices[vkey];
					let pos2 = mesh.vertices[vkey2];
					let distance_square =
						Math.pow(pos1[0] - pos2[0], 2) +
						Math.pow(pos1[1] - pos2[1], 2) +
						Math.pow(pos1[2] - pos2[2], 2);
					if (distance_square < distance) {
						distance = distance_square;
					}
				});
				distance = Math.sqrt(distance);
			} else {
				// Connection Distance
				let found_match_depth = 0;
				let scanned = [];
				let frontier = [vkey];

				depth_crawler: for (let depth = 1; depth <= range; depth++) {
					let new_frontier = [];
					for (let vkey1 of frontier) {
						let connections = all_mesh_connections[vkey1]?.filter(
							vkey2 => !scanned.includes(vkey2)
						);
						if (!connections || connections.length == 0) continue;
						scanned.push(...connections);
						new_frontier.push(...connections);
					}
					for (let vkey2 of new_frontier) {
						if (selected_vertices.includes(vkey2)) {
							found_match_depth = depth;
							break depth_crawler;
						}
					}
					frontier = new_frontier;
				}
				if (found_match_depth) {
					distance = found_match_depth;
				}
			}
			if (distance > range) continue;

			let blend = 1 - distance / (linear_distance ? range : range + 1);
			switch (falloff) {
				case 'hermite_spline':
					blend = Math.hermiteBlend(blend);
					break;
				case 'constant':
					blend = 1;
					break;
			}
			ProportionalEdit.vertex_weights[mesh.uuid][vkey] = blend;
		}
	},
	editVertices(mesh, per_vertex) {
		if (!pe_toggle.value) return;

		let selected_vertices = mesh.getSelectedVertices();
		for (let vkey in mesh.vertices) {
			if (selected_vertices.includes(vkey)) continue;

			let blend = ProportionalEdit.vertex_weights[mesh.uuid][vkey];
			per_vertex(vkey, blend);
		}
	},
};

const pe_toggle = new Toggle('proportional_editing', {
	icon: 'wifi_tethering',
	category: 'edit',
	condition: { modes: ['edit'], features: ['meshes'] },
	tool_config: new ToolConfig('proportional_editing_options', {
		title: 'action.proportional_editing',
		width: 400,
		form: {
			enabled: { type: 'checkbox', label: 'menu.mirror_painting.enabled', value: false },
			range: { type: 'number', label: 'dialog.proportional_editing.range', value: 8 },
			falloff: {
				type: 'select',
				label: 'dialog.proportional_editing.falloff',
				value: 'linear',
				options: {
					linear: 'dialog.proportional_editing.falloff.linear',
					hermite_spline: 'dialog.proportional_editing.falloff.hermite_spline',
					constant: 'dialog.proportional_editing.falloff.constant',
				},
			},
			selection: {
				type: 'select',
				label: 'dialog.proportional_editing.selection',
				value: 'linear',
				options: {
					linear: 'dialog.proportional_editing.selection.linear',
					connections: 'dialog.proportional_editing.selection.connections',
					//path: 'Connection Path',
				},
			},
		},
		onOpen() {
			this.setFormValues({ enabled: pe_toggle.value });
		},
		onFormChange(formResult) {
			if (pe_toggle.value != formResult.enabled) {
				pe_toggle.trigger();
			}
			(BarItems.proportional_editing_range as NumSlider).update();
		},
	}),
});
// @ts-ignore
ProportionalEdit.config = (pe_toggle.tool_config as ToolConfig).options;

new NumSlider('proportional_editing_range', {
	category: 'edit',
	condition: { modes: ['edit'], features: ['meshes'] },
	get() {
		return ProportionalEdit.config.range;
	},
	change(modify) {
		ProportionalEdit.config.range = modify(ProportionalEdit.config.range);
	},
	onAfter() {
		pe_toggle.tool_config.save();
	},
});
