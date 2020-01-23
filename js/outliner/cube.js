
class Face {
	constructor(direction, data) {
		this.direction = direction || 'north';
		this.reset()
		this.uv = [0, 0, canvasGridSize(), canvasGridSize()]
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
	extend(object) {
		if (object.texture === null) {
			this.texture = null;
		} else if (object.texture === false) {
			this.texture = false;
		} else if (textures.includes(object.texture)) {
			this.texture = object.texture.uuid;
		} else if (typeof object.texture === 'string') {
			Merge.string(this, object, 'texture')
		}
		Merge.string(this, object, 'cullface')
		Merge.number(this, object, 'rotation')
		Merge.boolean(this, object, 'tint')
		if (object.uv) {
			Merge.number(this.uv, object.uv, 0)
			Merge.number(this.uv, object.uv, 1)
			Merge.number(this.uv, object.uv, 2)
			Merge.number(this.uv, object.uv, 3)
		}
		return this;
	}
	reset() {
		this.uv = [0, 0, 0, 0];
		this.rotation = 0;
		this.texture = false;
		this.cullface = '';
		this.enabled = true;
		this.tint = false;
		return this;
	}
	getTexture() {
		if (Format.single_texture && Project.box_uv) {
			return textures[0];
		}
		if (typeof this.texture === 'string') {
			return textures.findInArray('uuid', this.texture)
		} else {
			return this.texture;
		}
	}
	getSaveCopy() {
		var copy = new oneLiner({
			uv: this.uv,
		})
		if (this.rotation) copy.rotation = this.rotation;
		var tex = this.getTexture()
		if (tex === null) {
			copy.texture = null;
		} else if (tex instanceof Texture) {
			copy.texture = textures.indexOf(tex)
		}
		if (this.tint) {
			copy.tint = true;
		}
		if (this.cullface) {
			copy.cullface = this.cullface;
		}
		if (!this.enabled) {
			copy.enabled = false;
		}
		return copy;
	}
}

class Cube extends NonGroup {
	constructor(data, uuid) {
		super(data, uuid)
		let size = canvasGridSize();
		this.name = 'cube';
		this.from = [0, 0, 0];
		this.to = [size, size, size];
		this.shade = true;
		this.mirror_uv = false;
		this.color = Math.floor(Math.random()*8)
		this.uv_offset = [0,0]
		this.inflate = 0;
		this.rotation = [0, 0, 0]
		if (Format.centered_grid) {
			this.origin = [0, 0, 0]	
		} else {
			this.origin = [8, 8, 8]	
		}
		this.visibility = true;
		this.autouv = 0
		this.export = true;
		this.parent = 'root';

		this.faces = {
			north: 	new Face('north'),
			east: 	new Face('east'),
			south: 	new Face('south'),
			west: 	new Face('west'),
			up: 	new Face('up'),
			down: 	new Face('down')
		}
		if (data && typeof data === 'object') {
			this.extend(data)
		}
	}
	extend(object) {
		Merge.string(this, object, 'name')
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
					this.rotation = [0, 0, 0]
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
		Merge.boolean(this, object, 'rescale')
		Merge.string(this, object, 'rotation_axis')
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
		if (Format.single_texture && textures[0]) {
			for (var face in this.faces) {
				this.faces[face].texture = textures[0].uuid
			}
		}
		if (!this.parent || (this.parent === 'root' && Outliner.root.indexOf(this) === -1)) {
			this.addTo('root')
		}
		if (!this.mesh || !this.mesh.parent) {
			Canvas.addCube(this)
		}
		TickUpdates.outliner = true;
		return this;
	}
	size(axis, floored) {
		var scope = this;
		function getA(axis) {
			if (floored === true) {
				var n = Math.floor(0.0000001 + scope.to[axis] - scope.from[axis]) 
				return n;
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
		return Canvas.meshes[this.uuid];
	}
	get index() {
		return elements.indexOf(this)
	}
	remove() {
		super.remove();
		if (this.visibility) {
			var mesh = this.mesh
			if (mesh) {
				if (mesh.parent) {
					mesh.parent.remove(mesh)
				}
				delete Canvas.meshes[this.uuid]
				mesh.geometry.dispose()
			}
		}
		delete Canvas.meshes[this.uuid]
		if (Transformer.dragging) {
			outlines.remove(outlines.getObjectByName(this.uuid+'_ghost_outline'))
		}
		delete this;
	}
	getUndoCopy(aspects) {
		var copy = new Cube(this)
		if (aspects.uv_only) {
			copy = {
				uv_offset: copy.uv_offset,
				faces: copy.faces,
				mirror_uv: copy.mirror_uv,
			}
		}
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy(meta) {
		var el = {
			name: this.name,
			from: this.from,
			to: this.to,
			autouv: this.autouv,
			color: this.color
		}
		if (!this.visibility) el.visibility = false;
		if (!this.export) el.export = false;
		if (!this.shade) el.shade = false;
		if (this.inflate) el.inflate = this.inflate;
		if (!this.rotation.allEqual(0)) el.rotation = this.rotation;
		el.origin = this.origin;
		if (!this.uv_offset.allEqual(0)) el.uv_offset = this.uv_offset;
		if (!meta || !meta.box_uv) {
			el.faces = {}
			for (var face in this.faces) {
				el.faces[face] = this.faces[face].getSaveCopy()
			}
		}
		el.uuid = this.uuid
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
			this.from = rotateCoord(this.from, 1, origin)
			this.to = rotateCoord(this.to, 1, origin)
			if (origin != this.origin) {
				this.origin = rotateCoord(this.origin, 1, origin)
			}
			if (!Project.box_uv) {
				if (axis === 0) {
					this.faces.west.rotation = rotateUVFace(this.faces.west.rotation, 1)
					this.faces.east.rotation = rotateUVFace(this.faces.east.rotation, 3)
					this.faces.north.rotation= rotateUVFace(this.faces.north.rotation, 2)
					this.faces.down.rotation = rotateUVFace(this.faces.down.rotation, 2)

					var temp = new Face(true, this.faces.north)
					this.faces.north.extend(this.faces.down)
					this.faces.down.extend(this.faces.south)
					this.faces.south.extend(this.faces.up)
					this.faces.up.extend(temp)

				} else if (axis === 1) {

					this.faces.up.rotation= rotateUVFace(this.faces.up.rotation, 1)
					this.faces.down.rotation = rotateUVFace(this.faces.down.rotation, 3)

					var temp = new Face(true, this.faces.north)
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

					var temp = new Face(true, this.faces.east)
					this.faces.east.extend(this.faces.down)
					this.faces.down.extend(this.faces.west)
					this.faces.west.extend(this.faces.up)
					this.faces.up.extend(temp)
				}


				//Fine Rotations
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
			}
		}
		Canvas.adaptObjectPosition(this)
		Canvas.adaptObjectFaces(this)
		Canvas.updateUV(this)
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
			var x = new Face(switchFaces[1], this.faces[switchFaces[0]])
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
		Canvas.adaptObjectPosition(this)
		Canvas.adaptObjectFaces(this)
		Canvas.updateUV(this)
	}
	transferOrigin(origin) {
		if (!this.mesh) return;
		var q = new THREE.Quaternion().copy(this.mesh.quaternion)
		var shift = new THREE.Vector3(
			this.origin[0] - origin[0],
			this.origin[1] - origin[1],
			this.origin[2] - origin[2],
		)
		var dq = new THREE.Vector3().copy(shift)
		dq.applyQuaternion(q)
		shift.sub(dq)
		shift.applyQuaternion(q.inverse())

		this.moveVector(shift)

		this.origin = origin.slice();

		Canvas.adaptObjectPosition(this)
		return this;
	}
	getWorldCenter() {
		var m = this.mesh;
		var pos = new THREE.Vector3(
			this.from[0] + this.size(0)/2,
			this.from[1] + this.size(1)/2,
			this.from[2] + this.size(2)/2
		)
		pos.x -= this.origin[0]
		pos.y -= this.origin[1]
		pos.z -= this.origin[2]

		if (m) {
			var r = m.getWorldQuaternion(new THREE.Quaternion())
			pos.applyQuaternion(r)
			pos.add(m.getWorldPosition(new THREE.Vector3()))
		}
		return pos;
	}
	setColor(index) {
		this.color = index;
		if (this.visibility) {
			Canvas.adaptObjectFaces(this)
		}
	}
	applyTexture(texture, faces) {
		var scope = this;
		if (faces === true || Project.box_uv) {
			var sides = ['north', 'east', 'south', 'west', 'up', 'down']
		} else if (faces === undefined) {
			var sides = [main_uv.face]
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
			scope.faces[side].texture = value
		})
		if (selected.indexOf(this) === 0) {
			main_uv.loadData()
		}
		if (!Prop.wireframe && scope.visibility == true) {
			Canvas.adaptObjectFaces(scope)
			Canvas.updateUV(scope)
		}
	}
	mapAutoUV() {
		if (Blockbench.box_uv) return;
		var scope = this;
		var pw = Project.texture_width;
		var ph = Project.texture_height;
		if (scope.autouv === 2) {
			//Relative UV
			function gt(n) {
				return (n+16)%16
			}
			var all_faces = ['north', 'south', 'west', 'east', 'up', 'down']
			all_faces.forEach(function(side) {
				var uv = scope.faces[side].uv.slice()
				var texture = scope.faces[side]
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
				//var fr_u = 16 / Project.texture_width;
				//var fr_v = 16 / Project.texture_height;
				//uv.forEach(function(s, uvi) {
				//	s *= (uvi%2 ? fr_v : fr_u);
				//	uv[uvi] = limitNumber(s, 0, 16)
				//})
				scope.faces[side].uv = uv
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
				//size[0] *= 16/Project.texture_width;
				//size[1] *= 16/Project.texture_height;
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
	move(val, axis, move_origin) {

		var size = this.size(axis);
		val+= this.from[axis];
		var in_box = val;
		val = limitToBox(limitToBox(val, -this.inflate) + size, this.inflate) - size;
		in_box = Math.abs(in_box - val) < 1e-4;
		val -= this.from[axis];

		//Move
		if (Blockbench.globalMovement && Format.bone_rig && !move_origin) {
			var m = new THREE.Vector3();
			m[getAxisLetter(axis)] = val;

			var rotation = new THREE.Quaternion();
			this.mesh.getWorldQuaternion(rotation);
			m.applyQuaternion(rotation.inverse());

			this.from[0] += m.x;
			this.from[1] += m.y;
			this.from[2] += m.z;
			this.to[0]	+= m.x;
			this.to[1]	+= m.y;
			this.to[2]	+= m.z;

		} else {
			this.to[axis] += val;
			this.from[axis] += val;
		}
		//Origin
		if (Blockbench.globalMovement && move_origin) {
			this.origin[axis] += val;
		}
		this.mapAutoUV()
		Canvas.adaptObjectPosition(this);
		TickUpdates.selection = true;
		return in_box;
	}
	moveVector(arr, axis) {
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
			val = limitToBox(limitToBox(val, -scope.inflate) + size, scope.inflate) - size
			if (Math.abs(val_before - val) >= 1e-4) in_box = false;
			val -= scope.from[i]

			scope.from[i] += val;
			scope.to[i] += val;
		})
		this.mapAutoUV()
		Canvas.adaptObjectPosition(this);
		TickUpdates.selection = true;
		return in_box;
	}
	resize(val, axis, negative, allow_negative) {
		var before = this.oldScale != undefined ? this.oldScale : this.size(axis);
		var modify = val instanceof Function ? val : n => (n+val)
		if (Format.integer_size && Project.box_uv) {
			val = Math.ceil(val);
		}
		if (!negative) {
			var pos = limitToBox(this.from[axis] + modify(before), this.inflate);
			if (pos >= this.from[axis] || settings.negative_size.value || allow_negative) {
				this.to[axis] = pos;
			} else {
				this.to[axis] = this.from[axis];
			}
		} else {
			var pos = limitToBox(this.to[axis] + modify(-before), this.inflate);
			if (pos <= this.to[axis] || settings.negative_size.value || allow_negative) {
				this.from[axis] = pos;
			} else {
				this.from[axis] = this.to[axis];
			}
		}
		this.mapAutoUV();
		if (Project.box_uv) {
			Canvas.updateUV(this);
		}
		Canvas.adaptObjectPosition(this);
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
		'copy',
		'duplicate',
		'rename',
		'update_autouv',
		{name: 'menu.cube.color', icon: 'color_lens', children: [
			{icon: 'bubble_chart', color: markerColors[0].standard, name: 'cube.color.'+markerColors[0].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(0)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[1].standard, name: 'cube.color.'+markerColors[1].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(1)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[2].standard, name: 'cube.color.'+markerColors[2].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(2)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[3].standard, name: 'cube.color.'+markerColors[3].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(3)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[4].standard, name: 'cube.color.'+markerColors[4].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(4)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[5].standard, name: 'cube.color.'+markerColors[5].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(5)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[6].standard, name: 'cube.color.'+markerColors[6].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(6)}, 'change color')}},
			{icon: 'bubble_chart', color: markerColors[7].standard, name: 'cube.color.'+markerColors[7].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(7)}, 'change color')}}
		]},
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
			textures.forEach(function(t) {
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
	Cube.prototype.buttons = [
		Outliner.buttons.remove,
		Outliner.buttons.visibility,
		Outliner.buttons.export,
		Outliner.buttons.shading,
		Outliner.buttons.autouv
	];
	Cube.selected = [];
	Cube.all = [];


BARS.defineActions(function() {
	new Action({
		id: 'add_cube',
		icon: 'add_box',
		category: 'edit',
		keybind: new Keybind({key: 78, ctrl: true}),
		condition: () => Modes.edit,
		click: function () {
			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			var base_cube = new Cube({
				autouv: (settings.autouv.value ? 1 : 0)
			}).init()
			var group = getCurrentGroup();
			base_cube.addTo(group)

			if (textures.length && Format.single_texture) {
				for (var face in base_cube.faces) {
					base_cube.faces[face].texture = textures[0].uuid
				}
				main_uv.loadData()
			}
			if (Format.bone_rig) {
				if (group) {
					var pos1 = group.origin.slice()
					base_cube.extend({
						from:[ pos1[0]-0, pos1[1]-0, pos1[2]-0 ],
						to:[   pos1[0]+1, pos1[1]+1, pos1[2]+1 ],
						origin: pos1.slice()
					})
				}
			}

			if (Group.selected) Group.selected.unselect()
			base_cube.select()
			Canvas.updateSelected()
			loadOutlinerDraggable()
			Undo.finishEdit('add_cube', {outliner: true, elements: selected, selection: true});
			Blockbench.dispatchEvent( 'add_cube', {object: base_cube} )

			Vue.nextTick(function() {
				updateSelection()
				if (settings.create_rename.value) {
					base_cube.rename()
				}
			})
			return base_cube
		}
	})
})