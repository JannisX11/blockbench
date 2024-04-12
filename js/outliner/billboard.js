class BillboardFace extends CubeFace {
	constructor(data, billboard) {
		super();
		this.texture = false;
		this.billboard = billboard;
		this.uv = [0, 0, canvasGridSize(), canvasGridSize()]
		this.rotation = 0;

		if (data) {
			this.extend(data)
		}
	}
	get uv_size() {
		return [
			this.uv[2] - this.uv[0],
			this.uv[3] - this.uv[1]
		]
	}
	set uv_size(arr) {
		this.uv[2] = arr[0] + this.uv[0];
		this.uv[3] = arr[1] + this.uv[1];
	}
	extend(data) {
		super.extend(data);
		if (data.uv) {
			Merge.number(this.uv, data.uv, 0)
			Merge.number(this.uv, data.uv, 1)
			Merge.number(this.uv, data.uv, 2)
			Merge.number(this.uv, data.uv, 3)
		}
		return this;
	}
	reset() {
		super.reset();
		this.rotation = 0;
		return this;
	}
	getBoundingRect() {
		return getRectangle(...this.uv);
	}
}
BillboardFace.prototype.is_rectangular = true;
new Property(BillboardFace, 'number', 'rotation', {default: 0});


class Billboard extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid)
		let size = Settings.get('default_cube_size');
		this.position = [0, 0, 0];
		this.size = [size, size];
		this.shade = true;
		this.mirror_uv = false;
		this.color = Math.floor(Math.random()*markerColors.length)
		this.visibility = true;
		this.autouv = 0;

		for (var key in Billboard.properties) {
			Billboard.properties[key].reset(this);
		}

		this.box_uv = Project.box_uv;
		this.faces = {
			front: 	new BillboardFace(null, this),
		}
		if (data && typeof data === 'object') {
			this.extend(data)
		}
	}
	get origin() {
		return this.position;
	}
	extend(object) {
		for (var key in Billboard.properties) {
			Billboard.properties[key].merge(this, object)
		}

		this.sanitizeName();
		if (object.size) {
			if (typeof object.size[0] == 'number' && !isNaN(object.size[0])) this.size[0] = object.size[0];
			if (typeof object.size[1] == 'number' && !isNaN(object.size[1])) this.size[1] = object.size[1];
		}
		if (object.faces) {
			for (var face in this.faces) {
				if (this.faces.hasOwnProperty(face) && object.faces.hasOwnProperty(face)) {
					this.faces[face].extend(object.faces[face])
				}
			}
		}
		return this;
	}
	init() {
		super.init();
		if (Format.single_texture && Texture.getDefault()) {
			this.faces.front.texture = Texture.getDefault().uuid;
		}
		return this;
	}
	getMesh() {
		return this.mesh;
	}
	get mesh() {
		return Project.nodes_3d[this.uuid];
	}
	getUndoCopy(aspects = 0) {
		let copy = new Billboard(this);
		for (let face_id in copy.faces) {
			copy.faces[face_id] = copy.faces[face_id].getUndoCopy()
		}
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy(project) {
		let el = {}
		
		for (var key in Billboard.properties) {
			Billboard.properties[key].copy(this, el)
		}

		el.from = this.from;
		el.autouv = this.autouv;
		el.color = this.color;

		if (!this.visibility) el.visibility = false;
		if (!this.export) el.export = false;
		if (!this.shade) el.shade = false;
		el.origin = this.origin;
		el.faces = {
			front: this.faces.front.getSaveCopy(project)
		}
		el.type = this.type;
		el.uuid = this.uuid;
		return el;
	}
	flip(axis) {
		var offset = this.position[axis] - center
		this.position[axis] = center - offset;
		// Name
		if (axis == 0 && this.name.includes('right')) {
			this.name = this.name.replace(/right/g, 'left').replace(/2$/, '');
		} else if (axis == 0 && this.name.includes('left')) {
			this.name = this.name.replace(/left/g, 'right').replace(/2$/, '');
		}
		this.createUniqueName();
		this.preview_controller.updateTransform(this);
		return this;
	}
	getWorldCenter() {
		var pos = Reusable.vec1.set(0, 0, 0);
		var q = Reusable.quat1.set(0, 0, 0, 1);
		if (this.parent instanceof Group) {
			THREE.fastWorldPosition(this.parent.mesh, pos);
			this.parent.mesh.getWorldQuaternion(q);
			var offset2 = Reusable.vec2.fromArray(this.parent.origin).applyQuaternion(q);
			pos.sub(offset2);
		}
		var offset = Reusable.vec3.fromArray(this.position).applyQuaternion(q);
		pos.add(offset);

		return pos;
	}
	setColor(index) {
		this.color = index;
		if (this.visibility) {
			this.preview_controller.updateFaces(this);
		}
		return this;
	}
	applyTexture(texture) {
		let value = null
		if (texture) {
			value = texture.uuid
		} else if (texture === false || texture === null) {
			value = texture;
		}
		this.faces.front.texture = value;
		if (selected.indexOf(this) === 0) {
			UVEditor.loadData()
		}
		this.preview_controller.updateFaces(this);
		this.preview_controller.updateUV(this);
	}
	moveVector(arr, axis, update = true) {
		if (typeof arr == 'number') {
			let n = arr;
			arr = [0, 0, 0];
			arr[axis||0] = n;
		} else if (arr instanceof THREE.Vector3) {
			arr = arr.toArray();
		}
		let scope = this;
		let in_box = true;
		arr.forEach((val, i) => {

			val += scope.from[i];

			let val_before = val;
			if (Math.abs(val_before - val) >= 1e-4) in_box = false;
			val -= scope.from[i]

			scope.position[i] += val;
		})
		if (update) {
			this.mapAutoUV()
			this.preview_controller.updateTransform(this);
			this.preview_controller.updateGeometry(this);
		}
		TickUpdates.selection = true;
		return in_box;
	}
	resize(val, axis, negative) {
		if (axis == 2) return;
		if (negative) val = -val;

		let before = this.old_size != undefined ? this.old_size : this.size[axis];
		if (before instanceof Array) before = before[axis];
		let modify = val instanceof Function ? val : n => (n+val);

		this.size[axis] = modify(before);

		this.mapAutoUV();
		this.preview_controller.updateGeometry(this);
		TickUpdates.selection = true;
		return this;
	}
	mapAutoUV() {

	}
}
	Billboard.prototype.title = tl('data.billboard');
	Billboard.prototype.type = 'billboard';
	Billboard.prototype.icon = 'fa fas fa-bookmark';
	Billboard.prototype.movable = true;
	Billboard.prototype.resizable = true;
	Billboard.prototype.rotatable = false;
	Billboard.prototype.needsUniqueName = false;
	Billboard.prototype.menu = new Menu([
		...Outliner.control_menu_group,
		'_',
		'rename',
		{name: 'menu.cube.color', icon: 'color_lens', children() {
			return markerColors.map((color, i) => {return {
				icon: 'bubble_chart',
				color: color.standard,
				name: color.name || 'cube.color.'+color.id,
				click(cube) {
					cube.forSelected(function(obj){
						obj.setColor(i)
					}, 'change color')
				}
			}});
		}},
		{name: 'menu.cube.texture', icon: 'collections', condition: () => !Project.single_texture, children: function() {
			let arr = [
				{icon: 'crop_square', name: 'menu.cube.texture.blank', click: function(cube) {
					cube.forSelected(function(obj) {
						obj.applyTexture(false, true)
					}, 'texture blank')
				}}
			]
			Texture.all.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					click: function(cube) {
						cube.forSelected(function(obj) {
							obj.applyTexture(t, true)
						}, 'apply texture')
					}
				})
			})
			return arr;
		}},
		'toggle_visibility',
		'delete'
	]);
	Billboard.prototype.buttons = [
		Outliner.buttons.autouv,
		Outliner.buttons.mirror_uv,
		Outliner.buttons.shade,
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];

new Property(Billboard, 'string', 'name', {default: 'billboard'});
new Property(Billboard, 'boolean', 'locked');

OutlinerElement.registerType(Billboard, 'billboard');


new NodePreviewController(Billboard, {
	setup(element) {
		let geometry = new THREE.PlaneBufferGeometry(2, 2);
		let mesh = new THREE.Mesh(geometry, Canvas.emptyMaterials[0]);
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = 'billboard';
		mesh.isElement = true;
		mesh.visible = element.visibility;
		mesh.rotation.order = 'ZYX'

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(4).fill(0), 1));

		// Outline
		let line_geometry = new THREE.BufferGeometry();
		let line = new THREE.Line(line_geometry, Canvas.outlineMaterial);
		line.no_export = true;
		line.name = element.uuid+'_outline';
		line.visible = element.selected;
		line.renderOrder = 2;
		line.frustumCulled = false;
		mesh.outline = line;
		mesh.add(line);
		line_geometry.setAttribute('position', new THREE.BufferAttribute(new Uint8Array(12).fill(0), 3));

		// Update
		this.updateTransform(element);
		this.updateGeometry(element);
		this.updateFaces(element);
		this.updateUV(element);

		this.dispatchEvent('setup', {element});
	},
	updateTransform(element) {
		NodePreviewController.prototype.updateTransform.call(this, element);

		this.updateFacingCamera(element);

		this.dispatchEvent('update_transform', {element});
	},
	updateGeometry(element) {
		if (element.resizable) {
			let mesh = element.mesh;
			let half_size = [element.size[0]/2, element.size[1]/2];

			let corners = [
				-half_size[0],  half_size[1], 0,
				 half_size[0],  half_size[1], 0,
				-half_size[0], -half_size[1], 0,
				 half_size[0], -half_size[1], 0,
			];
			mesh.geometry.attributes.position.array.set(corners, 0);
			mesh.geometry.attributes.position.needsUpdate = true;
			mesh.geometry.computeBoundingBox()
			mesh.geometry.computeBoundingSphere()

			let outline_corners = [
				-half_size[0],  half_size[1], 0,
				 half_size[0],  half_size[1], 0,
				 half_size[0], -half_size[1], 0,
				-half_size[0], -half_size[1], 0,
				-half_size[0],  half_size[1], 0,
			];
			mesh.outline.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outline_corners), 3));
		}

		this.dispatchEvent('update_geometry', {element});
	},
	updateFaces(element) {
		let {mesh} = element;

		if (Project.view_mode === 'solid') {
			mesh.material = Canvas.solidMaterial
		
		} else if (Project.view_mode === 'wireframe') {
			mesh.material = Canvas.wireframeMaterial
		
		} else if (Project.view_mode === 'normal') {
			mesh.material = Canvas.normalHelperMaterial
		
		} else if (Project.view_mode === 'uv') {
			mesh.material = Canvas.uvHelperMaterial

		} else if (Format.single_texture && Texture.all.length >= 2 && Texture.all.find(t => t.render_mode == 'layered')) {
			mesh.material = Canvas.getLayeredMaterial();

		} else if (Format.single_texture) {
			let tex = Texture.getDefault();
			mesh.material = tex ? tex.getMaterial() : Canvas.emptyMaterials[element.color];

		} else {
			let tex = element.faces.front.getTexture();
			if (tex && tex.uuid) {
				mesh.material = Project.materials[tex.uuid];
			} else {
				mesh.material = Canvas.emptyMaterials[element.color];
			}
		}
		if (!mesh.material) mesh.material = Canvas.transparentMaterial;

		Billboard.preview_controller.dispatchEvent('update_faces', {element});
	},
	updateUV(element, animation = true) {
		let mesh = element.mesh
		if (mesh === undefined || !mesh.geometry) return;

		
		let stretch = 1
		let frame = 0

		stretch = 1;
		frame = 0;
		let tex = element.faces.front.getTexture();
		if (tex instanceof Texture && tex.frameCount !== 1) {
			stretch = tex.frameCount
			if (animation === true && tex.currentFrame) {
				frame = tex.currentFrame
			}
		}
		let face = element.faces.front;
		if (face.texture === null) return;

		let uv = face.uv;
		let vertex_uvs = mesh.geometry.attributes.uv;
		let pw = Project.getUV;
		let ph = Project.getUV;
		if (tex && Format.per_texture_uv_size && Project.view_mode !== 'uv') {
			pw = tex.getUVWidth();
			ph = tex.getUVHeight();
		}

		if (tex instanceof Texture && tex.frameCount !== 1) {
			stretch = tex.frameCount || 1;
			if (animation === true && tex.currentFrame) {
				frame = tex.currentFrame;
			}
		}
		stretch *= -1;

		// Box UV fight texture bleeding
		if (element.box_uv) {
			uv = uv.slice();
			for (let si = 0; si < 2; si++) {
				let margin = 1/64;
				if (uv[si] > uv[si+2]) {
					margin = -margin
				}
				uv[si] += margin
				uv[si+2] -= margin
			}
		}

		let arr = [
			[uv[0]/pw, (uv[1]/ph)/stretch+1],
			[uv[2]/pw, (uv[1]/ph)/stretch+1],
			[uv[0]/pw, (uv[3]/ph)/stretch+1],
			[uv[2]/pw, (uv[3]/ph)/stretch+1],
		]
		if (frame > 0 && stretch !== -1) {
			//Animate
			let offset = (1/stretch) * frame
			arr[0][1] += offset
			arr[1][1] += offset
			arr[2][1] += offset
			arr[3][1] += offset
		}
		let rot = (face.rotation+0)
		while (rot > 0) {
			let a = arr[0];
			arr[0] = arr[2];
			arr[2] = arr[3];
			arr[3] = arr[1];
			arr[1] = a;
			rot = rot-90;
		}
		vertex_uvs.array.set(arr[0], 0);  //0,1
		vertex_uvs.array.set(arr[1], 2);  //1,1
		vertex_uvs.array.set(arr[2], 4);  //0,0
		vertex_uvs.array.set(arr[3], 6);  //1,0

		mesh.geometry.attributes.uv.needsUpdate = true;

		this.dispatchEvent('update_uv', {element});

		return mesh.geometry;
	},
	updateFacingCamera(element) {
		//let scale = Preview.selected.calculateControlScale(billboard.getWorldPosition());
		element.mesh.lookAt(Preview.selected.camera.position);
	},
	updateHighlight(element, hover_cube, force_off) {
		let mesh = element.mesh;
		let highlighted = (
			Settings.get('highlight_cubes') &&
			((hover_cube == element && !Transformer.dragging) || element.selected) &&
			Modes.edit &&
			!force_off
		) ? 1 : 0;

		if (mesh.geometry.attributes.highlight.array[0] != highlighted) {
			mesh.geometry.attributes.highlight.array.set(Array(mesh.geometry.attributes.highlight.count).fill(highlighted));
			mesh.geometry.attributes.highlight.needsUpdate = true;
		}

		this.dispatchEvent('update_highlight', {element});
	},
	updatePaintingGrid(cube) {
		return;

		let mesh = cube.mesh;
		if (mesh === undefined) return;
		mesh.remove(mesh.grid_box);
		if (cube.visibility == false) return;

		if (!Modes.paint || !settings.painting_grid.value) return;

		let from = cube.from.slice();
		let to = cube.to.slice();
		if (cube.inflate) {
			from[0] -= cube.inflate; from[1] -= cube.inflate; from[2] -= cube.inflate;
			  to[0] += cube.inflate;   to[1] += cube.inflate;   to[2] += cube.inflate;
		}

		let vertices = [];
		let epsilon = 0.0001
		function getVector2(arr, axis) {
			switch (axis) {
				case 0: return [arr[1], arr[2]]; break;
				case 1: return [arr[0], arr[2]]; break;
				case 2: return [arr[0], arr[1]]; break;
			}
		}
		function addVector(u, v, axis, w) {
			switch (axis) {
				case 0: vertices.push(w, u, v); break;
				case 1: vertices.push(u, w, v); break;
				case 2: vertices.push(u, v, w); break;
			}
		}

		let start = getVector2(from, axis)
		let end = getVector2(to, axis)
		let face = cube.faces.front;
		let texture = face.getTexture();
		if (texture === null) return;

		let px_x = texture ? Project.texture_width / texture.width : 1;
		let px_y = texture ? Project.texture_height / texture.height : 1;
		let uv_size = [
			Math.abs(face.uv_size[0]),
			Math.abs(face.uv_size[1])
		]
		uv_offset = [
			uv_offset[0] == true
				? (face.uv_size[0] > 0 ? (px_x-face.uv[2]) : (	   face.uv[2]))
				: (face.uv_size[0] > 0 ? (     face.uv[0]) : (px_x-face.uv[0])),
			uv_offset[1] == true
				? (face.uv_size[1] > 0 ? (px_y-face.uv[3]) : (	   face.uv[3]))
				: (face.uv_size[1] > 0 ? (     face.uv[1]) : (px_y-face.uv[1]))
		]
		uv_offset[0] = uv_offset[0] % px_x;
		uv_offset[1] = uv_offset[1] % px_y;
		
		if ((face.rotation % 180 == 90) != (axis == 0)) {
			uv_size.reverse();
			uv_offset.reverse();
		};

		let w = side == 0 ? from[axis] : to[axis]

		//Columns
		let width = end[0]-start[0];
		let step = Math.abs( width / uv_size[0] );
		if (texture) step *= Project.texture_width / texture.width;
		if (step < epsilon) step = epsilon;

		for (var col = start[0] - uv_offset[0]; col <= end[0]; col += step) {
			if (col >= start[0]) {
				addVector(col, start[1], axis, w);
				addVector(col, end[1], axis, w);
			}
		}

		//lines
		let height = end[1]-start[1];
		step = Math.abs( height / uv_size[1] );
		if (texture) {
			let tex_height = texture.frameCount ? (texture.height / texture.frameCount) : texture.height;
			step *= Project.texture_height / tex_height;
		}
		if (step < epsilon) step = epsilon;

		for (var line = start[1] - uv_offset[1]; line <= end[1]; line += step) {
			if (line >= start[1]) {
				addVector(start[0], line, axis, w);
				addVector(end[0], line, axis, w);
			}
		}


		let geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );

		let box = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: gizmo_colors.grid}));
		box.geometry.translate(-cube.origin[0], -cube.origin[1], -cube.origin[2]);
		box.no_export = true;

		box.name = cube.uuid+'_grid_box';
		box.renderOrder = 2;
		box.frustumCulled = false;
		mesh.grid_box = box;
		mesh.add(box);

		this.dispatchEvent('update_painting_grid', {element: cube});
	}
})

Blockbench.on('update_camera_position', e => {
	Billboard.all.forEach(billboard => {
		Billboard.preview_controller.updateFacingCamera(billboard);
	})
})

BARS.defineActions(function() {
	new Action({
		id: 'add_billboard',
		icon: 'bookmark_add',
		category: 'edit',
		condition: () => Modes.edit,
		click: function () {
			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			let new_billboard = new Billboard().init()
			new_billboard.mapAutoUV()
			let group = getCurrentGroup();
			if (group) {
				new_billboard.addTo(group)
				new_billboard.color = group.color;
			}

			if (Texture.getDefault()) {
				new_billboard.faces.front.texture = Texture.getDefault().uuid;
			}
			UVEditor.loadData();

			if (Group.selected) Group.selected.unselect()
			new_billboard.select()
			Canvas.updateView({elements: [new_billboard], element_aspects: {transform: true, geometry: true}})
			Undo.finishEdit('Add billboard', {outliner: true, elements: selected, selection: true});
			Blockbench.dispatchEvent( 'add_billboard', {object: new_billboard} )

			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					new_billboard.rename()
				}
			})
			return new_billboard
		}
	})
})