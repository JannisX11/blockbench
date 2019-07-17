
//Display
function getRescalingFactor(angle) {
	switch (Math.abs(angle)) {
		case 0:
			return 1.4142
			break;
		case 22.5:
			return 1.127
			break;
		case 67.5:
			return 1.127
			break;
		case 45:
			return 1.4142
			break;
		default:
			return 1;
			break;
	}
}
function getUVArray(side, frame, stretch) {
	if (stretch === undefined) {
		stretch = -1
	} else {
		stretch = stretch*(-1)
	}
	var arr = [
		new THREE.Vector2(side.uv[0]/16, (side.uv[1]/16)/stretch+1),  //0,1
		new THREE.Vector2(side.uv[0]/16, (side.uv[3]/16)/stretch+1),  //0,0
		new THREE.Vector2(side.uv[2]/16, (side.uv[3]/16)/stretch+1),   //1,0
		new THREE.Vector2(side.uv[2]/16, (side.uv[1]/16)/stretch+1)  //1,1
	]
	if (frame > 0 && stretch !== -1) {
		//Animate
		var offset = (1/stretch) * frame
		arr[0].y += offset
		arr[1].y += offset
		arr[2].y += offset
		arr[3].y += offset
	}
	var rot = (side.rotation+0)
	while (rot > 0) {
		arr.push(arr.shift())
		rot = rot-90;
	}
	return arr;
}
const Canvas = {
	materials: {},
	meshes: {},
	bones: {},
	outlineMaterial: new THREE.LineBasicMaterial({
		linewidth: 2,
		transparent: true
	}),
	wireframeMaterial: new THREE.MeshBasicMaterial({
		color: 0x00FF00,
		wireframe: true
	}),
	transparentMaterial: new THREE.MeshBasicMaterial({visible:false}),
	face_order: ['east', 'west', 'up', 'down', 'south', 'north'],
	//Misc
	raycast(event) {
		var preview = Canvas.getCurrentPreview()
		if (preview) {
			return preview.raycast(event)
		} else {
			return false
		}
	},
	getCurrentPreview() {
		var canvas = $('canvas.preview:hover').get(0)
		if (canvas) return canvas.preview
	},
	//Main updaters
	clear() {
		var objects = []
		scene.traverse(function(s) {
			if (s.isElement === true || s.isGroup === true) {
				objects.push(s)
			}
		})
		objects.forEach(function(s) {
			if (s.parent) {
				s.parent.remove(s)
			}
			if (s.geometry) s.geometry.dispose()
			if (s.outline && s.outline.geometry) s.outline.geometry.dispose()
			delete Canvas.meshes[s.name]
		})
	},
	updateAll() {
		updateNslideValues()
		Canvas.clear()
		Canvas.updateAllBones()
		Cube.all.forEach(function(s) {
			if (s.visibility == true) {
				Canvas.addCube(s)
			}
		})
		updateSelection()
	},
	updateAllPositions(leave_selection) {
		updateNslideValues()
		Cube.all.forEach(Canvas.adaptObjectPosition)
		if (leave_selection !== true) {
			updateSelection()
		}
	},
	updateVisibility() {
		Cube.all.forEach(function(s) {
			var mesh = s.mesh
			if (s.visibility == true) {
				if (!mesh) {
					Canvas.addCube(s)
				} else if (!scene.children.includes(mesh)) {
					scene.add(mesh)
					Canvas.adaptObjectPosition(s, mesh)
					Canvas.adaptObjectFaces(s, mesh)
					if (!Prop.wireframe) {
						Canvas.updateUV(s)
					}
				}
			} else if (mesh && mesh.parent) {
				mesh.parent.remove(mesh)
			}
		})
		updateSelection()
	},
	updateAllFaces(texture) {
		Cube.all.forEach(function(obj) {
			if (obj.visibility == true) {
				var used = true;
				if (texture) {
				 	used = false;
					for (var face in obj.faces) {
						if (obj.faces[face].texture === texture.uuid) {
				 			used = true;
						}
					}
				}
				if (used === true) {
					Canvas.adaptObjectFaces(obj)
					if (!Prop.wireframe) {
						Canvas.updateUV(obj)
					}
				}
			}
		})
	},
	updateAllUVs() {
		if (Prop.wireframe === true) return;
		Cube.all.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.updateUV(obj)
			}
		})
	},
	updateRenderSides() {
		var side = Format.id === 'java_block' ? 0 : 2;
		if (display_mode) {
			if (['thirdperson_righthand', 'thirdperson_lefthand', 'head'].includes(display_slot)) {
				side = 2;
			}
		}
		textures.forEach(function(t) {
			var mat = Canvas.materials[t.uuid]
			if (mat) {
				mat.side = side
			}
		})
		emptyMaterials.forEach(function(mat) {
			mat.side = side
		})
		return side;
	},
	//Selection updaters
	updateSelected(arr) {
		if (!arr) {
			arr = Cube.selected
		}
		arr.forEach(function(obj) {
			var mesh = obj.mesh
			if (mesh && mesh.parent) {
				mesh.parent.remove(mesh)
			}
			if (obj.visibility == true) {
				Canvas.addCube(obj)
			}
		})
		updateSelection()
	},
	updatePositions(leave_selection) {
		updateNslideValues()
		var arr = Cube.selected.slice()
		if (Format.bone_rig && Group.selected) {
			Group.selected.forEachChild(obj => {
				if (obj.type === 'cube') {
					arr.safePush(obj)
				}
			})
			if (arr.length === Cube.selected.length) {
				Canvas.updateAllBones()
			}
		}
		arr.forEach(function(obj) {
			Canvas.adaptObjectPosition(obj)
		})
		if (leave_selection !== true) {
			updateSelection()
		}
	},
	updateSelectedFaces() {
		Cube.selected.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.adaptObjectFaces(obj)
				if (!Prop.wireframe) {
					Canvas.updateUV(obj)
				}
			}
		})
	},
	updateUVs() {
		if (Prop.wireframe === true) return;
		Cube.selected.forEach(function(obj) {
			if (obj.visibility == true) {
				Canvas.updateUV(obj)
			}
		})
	},
	outlineObjects(arr) {
		arr.forEach(function(obj) {
			if (!obj.visibility) return;
			var mesh = obj.mesh
			if (mesh === undefined) return;

			var line = Canvas.getOutlineMesh(mesh)

			mesh.getWorldPosition(line.position)
			line.position.sub(scene.position)
			line.rotation.setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()))
			line.scale.copy(mesh.scale)

			line.name = obj.uuid+'_ghost_outline'
			outlines.add(line)
		})
	},
	updateAllBones() {

		Group.all.forEach((obj) => {
			let mesh = obj.mesh
			if (obj.visibility && mesh) {

				mesh.rotation.reorder('ZYX')
				obj.rotation.forEach(function(n, i) {
					mesh.rotation[getAxisLetter(i)] = Math.PI / (180 / n) * (i == 2 ? -1 : 1)
				})
				mesh.position.fromArray(obj.origin)
				mesh.scale.x = mesh.scale.y = mesh.scale.z = 1

				if (obj.parent.type === 'group') {

					mesh.position.x -=  obj.parent.origin[0]
					mesh.position.y -=  obj.parent.origin[1]
					mesh.position.z -=  obj.parent.origin[2]

					var parent_mesh = obj.parent.mesh
					parent_mesh.add(mesh)
				} else {
					scene.add(mesh)
				}
				mesh.updateMatrixWorld()

				mesh.fix_position = mesh.position.clone()
				mesh.fix_rotation = mesh.rotation.clone()
			}
		})
	},
	updateOrigin() {
		if (rot_origin.parent) {
			rot_origin.parent.remove(rot_origin)
		}
		if (settings.origin_size.value > 0) {
			if (Group.selected && Format.bone_rig) {
				if (Group.selected.visibility) {
					Group.selected.mesh.add(rot_origin)
				}
			} else if (Cube.selected.length && Format.rotate_cubes) {
				if (Cube.selected.length === 1 && Cube.selected.length == 1) {
					let mesh = Cube.selected[0].mesh
					if (mesh) {
						mesh.add(rot_origin)
					}
				} else {
					var origin = null;
					var first_visible = null;
					var i = 0;
					while (i < Cube.selected.length) {
						if (Cube.selected[i].visibility) {

							if (first_visible === null) {
								first_visible = Cube.selected[i]
							}
							if (origin === null) {
								origin = Cube.selected[i].origin
							} else if (!origin.equals(Cube.selected[i].origin)) {
								origin = false;
								i = Infinity;
							}
						}
						i++;
					}
					if (first_visible && typeof origin === 'object') {
						let mesh = first_visible.mesh
						if (mesh) {
							mesh.add(rot_origin)
						}
					}
				}
			}
		}
		return !!rot_origin.parent;
	},
	//Object handlers
	addCube(obj) {
		//This does NOT remove old cubes
		var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
		Canvas.adaptObjectFaces(obj, mesh)

		Canvas.adaptObjectPosition(obj, mesh)
		mesh.name = obj.uuid;
		mesh.type = 'cube';
		mesh.isElement = true;
		//scene.add(mesh)
		Canvas.meshes[obj.uuid] = mesh
		if (Prop.wireframe === false) {
			Canvas.updateUV(obj)
		}
		Canvas.buildOutline(obj)
	},
	adaptObjectPosition(cube, mesh, parent) {
		if (!cube.visibility) return;
		
		if (!mesh || mesh > 0) mesh = cube.mesh

		var from = cube.from.slice()
		from.forEach((v, i) => {
			from[i] -= cube.inflate
		})
		var to = cube.to.slice()
		to.forEach((v, i) => {
			to[i] += cube.inflate
			if (from[i] === to[i]) {
				to[i] += 0.001
			}
		})
		mesh.geometry.from(from)
		mesh.geometry.to(to)
		mesh.geometry.computeBoundingSphere()

		mesh.scale.set(1, 1, 1)
		mesh.rotation.set(0, 0, 0)
		mesh.position.set(0, 0, 0)

		if (Format.rotate_cubes) {
			if (cube.rotation !== undefined) {

				mesh.rotation.reorder('ZYX')
				mesh.position.set(cube.origin[0], cube.origin[1], cube.origin[2])
				mesh.geometry.translate(-cube.origin[0], -cube.origin[1], -cube.origin[2])

				mesh.rotation.x = Math.PI / (180 /cube.rotation[0])
				mesh.rotation.y = Math.PI / (180 /cube.rotation[1])
				mesh.rotation.z = Math.PI / (180 /cube.rotation[2])

				if (cube.rescale === true) {
					var axis = cube.rotationAxis()||'y'

					var rescale = getRescalingFactor(cube.rotation[getAxisNumber(axis)]);
					mesh.scale.set(rescale, rescale, rescale)
					mesh.scale[axis] = 1
				}
			}
		}
		if (Format.bone_rig) {
			//mesh.rotation.reorder('YZX')
			if (cube.parent.type === 'group') {
				cube.parent.mesh.add(mesh)
				mesh.position.x -=  cube.parent.origin[0]
				mesh.position.y -=  cube.parent.origin[1]
				mesh.position.z -=  cube.parent.origin[2]
			} else {
				scene.add(mesh)
			}
		} else {
			scene.add(mesh)
		}
		if (Modes.paint) {
			Canvas.buildGridBox(cube)
		}
		Canvas.buildOutline(cube)
		mesh.updateMatrixWorld()
	},
	ascendElementPosition(el, elmesh) {
		function iterate(obj, mesh) {
			//Iterate inside (cube) > outside
			if (!mesh) {
				mesh = obj.mesh
			}
			if (obj.type === 'group') {
				mesh.rotation.reorder('ZYX')
				obj.rotation.forEach(function(n, i) {
					mesh.rotation[getAxisLetter(i)] = Math.PI / (180 / n) * (i == 2 ? -1 : 1)
				})
				mesh.updateMatrixWorld()
			}
			mesh.fix_rotation = mesh.rotation.clone()

			if (obj.type === 'group') {
				mesh.position.fromArray(obj.origin)
				mesh.scale.x = mesh.scale.y = mesh.scale.z = 1
			}

			if (typeof obj.parent === 'object') {

				mesh.position.x -=  obj.parent.origin[0]
				mesh.position.y -=  obj.parent.origin[1]
				mesh.position.z -=  obj.parent.origin[2]
			}
			mesh.fix_position = mesh.position.clone()

			if (typeof obj.parent === 'object') {
				var parent_mesh = iterate(obj.parent)
				parent_mesh.add(mesh)
			} else {
				scene.add(mesh)
			}
			return mesh
		}
		iterate(el, elmesh)
	},
	adaptObjectFaces(cube, mesh) {
		if (!mesh) mesh = cube.mesh
		if (!mesh) return;
		if (!Prop.wireframe) {
			var materials = []
			Canvas.face_order.forEach(function(face) {

				if (cube.faces[face].texture === null) {
					materials.push(Canvas.transparentMaterial)

				} else {
					var tex = cube.faces[face].getTexture()
					if (tex && tex.uuid) {
						materials.push(Canvas.materials[tex.uuid])
					} else {
						materials.push(emptyMaterials[cube.color])
					}
				}
			})
			mesh.material = materials
		} else {
			mesh.material = Canvas.wireframeMaterial
		}
	},
	updateUV(obj, animation) {
		if (Prop.wireframe === true) return;
		var mesh = obj.mesh
		if (mesh === undefined) return;
		mesh.geometry.faceVertexUvs[0] = [];

		if (Project.box_uv) {

			var size = obj.size(undefined, true)
			
			var face_list = [   
				{face: 'north', fIndex: 10,	from: [size[2], size[2]],			 	size: [size[0],  size[1]]},
				{face: 'east', fIndex: 0,	from: [0, size[2]],				   		size: [size[2],  size[1]]},
				{face: 'south', fIndex: 8,	from: [size[2]*2 + size[0], size[2]], 	size: [size[0],  size[1]]},
				{face: 'west', fIndex: 2,	from: [size[2] + size[0], size[2]],   	size: [size[2],  size[1]]},
				{face: 'up', fIndex: 4,		from: [size[2]+size[0], size[2]],	 	size: [-size[0], -size[2]]},
				{face: 'down', fIndex: 6,	from: [size[2]+size[0]*2, 0],		 	size: [-size[0], size[2]]}
			]
			var cube_mirror  = obj.shade === false

			if (cube_mirror) {
				face_list.forEach(function(f) {
					f.from[0] += f.size[0]
					f.size[0] *= -1
				})
				//East+West
				
				var p = {}

				p.from = face_list[1].from.slice()
				p.size = face_list[1].size.slice()

				face_list[1].from = face_list[3].from.slice()
				face_list[1].size = face_list[3].size.slice()

				face_list[3].from = p.from.slice()
				face_list[3].size = p.size.slice()

			}
			face_list.forEach(function(f) {

				f.from[0] /= Project.texture_width  / 16
				f.from[1] /= Project.texture_height / 16 
				f.size[0] /= Project.texture_width  / 16
				f.size[1] /= Project.texture_height / 16
				var uv= [
					f.from[0]			 +  obj.uv_offset[0] / Project.texture_width  * 16,
					f.from[1]			 +  obj.uv_offset[1] / Project.texture_height * 16,
					f.from[0] + f.size[0] + obj.uv_offset[0] / Project.texture_width  * 16,
					f.from[1] + f.size[1] + obj.uv_offset[1] / Project.texture_height * 16
				]
				uv.forEach(function(s, si) {
					uv[si] *= 1
				})

				obj.faces[f.face].uv[0] = uv[0]
				obj.faces[f.face].uv[1] = uv[1]
				obj.faces[f.face].uv[2] = uv[2]
				obj.faces[f.face].uv[3] = uv[3]

				//Fight Bleeding
				for (var si = 0; si < 2; si++) {
					let margin = 16/(si?Project.texture_height:Project.texture_width)/16;
					if (uv[si] > uv[si+2]) {
						margin = -margin
					}
					uv[si] += margin
					uv[si+2] -= margin
				}

				Canvas.updateUVFace(mesh.geometry.faceVertexUvs[0], f.fIndex, {uv: uv}, 0)
			})

		} else {
		
			var obj = obj.faces
			var stretch = 1
			var frame = 0
			for (var face in obj) {
				if (obj.hasOwnProperty(face)) {
					stretch = 1
					frame = 0
					if (obj[face].texture && obj[face].texture !== null) {
						var tex = obj[face].getTexture()
						if (tex instanceof Texture && tex.frameCount !== 1) {
							stretch = tex.frameCount
							if (animation === true && tex.currentFrame) {
								frame = tex.currentFrame
							}
						}
					}
					Canvas.updateUVFace(mesh.geometry.faceVertexUvs[0], Canvas.face_order.indexOf(face)*2, obj[face], frame, stretch)
				}
			}

		}
		mesh.geometry.elementsNeedUpdate = true;
		return mesh.geometry
	},
	updateUVFace(vertex_uvs, index, face, frame, stretch) {
		if (stretch === undefined) {
			stretch = -1
		} else {
			stretch = stretch*(-1)
		}
		if (!vertex_uvs[index]) vertex_uvs[index] = [];
		if (!vertex_uvs[index+1]) vertex_uvs[index+1] = [];
		var arr = [
			vertex_uvs[index][0],
			vertex_uvs[index][1],
			vertex_uvs[index+1][1],
			vertex_uvs[index+1][2],
		]
		for (var i = 0; i < 4; i++) {
			if (arr[i] === undefined) {
				arr[i] = new THREE.Vector2()
			}
		}
		
		arr[0].set(face.uv[0]/16, (face.uv[1]/16)/stretch+1),  //0,1
		arr[1].set(face.uv[0]/16, (face.uv[3]/16)/stretch+1),  //0,0
		arr[2].set(face.uv[2]/16, (face.uv[3]/16)/stretch+1),   //1,0
		arr[3].set(face.uv[2]/16, (face.uv[1]/16)/stretch+1)  //1,1

		if (frame > 0 && stretch !== -1) {
			//Animate
			var offset = (1/stretch) * frame
			arr[0].y += offset
			arr[1].y += offset
			arr[2].y += offset
			arr[3].y += offset
		}
		var rot = (face.rotation+0)
		while (rot > 0) {
			arr.push(arr.shift())
			rot = rot-90;
		}
		vertex_uvs[index] = [
			arr[0],
			arr[1],
			arr[3]
		];
		vertex_uvs[index+1] = [
			arr[1],
			arr[2],
			arr[3]
		];
	},
	//Outline
	getOutlineMesh(mesh) {
		var vs = mesh.geometry.vertices
		var geometry = new THREE.Geometry()
		geometry.vertices = [
			vs[2], vs[3],
			vs[6], vs[7],
			vs[2], vs[0],
			vs[1], vs[4],
			vs[5], vs[0],
			vs[5], vs[7],
			vs[6], vs[4],
			vs[1], vs[3]
		]
		return new THREE.Line(geometry, Canvas.outlineMaterial)
	},
	buildOutline(obj) {
		if (obj.visibility == false) return;
		var mesh = obj.mesh;
		if (mesh === undefined) return;

		if (mesh.outline) {
			mesh.outline.geometry.verticesNeedUpdate = true;
			return;
		}
		mesh.remove(mesh.outline);

		var line = Canvas.getOutlineMesh(mesh)
		line.name = obj.uuid+'_outline';
		line.visible = obj.selected;
		line.renderOrder = 2;
		line.frustumCulled = false;
		mesh.outline = line;
		mesh.add(line);
	},
	buildGridBox(cube) {
		var mesh = cube.mesh;
		if (mesh === undefined) return;
		mesh.remove(mesh.grid_box);
		if (cube.visibility == false) return;

		if (!Modes.paint || !settings.painting_grid.value) return;

		var from = cube.from.slice();
		var to = cube.to.slice();
		var size = cube.size(undefined, true);
		if (cube.inflate) {
			from[0] -= cube.inflate; from[1] -= cube.inflate; from[2] -= cube.inflate;
			  to[0] += cube.inflate;   to[1] += cube.inflate;   to[2] += cube.inflate;
		}
		if (true) {
			var tex = cube.faces.north.getTexture()
			var width = tex ? tex.res : 16
			var height = tex ? tex.res / tex.ratio : 16
			size = [
				Math.abs(width/16 * cube.faces.north.uv_size[cube.faces.north.rotation%180 ? 1 : 0]),
				Math.abs(height/16 * cube.faces.north.uv_size[cube.faces.north.rotation%180 ? 0 : 1]),
				Math.abs(width/16 * cube.faces.west.uv_size[cube.faces.west.rotation%180 ? 1 : 0])
			]
			size.forEach((s, i) => {
				if (s < 1) size[i] = 1
			})
		}

		var box = new THREE.GridBox(from, to, size);
		if (Format.rotate_cubes) {
			box.geometry.translate(-cube.origin[0], -cube.origin[1], -cube.origin[2]);
		}
		box.name = cube.uuid+'_grid_box';
		box.renderOrder = 2;
		box.frustumCulled = false;
		mesh.grid_box = box;
		mesh.add(box);
	}
}
