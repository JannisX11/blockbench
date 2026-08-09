import { Dialog } from "../../interface/dialog";
import { THREE } from "../../lib/libs";

BARS.defineActions(() => {

	let import_obj_dialog: Dialog | undefined;

	new Action('import_obj', {
		icon: 'fa-gem',
		category: 'file',
		condition: {modes: ['edit'], method: () => (Format.meshes)},
		click: function () {
			function importOBJ(result) {
				let mtl_materials = {};
				if (result.mtl) {
					let mtl_lines = result.mtl.content.split(/[\r\n]+/);
					let current_material;
					for (let line of mtl_lines) {
						let args = line.split(/\s+/).filter(arg => typeof arg !== 'undefined' && arg !== '');
						let cmd = args.shift();
						switch (cmd) {
							case 'newmtl': {
								current_material = mtl_materials[args[0]] = {};
								break;
							}
							case 'map_Kd': {
								let texture_name = args[0];
								let texture_path = isApp ? PathModule.join(result.mtl.path, '..', texture_name) : '';
								let texture = new Texture().fromPath(texture_path).add();
								current_material.texture = texture;
							}
						}
					}
				}
				
				let {content} = result.obj;
				let lines = content.split(/[\r\n]+/);

				function toVector(args: (number|string)[], length?: number): ArrayVector3 {
					return args.map(v => parseFloat(v as string)) as ArrayVector3;
				}

				let mesh: Mesh | undefined;
				let vertices: ArrayVector3[] = [];
				let vertex_keys = {};
				let vertex_textures = [];
				let vertex_normals = [];
				let meshes: Mesh[] = [];
				let vector1 = new THREE.Vector3();
				let vector2 = new THREE.Vector3();
				let current_texture;

				Undo.initEdit({outliner: true, elements: meshes, selection: true});

				lines.forEach(line => {

					if (line.substr(0, 1) == '#' || !line) return;

					let args = line.split(/\s+/).filter(arg => typeof arg !== 'undefined' && arg !== '');
					let cmd = args.shift();

					if (['o', 'g'].includes(cmd) || (cmd == 'v' && !mesh)) {
						mesh = new Mesh({
							name: ['o', 'g'].includes(cmd) ? args[0] : 'unknown',
							vertices: {}
						})
						vertex_keys = {};
						meshes.push(mesh);
					}
					if (cmd == 'v') {
						vertices.push(toVector(args, 3).map(v => v * result.scale) as ArrayVector3);
					}
					if (cmd == 'vt') {
						vertex_textures.push(toVector(args, 2))
					}
					if (cmd == 'vn') {
						vertex_normals.push(toVector(args, 3))
					}
					if (cmd == 'f') {
						let f = {
							vertices: [],
							vertex_textures: [],
							vertex_normals: [],
						}
						args.forEach((triplet, i) => {
							if (i >= 4) return;
							let [v, vt, vn] = triplet.split('/').map(v => parseInt(v));
							if (!vertex_keys[ v-1 ]) {
								vertex_keys[ v-1 ] = mesh.addVertices(vertices[v-1])[0];
							}
							f.vertices.push(vertex_keys[ v-1 ]);
							f.vertex_textures.push(vertex_textures[ vt-1 ]);
							f.vertex_normals.push(vertex_normals[ vn-1 ]);
						})
						
						let uv = {};
						f.vertex_textures.forEach((vt, i) => {
							let key = f.vertices[i];
							if (vt instanceof Array) {
								uv[key] = [
									vt[0] * Project.texture_width,
									(1-vt[1]) * Project.texture_width
								];
							} else {
								uv[key] = [0, 0];
							}
						})
						let face = new MeshFace(mesh, {
							vertices: f.vertices,
							uv,
							texture: current_texture
						})
						mesh.addFaces(face);

						if (f.vertex_normals.find(v => v)) {
	
							vector1.fromArray(face.getNormal());
							vector2.fromArray(f.vertex_normals[0]);
							let angle = vector1.angleTo(vector2);
							if (angle > Math.PI/2) {
								face.invert();
							}
						}
					}
					if (cmd == 'usemtl') {
						current_texture = mtl_materials[args[0]]?.texture;
					}
				})
				meshes.forEach(mesh => {
					mesh.init();
				})

				Undo.finishEdit('Import OBJ');
			}
			if (!import_obj_dialog) {
				import_obj_dialog = new Dialog('import_obj', {
					title: 'action.import_obj',
					form: {
						obj: {type: 'file', label: 'dialog.import_obj.obj', return_as: 'file', extensions: ['obj'], resource_id: 'obj', filetype: 'OBJ Wavefront Model'},
						mtl: {type: 'file', label: 'dialog.import_obj.mtl', return_as: 'file', extensions: ['mtl'], resource_id: 'obj', filetype: 'OBJ Material File'},
						scale: {type: 'number', label: 'dialog.import_obj.scale', value: 16},
					},
					onConfirm(result) {
						importOBJ(result);
					}
				})
			}
			import_obj_dialog.show();
		}
	})
})
