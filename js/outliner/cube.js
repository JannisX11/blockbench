class CubeFace extends Face {
	constructor(direction, data, cube) {
		super();
		this.texture = false;
		this.direction = direction || 'north';
		this.cube = cube;
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
	getVertexIndices() {
		switch (this.direction) {
			case 'north': 	return [1, 4, 6, 3];
			case 'east': 	return [0, 1, 3, 2];
			case 'south': 	return [5, 0, 2, 7];
			case 'west': 	return [4, 5, 7, 6];
			case 'up': 		return [4, 1, 0, 5];
			case 'down': 	return [7, 2, 3, 6];
		}
	}
}
new Property(CubeFace, 'number', 'rotation', {default: 0});
new Property(CubeFace, 'number', 'tint', {default: -1});
new Property(CubeFace, 'string', 'cullface', )//{merge_validation: (val) => (UVEditor.cube_faces.includes(val) || val == '')});
new Property(CubeFace, 'string', 'material_name');
new Property(CubeFace, 'boolean', 'enabled', {default: true});

CubeFace.opposite = {
	north: 'south',
	south: 'north',
	east: 'west',
	west: 'east',
	down: 'up',
	up: 'down'
}

class Cube extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid)
		let size = Settings.get('default_cube_size');
		this.from = [0, 0, 0];
		this.to = [size, size, size];
		this.shade = true;
		this.mirror_uv = false;
		this.color = Math.floor(Math.random()*8)
		this.uv_offset = [0,0]
		this.inflate = 0;
		this.rotation = [0, 0, 0];
		this.origin = [0, 0, 0];
		this.visibility = true;
		this.autouv = 0;

		for (var key in Cube.properties) {
			Cube.properties[key].reset(this);
		}

		this.box_uv = Project.box_uv;
		this.faces = {
			north: 	new CubeFace('north', null, this),
			east: 	new CubeFace('east', null, this),
			south: 	new CubeFace('south', null, this),
			west: 	new CubeFace('west', null, this),
			up: 	new CubeFace('up', null, this),
			down: 	new CubeFace('down', null, this)
		}
		if (data && typeof data === 'object') {
			this.extend(data)
		}
	}
	extend(object) {
		for (var key in Cube.properties) {
			Cube.properties[key].merge(this, object)
		}

		this.sanitizeName();
		Merge.boolean(this, object, 'shade')
		Merge.boolean(this, object, 'mirror_uv')
		Merge.number(this, object, 'inflate')
		Merge.number(this, object, 'autouv')
		Merge.number(this, object, 'color')
		Merge.boolean(this, object, 'export')
		Merge.boolean(this, object, 'visibility')
		if (object.from) {
			Merge.number(this.from, object.from, 0)
			Merge.number(this.from, object.from, 1)
			Merge.number(this.from, object.from, 2)
		}
		if (object.to) {
			Merge.number(this.to, object.to, 0)
			Merge.number(this.to, object.to, 1)
			Merge.number(this.to, object.to, 2)
		}
		if (object.size) {
			if (typeof object.size[0] == 'number' && !isNaN(object.size[0])) this.to[0] = this.from[0] + object.size[0]
			if (typeof object.size[1] == 'number' && !isNaN(object.size[1])) this.to[1] = this.from[1] + object.size[1]
			if (typeof object.size[2] == 'number' && !isNaN(object.size[2])) this.to[2] = this.from[2] + object.size[2]
		}
		if (object.uv_offset) {
			Merge.number(this.uv_offset, object.uv_offset, 0)
			Merge.number(this.uv_offset, object.uv_offset, 1)
		}
		if (typeof object.rotation === 'object' && object.rotation.constructor.name === 'Object') {
			if (object.rotation.angle && object.rotation.axis) {
				var axis = getAxisNumber(object.rotation.axis)
				if (axis >= 0) {
					this.rotation.V3_set(0)
					this.rotation[axis] = object.rotation.angle
				}
			}
			if (object.rotation.origin) {
				Merge.number(this.origin, object.rotation.origin, 0)
				Merge.number(this.origin, object.rotation.origin, 1)
				Merge.number(this.origin, object.rotation.origin, 2)
			}
			Merge.boolean(this, object.rotation, 'rescale')
			if (typeof object.rotation.axis === 'string') {
				this.rotation_axis = object.rotation.axis
			}
		} else if (object.rotation) {
			Merge.number(this.rotation, object.rotation, 0)
			Merge.number(this.rotation, object.rotation, 1)
			Merge.number(this.rotation, object.rotation, 2)
		}
		if (object.rotated) {
			Merge.number(this.rotation, object.rotated, 0)
			Merge.number(this.rotation, object.rotated, 1)
			Merge.number(this.rotation, object.rotated, 2)
		}
		if (object.origin) {
			Merge.number(this.origin, object.origin, 0)
			Merge.number(this.origin, object.origin, 1)
			Merge.number(this.origin, object.origin, 2)
		}
		Merge.string(this, object, 'rotation_axis', (v) => (v === 'x' || v === 'y' || v === 'z'))
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
			for (var face in this.faces) {
				if (this.faces[face].texture !== null) {
					this.faces[face].texture = Texture.getDefault().uuid
				}
			}
		}
		return this;
	}
	size(axis, floored) {
		var scope = this;
		let epsilon = 0.0000001;
		function getA(axis) {
			if (floored) {
				return Math.floor(scope.to[axis] - scope.from[axis] + epsilon);
			} else {
				return scope.to[axis] - scope.from[axis]
			}
		}
		if (axis !== undefined) {
			return getA(axis);
		} else {
			return [
				getA(0),
				getA(1),
				getA(2)
			]
		}
	}
	rotationAxis() {
		for (var axis = 0; axis < 3; axis++) {
			if (this.rotation[axis] !== 0) {
				this.rotation_axis = getAxisLetter(axis);
				return this.rotation_axis;
			}
		}
		return this.rotation_axis;
	}
	getMesh() {
		return this.mesh;
	}
	get mesh() {
		return Project.nodes_3d[this.uuid];
	}
	getUndoCopy(aspects = 0) {
		var copy = new Cube(this)
		if (aspects.uv_only) {
			copy = {
				box_uv: copy.box_uv,
				uv_offset: copy.uv_offset,
				faces: copy.faces,
				mirror_uv: copy.mirror_uv,
				autouv: copy.autouv,
			}
		}
		for (let face_id in copy.faces) {
			copy.faces[face_id] = copy.faces[face_id].getUndoCopy()
		}
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy(project) {
		var el = {}
		
		for (var key in Cube.properties) {
			Cube.properties[key].copy(this, el)
		}

		el.from = this.from;
		el.to = this.to;
		el.autouv = this.autouv;
		el.color = this.color;

		if (!this.visibility) el.visibility = false;
		if (!this.export) el.export = false;
		if (!this.shade) el.shade = false;
		if (this.mirror_uv) el.mirror_uv = true;
		if (this.inflate) el.inflate = this.inflate;
		if (!this.rotation.allEqual(0)) el.rotation = this.rotation;
		el.origin = this.origin;
		if (!this.uv_offset.allEqual(0)) el.uv_offset = this.uv_offset;
		el.faces = {}
		for (var face in this.faces) {
			el.faces[face] = this.faces[face].getSaveCopy(project)
		}
		el.type = this.type;
		el.uuid = this.uuid;
		return el;
	}
	roll(axis, steps, origin) {
		if (!origin) {origin = this.origin}
		function rotateCoord(array) {
			if (origin === undefined) {
				origin = [8, 8, 8]
			}
			var a, b;
			array.forEach(function(s, i) {
				if (i == axis) {
					//
				} else {
					if (a == undefined) {
						a = s - origin[i]
						b = i
					} else {
						array[b] = s - origin[i]
						array[b] = origin[b] - array[b]
						array[i] = origin[i] + a;
					}
				}
			})
			return array
		}

		// Check limits
		if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			let from = this.from.slice(), to = this.to.slice();
			for (let check_steps = steps; check_steps > 0; check_steps--) {
				switch(axis) {
					case 0: [from[2], to[2]] = [to[2], from[2]]; break;
					case 1: [from[2], to[2]] = [to[2], from[2]]; break;
					case 2: [from[1], to[1]] = [to[1], from[1]]; break;
				}
				from.V3_set(rotateCoord(from));
				to.V3_set(rotateCoord(to));
			}
			if (Format.cube_size_limiter.test(this, {from, to})) {
				return false;
			}
		}

		//Rotations
		var i = 0;
		var temp_rot = undefined;
		var temp_i = undefined;
		while (i < 3) {
			if (i !== axis) {
				if (temp_rot === undefined) {
					temp_rot = this.rotation[i]
					temp_i = i
				} else {
					this.rotation[temp_i] = -this.rotation[i]
					this.rotation[i] = temp_rot
				}
			}
			i++;
		}

		function rotateUVFace(number, iterations) {
			if (!number) number = 0;
			number += iterations * 90;
			return number % 360;
		}
		while (steps > 0) {
			steps--;
			//Swap coordinate thingy
			switch(axis) {
				case 0: [this.from[2], this.to[2]] = [this.to[2], this.from[2]]; break;
				case 1: [this.from[2], this.to[2]] = [this.to[2], this.from[2]]; break;
				case 2: [this.from[1], this.to[1]] = [this.to[1], this.from[1]]; break;
			}
			this.from.V3_set(rotateCoord(this.from))
			this.to.V3_set(rotateCoord(this.to))
			if (origin != this.origin) {
				this.origin.V3_set(rotateCoord(this.origin))
			}
			if (!this.box_uv) {
				if (axis === 0) {
					this.faces.west.rotation = rotateUVFace(this.faces.west.rotation, 1)
					this.faces.east.rotation = rotateUVFace(this.faces.east.rotation, 3)
					this.faces.north.rotation= rotateUVFace(this.faces.north.rotation, 2)
					this.faces.down.rotation = rotateUVFace(this.faces.down.rotation, 2)

					var temp = new CubeFace(true, this.faces.north)
					this.faces.north.extend(this.faces.down)
					this.faces.down.extend(this.faces.south)
					this.faces.south.extend(this.faces.up)
					this.faces.up.extend(temp)

				} else if (axis === 1) {

					this.faces.up.rotation= rotateUVFace(this.faces.up.rotation, 1)
					this.faces.down.rotation = rotateUVFace(this.faces.down.rotation, 3)

					var temp = new CubeFace(true, this.faces.north)
					this.faces.north.extend(this.faces.west)
					this.faces.west.extend(this.faces.south)
					this.faces.south.extend(this.faces.east)
					this.faces.east.extend(temp)

				} else if (axis === 2) {

					this.faces.north.rotation = rotateUVFace(this.faces.north.rotation, 1)
					this.faces.south.rotation= rotateUVFace(this.faces.south.rotation, 3)

					this.faces.up.rotation= rotateUVFace(this.faces.up.rotation, 3)
					this.faces.east.rotation= rotateUVFace(this.faces.east.rotation, 3)
					this.faces.west.rotation = rotateUVFace(this.faces.west.rotation, 3)
					this.faces.down.rotation = rotateUVFace(this.faces.down.rotation, 3)

					var temp = new CubeFace(true, this.faces.east)
					this.faces.east.extend(this.faces.down)
					this.faces.down.extend(this.faces.west)
					this.faces.west.extend(this.faces.up)
					this.faces.up.extend(temp)
				}
			}
		}
		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
		this.preview_controller.updateFaces(this);
		this.preview_controller.updateUV(this);
		return this;
	}
	flip(axis, center, skipUV) {
		var scope = this;

		this.rotation[(axis+1)%3] *= -1
		this.rotation[(axis+2)%3] *= -1

		var from = this.from[axis]
		this.from[axis] = center - (this.to[axis] - center)
		this.to[axis] = center - (from - center)
		this.origin[axis] = center - (this.origin[axis] - center)

		if (!skipUV) {

			function mirrorUVX(face, skip_rot) {
				var f = scope.faces[face]
				if (skip_rot) {}
				if (!skip_rot && (f.rotation == 90 || f.rotation == 270)) {
					return mirrorUVY(face, true)
				}
				return [f.uv[2], f.uv[1], f.uv[0], f.uv[3]]
			}
			function mirrorUVY(face, skip_rot) {
				var f = scope.faces[face]
				if (skip_rot) {}
				if (!skip_rot && (f.rotation == 90 || f.rotation == 270)) {
					return mirrorUVX(face, true)
				}
				return [f.uv[0], f.uv[3], f.uv[2], f.uv[1]]
			}
			//Faces
			var switchFaces;
			switch(axis) {
				case 0: switchFaces = ['west', 'east']; break;
				case 1: switchFaces = ['up', 'down']; break;
				case 2: switchFaces = ['south', 'north']; break;
			}
			var x = new CubeFace(switchFaces[1], this.faces[switchFaces[0]])
			this.faces[switchFaces[0]].extend(this.faces[switchFaces[1]])
			this.faces[switchFaces[1]].extend(x)

			//UV
			if (axis === 1) {
				this.faces.north.uv = 	mirrorUVY('north')
				this.faces.south.uv = 	mirrorUVY('south')
				this.faces.east.uv = 	mirrorUVY('east')
				this.faces.west.uv = 	mirrorUVY('west')
			} else {
				this.faces.north.uv = 	mirrorUVX('north')
				this.faces.south.uv = 	mirrorUVX('south')
				this.faces.east.uv = 	mirrorUVX('east')
				this.faces.west.uv = 	mirrorUVX('west')
			}
			if (axis === 0) {
				this.faces.up.uv = 		mirrorUVX('up')
				this.faces.down.uv = 	mirrorUVX('down')
			} else {
				this.faces.up.uv = 		mirrorUVY('up')
				this.faces.down.uv = 	mirrorUVY('down')
			}
		}
		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
		this.preview_controller.updateFaces(this);
		this.preview_controller.updateUV(this);
	}
	transferOrigin(origin, update = true) {
		if (!this.mesh) return;
		var q = Reusable.quat1.copy(this.mesh.quaternion)
		var shift = Reusable.vec1.set(
			this.origin[0] - origin[0],
			this.origin[1] - origin[1],
			this.origin[2] - origin[2],
		)
		var dq = Reusable.vec2.copy(shift)
		dq.applyQuaternion(q)
		shift.sub(dq)
		shift.applyQuaternion(q.invert())
		
		this.moveVector(shift, null, update)

		this.origin.V3_set(origin);

		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
		return this;
	}
	getWorldCenter() {
		var m = this.mesh;
		var pos = Reusable.vec1.set(
			this.from[0] + this.size(0)/2,
			this.from[1] + this.size(1)/2,
			this.from[2] + this.size(2)/2
		)
		pos.x = (pos.x - this.origin[0]) * m.scale.x;
		pos.y = (pos.y - this.origin[1]) * m.scale.y;
		pos.z = (pos.z - this.origin[2]) * m.scale.z;

		if (m) {
			var r = m.getWorldQuaternion(Reusable.quat1)
			pos.applyQuaternion(r)
			pos.add(THREE.fastWorldPosition(m, Reusable.vec2))
		}
		return pos;
	}
	getGlobalVertexPositions() {
		let vertices = [
			[this.to[0]   + this.inflate,  this.to[1] 	+ this.inflate,  this.to[2]		+ this.inflate],
			[this.to[0]   + this.inflate,  this.to[1] 	+ this.inflate,  this.from[2]	- this.inflate],
			[this.to[0]   + this.inflate,  this.from[1]	- this.inflate,  this.to[2]		+ this.inflate],
			[this.to[0]   + this.inflate,  this.from[1]	- this.inflate,  this.from[2]	- this.inflate],
			[this.from[0] - this.inflate,  this.to[1] 	+ this.inflate,  this.from[2]	- this.inflate],
			[this.from[0] - this.inflate,  this.to[1] 	+ this.inflate,  this.to[2]		+ this.inflate],
			[this.from[0] - this.inflate,  this.from[1]	- this.inflate,  this.from[2]	- this.inflate],
			[this.from[0] - this.inflate,  this.from[1]	- this.inflate,  this.to[2]		+ this.inflate],
		];
		let vec = new THREE.Vector3();
		return vertices.map(coords => {
			vec.set(...coords.V3_subtract(this.origin));
			vec.applyMatrix4( this.mesh.matrixWorld );
			let arr = vec.toArray();
			arr.V3_add(8, 8, 8);
			return arr;
		})
	}
	setUVMode(box_uv) {
		if (this.box_uv == !!box_uv) return this;
		this.box_uv = !!box_uv;
		if (this.box_uv) {
			if (this.faces.west.uv[2] < this.faces.east.uv[0]) {
				this.mirror_uv = true;
				this.uv_offset[0] = this.faces.west.uv[2];
			} else {
				this.mirror_uv = false;
				this.uv_offset[0] = this.faces.east.uv[0];
			}
			this.uv_offset[1] = this.faces.up.uv[3];
		} else {
			for (let fkey in this.faces) {
				this.faces[fkey].rotation = 0;
			}
		}
		this.preview_controller.updateUV(this);
		return this;
	}
	setColor(index) {
		this.color = index;
		if (this.visibility) {
			this.preview_controller.updateFaces(this);
		}
		return this;
	}
	applyTexture(texture, faces) {
		var scope = this;
		if (faces === true || this.box_uv) {
			var sides = ['north', 'east', 'south', 'west', 'up', 'down']
		} else if (faces === undefined) {
			var sides = [UVEditor.face]
		} else {
			var sides = faces
		}
		var value = null
		if (texture) {
			value = texture.uuid
		} else if (texture === false || texture === null) {
			value = texture;
		}
		sides.forEach(function(side) {
			if (scope.faces[side].texture !== null) {
				scope.faces[side].texture = value;
			}
		})
		if (selected.indexOf(this) === 0) {
			UVEditor.loadData()
		}
		this.preview_controller.updateFaces(this);
		this.preview_controller.updateUV(this);
	}
	mapAutoUV() {
		if (Blockbench.box_uv) return;
		var scope = this;
		var pw = Project.texture_width;
		var ph = Project.texture_height;
		if (scope.autouv === 2) {
			//Relative UV
			var all_faces = ['north', 'south', 'west', 'east', 'up', 'down']
			all_faces.forEach(function(side) {
				var uv = scope.faces[side].uv.slice()
				switch (side) {
					case 'north':
					uv = [
						pw - scope.to[0],
						ph - scope.to[1],
						pw - scope.from[0],
						ph - scope.from[1],
					];
					break;
					case 'south':
					uv = [
						scope.from[0],
						ph - scope.to[1],
						scope.to[0],
						ph - scope.from[1],
					];
					break;
					case 'west':
					uv = [
						scope.from[2],
						ph - scope.to[1],
						scope.to[2],
						ph - scope.from[1],
					];
					break;
					case 'east':
					uv = [
						pw - scope.to[2],
						ph - scope.to[1],
						pw - scope.from[2],
						ph - scope.from[1],
					];
					break;
					case 'up':
					uv = [
						scope.from[0],
						scope.from[2],
						scope.to[0],
						scope.to[2],
					];
					break;
					case 'down':
					uv = [
						scope.from[0],
						ph - scope.to[2],
						scope.to[0],
						ph - scope.from[2],
					];
					break;
				}
				// Clamp to UV map boundaries
				if (Math.max(uv[0], uv[2]) > Project.texture_width) {
					let offset = Math.max(uv[0], uv[2]) - Project.texture_width;
					uv[0] -= offset;
					uv[2] -= offset;
				}
				if (Math.min(uv[0], uv[2]) < 0) {
					let offset = Math.min(uv[0], uv[2]);
					uv[0] = Math.clamp(uv[0] - offset, 0, Project.texture_width);
					uv[2] = Math.clamp(uv[2] - offset, 0, Project.texture_width);
				}
				if (Math.max(uv[1], uv[3]) > Project.texture_height) {
					let offset = Math.max(uv[1], uv[3]) - Project.texture_height;
					uv[1] -= offset;
					uv[3] -= offset;
				}
				if (Math.min(uv[1], uv[3]) < 0) {
					let offset = Math.min(uv[1], uv[3]);
					uv[1] = Math.clamp(uv[1] - offset, 0, Project.texture_height);
					uv[3] = Math.clamp(uv[3] - offset, 0, Project.texture_height);
				}
				scope.faces[side].uv = uv;
			})
			Canvas.updateUV(scope)
		} else if (scope.autouv === 1) {

			function calcAutoUV(face, size) {
				var sx = scope.faces[face].uv[0]
				var sy = scope.faces[face].uv[1]
				var rot = scope.faces[face].rotation

				//Match To Rotation
				if (rot === 90 || rot === 270) {
					size.reverse()
				}
				//Limit Input to 16
				size[0] = Math.clamp(size[0], -Project.texture_width, Project.texture_width)
				size[1] = Math.clamp(size[1], -Project.texture_height, Project.texture_height)

				//Calculate End Points
				var x = sx + size[0]
				var y = sy + size[1]
				//Prevent Over 16
				if (x > Project.texture_width) {
					sx = Project.texture_width - (x - sx)
					x = Project.texture_width
				}
				if (y > Project.texture_height) {
					sy = Project.texture_height - (y - sy)
					y = Project.texture_height
				}
				//Prevent Negative
				if (sx < 0) sx = 0
				if (sy < 0) sy = 0
				//Prevent Mirroring
				if (x < sx) x = sx
				if (y < sy) y = sy
				//Return
				return [sx, sy, x, y]
			}
			scope.faces.north.uv = calcAutoUV('north', [scope.size(0), scope.size(1)])
			scope.faces.east.uv =  calcAutoUV('east',  [scope.size(2), scope.size(1)])
			scope.faces.south.uv = calcAutoUV('south', [scope.size(0), scope.size(1)])
			scope.faces.west.uv =  calcAutoUV('west',  [scope.size(2), scope.size(1)])
			scope.faces.up.uv =	   calcAutoUV('up',	   [scope.size(0), scope.size(2)])
			scope.faces.down.uv =  calcAutoUV('down',  [scope.size(0), scope.size(2)])

			Canvas.updateUV(scope)
		}
	}
	moveVector(arr, axis, update = true) {
		if (typeof arr == 'number') {
			var n = arr;
			arr = [0, 0, 0];
			arr[axis||0] = n;
		} else if (arr instanceof THREE.Vector3) {
			arr = arr.toArray();
		}
		var scope = this;
		var in_box = true;
		arr.forEach((val, i) => {

			var size = scope.size(i);
			val += scope.from[i];

			var val_before = val;
			if (Math.abs(val_before - val) >= 1e-4) in_box = false;
			val -= scope.from[i]

			scope.from[i] += val;
			scope.to[i] += val;
		})
		if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			Format.cube_size_limiter.move(this);
		}
		if (update) {
			this.mapAutoUV()
			this.preview_controller.updateTransform(this);
			this.preview_controller.updateGeometry(this);
		}
		TickUpdates.selection = true;
		return in_box;
	}
	resize(val, axis, negative, allow_negative, bidirectional) {
		var before = this.oldScale != undefined ? this.oldScale : this.size(axis);
		if (before instanceof Array) before = before[axis];
		var modify = val instanceof Function ? val : n => (n+val)

		if (bidirectional) {

			let center = this.oldCenter[axis] || 0;
			let difference = modify(before) - before;
			if (negative) difference *= -1;

			var from = center - (before/2) - difference;
			var to = center + (before/2) + difference;

			if (Format.integer_size) {
				from = Math.round(from-this.from[axis])+this.from[axis];
				to = Math.round(to-this.to[axis])+this.to[axis];
			}
			this.from[axis] = from;
			this.to[axis] = to;

		} else if (!negative) {
			var pos = this.from[axis] + modify(before);
			if (Format.integer_size) {
				pos = Math.round(pos-this.from[axis])+this.from[axis];
			}
			if (pos >= this.from[axis] || settings.negative_size.value || allow_negative) {
				this.to[axis] = pos;
			} else {
				this.to[axis] = this.from[axis];
			}
		} else {
			var pos = this.to[axis] + modify(-before);
			if (Format.integer_size) {
				pos = Math.round(pos-this.to[axis])+this.to[axis];
			}
			if (pos <= this.to[axis] || settings.negative_size.value || allow_negative) {
				this.from[axis] = pos;
			} else {
				this.from[axis] = this.to[axis];
			}
		}
		if (Format.cube_size_limiter && !settings.deactivate_size_limit.value) {
			Format.cube_size_limiter.clamp(this, {}, axis, bidirectional ? null : !!negative);
		}
		this.mapAutoUV();
		if (this.box_uv) {
			Canvas.updateUV(this);
		}
		this.preview_controller.updateGeometry(this);
		TickUpdates.selection = true;
		return this;
	}
}
	Cube.prototype.title = tl('data.cube');
	Cube.prototype.type = 'cube';
	Cube.prototype.icon = 'fa fa-cube';
	Cube.prototype.movable = true;
	Cube.prototype.resizable = true;
	Cube.prototype.rotatable = true;
	Cube.prototype.needsUniqueName = false;
	Cube.prototype.menu = new Menu([
		...Outliner.control_menu_group,
		'_',
		'rename',
		'convert_to_mesh',
		'update_autouv',
		'cube_uv_mode',
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
			var arr = [
				{icon: 'crop_square', name: 'menu.cube.texture.blank', click: function(cube) {
					cube.forSelected(function(obj) {
						obj.applyTexture(false, true)
					}, 'texture blank')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', click: function(cube) {
					cube.forSelected(function(obj) {
						obj.applyTexture(null, true)
					}, 'texture transparent')
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
		'edit_material_instances',
		'toggle_visibility',
		'delete'
	]);
	Cube.prototype.buttons = [
		Outliner.buttons.autouv,
		Outliner.buttons.mirror_uv,
		Outliner.buttons.shade,
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];

new Property(Cube, 'string', 'name', {default: 'cube'});
new Property(Cube, 'boolean', 'box_uv', {merge_validation: (value) => Format.optional_box_uv || value === Format.box_uv});
new Property(Cube, 'boolean', 'rescale');
new Property(Cube, 'boolean', 'locked');

OutlinerElement.registerType(Cube, 'cube');


new NodePreviewController(Cube, {
	setup(element) {
		var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Canvas.emptyMaterials[0]);
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = 'cube';
		mesh.isElement = true;
		mesh.visible = element.visibility;
		mesh.rotation.order = 'ZYX'

		mesh.geometry.setAttribute('highlight', new THREE.BufferAttribute(new Uint8Array(24).fill(0), 1));

		// Outline
		let geometry = new THREE.BufferGeometry();
		let line = new THREE.Line(geometry, Canvas.outlineMaterial);
		line.no_export = true;
		line.name = element.uuid+'_outline';
		line.visible = element.selected;
		line.renderOrder = 2;
		line.frustumCulled = false;
		mesh.outline = line;
		mesh.add(line);

		// Update
		this.updateTransform(element);
		this.updateGeometry(element);
		this.updateFaces(element);
		this.updateUV(element);

		this.dispatchEvent('setup', {element});
	},
	updateTransform(element) {
		NodePreviewController.prototype.updateTransform(element);

		let mesh = element.mesh;

		if (Format.rotate_cubes && element.rescale === true) {
			var axis = element.rotationAxis()||'y';
			var rescale = getRescalingFactor(element.rotation[getAxisNumber(axis)]);
			mesh.scale.set(rescale, rescale, rescale);
			mesh.scale[axis] = 1;
		}

		this.dispatchEvent('update_transform', {element});
	},
	updateGeometry(element) {
		if (element.resizable) {
			let mesh = element.mesh;
			var from = element.from.slice()
			from.forEach((v, i) => {
				from[i] -= element.inflate;
				from[i] -= element.origin[i];
			})
			var to = element.to.slice()
			to.forEach((v, i) => {
				to[i] += element.inflate
				to[i] -= element.origin[i];
				if (from[i] === to[i]) {
					to[i] += 0.001
				}
			})
			mesh.geometry.setShape(from, to)
			mesh.geometry.computeBoundingBox()
			mesh.geometry.computeBoundingSphere()

			// Update outline
			var vs = [0,1,2,3,4,5,6,7].map(i => {
				return mesh.geometry.attributes.position.array.slice(i*3, i*3 + 3)
			});
			let points = [
				vs[2], vs[3],
				vs[6], vs[7],
				vs[2], vs[0],
				vs[1], vs[4],
				vs[5], vs[0],
				vs[5], vs[7],
				vs[6], vs[4],
				vs[1], vs[3]
			].map(a => new THREE.Vector3().fromArray(a))
			mesh.outline.geometry.setFromPoints(points);
		}

		this.dispatchEvent('update_geometry', {element});
	},
	updateFaces(element) {
		let {mesh} = element;

		let indices = [];
		let j = 0;
		mesh.geometry.faces = [];
		mesh.geometry.clearGroups();
		let last_tex;
		Canvas.face_order.forEach((fkey, i) => {
			if (element.faces[fkey].texture !== null) {
				indices.push(0 + i*4, 2 + i*4, 1 + i*4, 2 + i*4, 3 + i*4, 1 + i*4);
				if (last_tex && element.faces[fkey].texture === last_tex) {
					mesh.geometry.groups[mesh.geometry.groups.length-1].count += 6;
				} else {
					mesh.geometry.addGroup(j*6, 6, j)
					last_tex = element.faces[fkey].texture;
				}
				mesh.geometry.faces.push(fkey)
				j++;
			}
		})
		mesh.geometry.setIndex(indices)

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
			var materials = []
			Canvas.face_order.forEach(function(face) {
				if (element.faces[face].texture !== null) {
					var tex = element.faces[face].getTexture()
					if (tex && tex.uuid) {
						materials.push(Project.materials[tex.uuid])
					} else {
						materials.push(Canvas.emptyMaterials[element.color])
					}
				}
			})
			if (materials.allEqual(materials[0])) materials = materials[0];
			mesh.material = materials
		}
		if (!mesh.material) mesh.material = Canvas.transparentMaterial;

		Cube.preview_controller.dispatchEvent('update_faces', {element});
	},
	updateUV(element, animation = true) {
		var mesh = element.mesh
		if (mesh === undefined || !mesh.geometry) return;

		if (element.box_uv) {

			var size = element.size(undefined, true)
			
			var face_list = [   
				{face: 'east',	from: [0, size[2]],				   		size: [size[2],  size[1]]},
				{face: 'west',	from: [size[2] + size[0], size[2]],   	size: [size[2],  size[1]]},
				{face: 'up', 	from: [size[2]+size[0], size[2]],	 	size: [-size[0], -size[2]]},
				{face: 'down',	from: [size[2]+size[0]*2, 0],		 	size: [-size[0], size[2]]},
				{face: 'south',	from: [size[2]*2 + size[0], size[2]], 	size: [size[0],  size[1]]},
				{face: 'north',	from: [size[2], size[2]],			 	size: [size[0],  size[1]]},
			]

			if (element.mirror_uv) {
				face_list.forEach(function(f) {
					f.from[0] += f.size[0]
					f.size[0] *= -1
				})
				//East+West
				
				var p = {}

				p.from = face_list[0].from.slice()
				p.size = face_list[0].size.slice()

				face_list[0].from = face_list[1].from.slice()
				face_list[0].size = face_list[1].size.slice()

				face_list[1].from = p.from.slice()
				face_list[1].size = p.size.slice()

			}
			face_list.forEach(function(f, fIndex) {

				if (element.faces[f.face].texture == null) return;

				var uv= [
					f.from[0]			 +  element.uv_offset[0],
					f.from[1]			 +  element.uv_offset[1],
					f.from[0] + f.size[0] + element.uv_offset[0],
					f.from[1] + f.size[1] + element.uv_offset[1]
				]
				uv.forEach(function(s, si) {
					uv[si] *= 1
				})

				element.faces[f.face].uv[0] = uv[0]
				element.faces[f.face].uv[1] = uv[1]
				element.faces[f.face].uv[2] = uv[2]
				element.faces[f.face].uv[3] = uv[3]

				//Fight Bleeding
				for (var si = 0; si < 2; si++) {
					let margin = 1/64;
					if (uv[si] > uv[si+2]) {
						margin = -margin
					}
					uv[si] += margin
					uv[si+2] -= margin
				}

				stretch = 1;
				frame = 0;
				let tex = element.faces[f.face].getTexture();
				if (tex instanceof Texture && tex.frameCount !== 1) {
					stretch = tex.frameCount
					if (animation === true && tex.currentFrame) {
						frame = tex.currentFrame
					}
				}

				Canvas.updateUVFace(mesh.geometry.attributes.uv, fIndex, {uv: uv}, frame, stretch)
			})

		} else {
		
			var stretch = 1
			var frame = 0

			Canvas.face_order.forEach((face, fIndex) => {

				if (element.faces[face].texture === null) return;

				stretch = 1;
				frame = 0;
				let tex = element.faces[face].getTexture();
				if (tex instanceof Texture && tex.frameCount !== 1) {
					stretch = tex.frameCount
					if (animation === true && tex.currentFrame) {
						frame = tex.currentFrame
					}
				}
				Canvas.updateUVFace(mesh.geometry.attributes.uv, fIndex, element.faces[face], frame, stretch)
			})

		}
		mesh.geometry.attributes.uv.needsUpdate = true;

		this.dispatchEvent('update_uv', {element});

		return mesh.geometry;
	},
	updateHighlight(element, hover_cube, force_off) {
		var mesh = element.mesh;
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
		var mesh = cube.mesh;
		if (mesh === undefined) return;
		mesh.remove(mesh.grid_box);
		if (cube.visibility == false) return;

		if (!Modes.paint || !settings.painting_grid.value) return;

		var from = cube.from.slice();
		var to = cube.to.slice();
		if (cube.inflate) {
			from[0] -= cube.inflate; from[1] -= cube.inflate; from[2] -= cube.inflate;
			  to[0] += cube.inflate;   to[1] += cube.inflate;   to[2] += cube.inflate;
		}

		var vertices = [];
		var epsilon = 0.0001
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

		function addFace(name, uv_offset, axis, side) {

			var start = getVector2(from, axis)
			var end = getVector2(to, axis)
			var face = cube.faces[name];
			var texture = face.getTexture();
			if (texture === null) return;

			var px_x = texture ? Project.texture_width / texture.width : 1;
			var px_y = texture ? Project.texture_height / texture.height : 1;
			var uv_size = [
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
			}

			var w = side == 0 ? from[axis] : to[axis]

			//Columns
			var width = end[0]-start[0];
			var step = Math.abs( width / uv_size[0] );
			if (texture) step *= Project.texture_width / texture.width;
			if (step < epsilon) step = epsilon;

			for (var col = start[0] - uv_offset[0]; col <= end[0]; col += step) {
				if (col >= start[0]) {
					addVector(col, start[1], axis, w);
					addVector(col, end[1], axis, w);
				}
			}

			//lines
			var height = end[1]-start[1];
			var step = Math.abs( height / uv_size[1] );
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
		}

		addFace('north', [true,  true],  2, 0);
		addFace('south', [false, true],  2, 1);
		addFace('west',  [false, true],  0, 0);
		addFace('east',  [true,  true],  0, 1);
		addFace('down',  [false, true],  1, 0);
		addFace('up',    [false, false], 1, 1);


		var geometry = new THREE.BufferGeometry();
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

BARS.defineActions(function() {
	new Action({
		id: 'add_cube',
		icon: 'add_box',
		category: 'edit',
		keybind: new Keybind({key: 'n', ctrl: true}),
		condition: () => Modes.edit,
		click: function () {
			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			var base_cube = new Cube({
				autouv: (settings.autouv.value ? 1 : 0)
			}).init()
			if (!base_cube.box_uv) base_cube.mapAutoUV()
			var group = getCurrentGroup();
			base_cube.addTo(group)

			if (Texture.all.length && Format.single_texture) {
				for (var face in base_cube.faces) {
					base_cube.faces[face].texture = Texture.getDefault().uuid
				}
				UVEditor.loadData()
			}
			if (Format.bone_rig) {
				var pos1 = group ? group.origin.slice() : [0, 0, 0];
				let size = Settings.get('default_cube_size');
				if (size % 2 == 0) {
					base_cube.extend({
						from:[ pos1[0] - size/2, pos1[1] - 0,    pos1[2] - size/2 ],
						to:[   pos1[0] + size/2, pos1[1] + size, pos1[2] + size/2 ],
						origin: pos1.slice()
					})
				} else {
					base_cube.extend({
						from:[ pos1[0], pos1[1], pos1[2] ],
						to:[   pos1[0]+size, pos1[1]+size, pos1[2]+size ],
						origin: pos1.slice()
					})
				}
			}

			if (Group.selected) Group.selected.unselect()
			base_cube.select()
			Canvas.updateView({elements: [base_cube], element_aspects: {transform: true, geometry: true}})
			Undo.finishEdit('Add cube', {outliner: true, elements: selected, selection: true});
			Blockbench.dispatchEvent( 'add_cube', {object: base_cube} )

			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					base_cube.rename()
				}
			})
			return base_cube
		}
	})

	new Action({
		id: 'edit_material_instances',
		icon: 'fas.fa-adjust',
		category: 'edit',
		condition: {modes: ['edit'], formats: ['bedrock_block'], method: () => Cube.selected.length && !Cube.selected.find(cube => cube.box_uv)},
		click: function () {
			let form = {};

			let first = Cube.selected[0];
			for (var key in first.faces) {
				let face = first.faces[key];
				if (face.texture != null) {
					form[key] = {
						label: `face.${key}`,
						value: face.material_name
					}
				}
			}

			let dialog = new Dialog({
				id: 'material_instances',
				title: 'dialog.material_instances.title',
				width: 460,
				form,
				onConfirm: form_data => {
					dialog.hide();
					
					Undo.initEdit({elements: Cube.selected});
					Cube.selected.forEach(cube => {
						for (var key in cube.faces) {
							let face = cube.faces[key];
							if (face.texture != null && typeof form_data[key] == 'string') {
								face.material_name = form_data[key];
							}
						}
					})
					Undo.finishEdit('Edit material instances')
				}
			})
			dialog.show();
		}
	})

	new BarSelect('cube_uv_mode', {
		name: 'dialog.project.uv_mode',
		category: 'uv',
		condition: () => Cube.selected.length && Format.optional_box_uv,
		options: {
			face_uv: 'dialog.project.uv_mode.face_uv',
			box_uv: 'dialog.project.uv_mode.box_uv',
		},
		onChange() {
			let box_uv = this.value == 'box_uv';
			Undo.initEdit({elements: Cube.selected, uv_only: true});
			Cube.selected.forEach(cube => {
				cube.setUVMode(box_uv);
			})
			Undo.finishEdit('Change UV mode')
			updateSelection();
		}
	})
	Blockbench.on('update_selection', () => {
		if (Condition(BarItems.cube_uv_mode)) {
			BarItems.cube_uv_mode.set(Cube.selected[0].box_uv ? 'box_uv' : 'face_uv');
		}
	})
})