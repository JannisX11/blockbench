//Buttons
var OutlinerButtons = {
	remove: {
		id: 'remove',
		title: tl('generic.delete'),
		icon: ' fa fa-times',
		icon_off: ' fa fa-times',
		advanced_option: false,
		click: function(obj) {
			if (obj.type === 'group') {
				obj.remove(true);
				return;
			}
			Undo.initEdit({cubes: obj.forSelected(), outliner: true, selection: true})
			obj.forSelected(function(cube) {
				cube.remove()
			})
			updateSelection()
			Undo.finishEdit('remove', {cubes: [], outliner: true, selection: true})
		}
	},
	visibility: {
		id: 'visibility',
		title: tl('switches.visibility'),
		icon: ' fa fa-eye',
		icon_off: ' fa fa-eye-slash',
		advanced_option: false,
		click: function(obj) {
			obj.toggle('visibility')
		}
	},
	export: {
		id: 'export',
		title: tl('switches.export'),
		icon: ' fa fa-camera',
		icon_off: ' fa fa-window-close-o',
		advanced_option: true,
		click: function(obj) {
			obj.toggle('export')
		}
	},
	shading: {
		id: 'shading',
		get title() {return Blockbench.entity_mode ? tl('switches.mirror') : tl('switches.shading')},
		get icon() {return Blockbench.entity_mode ? 'fa fa-star' : 'fa fa-star'},
		get icon_off() {return Blockbench.entity_mode ? 'fa fa-star-half-o' : 'fa fa-star-o'},
		advanced_option: true,
		click: function(obj) {
			obj.toggle('shade')
			Canvas.updateUVs()
		}
	},
	autouv: {
		id: 'autouv',
		title: tl('switches.autouv'),
		icon: ' fa fa-thumb-tack',
		icon_off: ' fa fa-times-circle-o',
		icon_alt: ' fa fa-magic',
		advanced_option: true,
		click: function(obj) {
			var state = obj.autouv+1
			if (state > 2) state = 0

			obj.toggle('autouv', state)
		}
	},
}
//Colors
var cubeColors = [
	{hex: "#A2EBFF", name: 'light_blue'},
	{hex: "#FFF899", name: 'yellow'},
	{hex: "#E8BD7B", name: 'orange'},
	{hex: "#FFA7A4", name: 'red'},
	{hex: "#C5A6E8", name: 'purple'},
	{hex: "#A6C8FF", name: 'blue'},
	{hex: "#7BFFA3", name: 'green'},
	{hex: "#BDFFA6", name: 'lime'}
]
var selected_group;
//Cubes
class Face {
	constructor(direction, data) {
		this.direction = direction || 'north';
		this.reset()
		this.uv = [0, 0, canvasGridSize(), canvasGridSize()]
		if (data) {
			this.extend(data)
		}
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
		Merge.number(copy, this, 'rotation')
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
class OutlinerElement {
	constructor(uuid) {
		this.uuid = uuid || guid()
	}
	sortInBefore(element, index_mod) {
		var index = -1;
		index_mod = index_mod || 0;

		if (element.parent === 'root') {
			index = TreeElements.indexOf(element)
			var arr = TreeElements
			this.parent = 'root'
		} else {
			index = element.parent.children.indexOf(element)
			element = element.parent
			var arr = element.children
			this.parent = element
		}
		this.removeFromParent()

		//Adding
		if (index < 0)
			arr.push(this)
		else {
			arr.splice(index+index_mod, 0, this)
		}

		TickUpdates.outliner = true;
		return this;
	}
	addTo(group) {
		//Remove
		var index = -1;

		//Resolve Group Argument
		if (group === undefined) {
			group = 'root'
		} else if (group !== 'root') {
			if (group.type === 'cube') {
				if (group.parent === 'root') {
					index = TreeElements.indexOf(group)+1
					group = 'root'
				} else {
					index = group.parent.children.indexOf(group)+1
					group = group.parent
				}
			}
		}
		this.removeFromParent()

		//Get Array
		if (group === 'root') {
			var arr = TreeElements
			this.parent = 'root'
		} else {
			var arr = group.children
			this.parent = group
		}

		//Adding
		if (arr.includes(this)) return this;
		if (index < 0)
			arr.push(this)
		else {
			arr.splice(index, 0, this)
		}

		//Loading
		TickUpdates.outliner = true;
		return this;
	}
	removeFromParent() {
		this.getParentArray().remove(this);
		return this;
	}
	getParentArray() {
		if (this.parent === 'root') {
			return TreeElements
		} else if (typeof this.parent === 'object') {
			return this.parent.children
		}
	}
	showInOutliner() {
		var scope = this;
		if (this.parent !== 'root') {
			this.parent.openUp()
		}
		Vue.nextTick(function(){
			scope.scrollOutlinerTo()
		})
	}
	scrollOutlinerTo() {
		var el = $('#'+this.uuid)
		if (el.length === 0) return;
		var outliner_pos = $('#outliner').offset().top

		var el_pos = el.offset().top
		if (el_pos > outliner_pos && el_pos < $('#cubes_list').height() + outliner_pos) return;

		var multiple = el_pos > outliner_pos ? 0.8 : 0.2
		var scroll_amount = el.offset().top  + $('#cubes_list').scrollTop() - outliner_pos - 20
		scroll_amount -= $('#cubes_list').height()*multiple - 15

		$('#cubes_list').animate({
			scrollTop: scroll_amount
		}, 200);
		return this;
	}
	updateElement() {
		var scope = this;
		var old_name = this.name;
		scope.name = '_&/3%6-7A';
		scope.name = old_name;
		return this;
	}
	getDepth() {
		var d = 0;
		function it(p) {
			if (p.parent) {
				d++;
				return it(p.parent)
			} else {
				return d-1;
			}
		}
		return it(this)
	}
	rename() {
		this.showInOutliner()
		var obj = $('#'+this.uuid+' > div.outliner_object > input.cube_name')
		obj.attr('disabled', false)
		obj.select()
		obj.focus()
		obj.addClass('renaming')
		Blockbench.addFlag('renaming')
		this.old_name = this.name
		return this;
	}
	saveName(save) {
		var scope = this;
		if (save !== false && scope.name.length > 0) {
			var name = scope.name
			scope.name = scope.old_name
			if (scope.type === 'cube') {
				Undo.initEdit({cubes: [scope]})
			} else {
				Undo.initEdit({outliner: true})
			}
			scope.name = name
			delete scope.old_name
			if (Blockbench.entity_mode && scope.type === 'group') {
				scope.createUniqueName()
			}
			Undo.finishEdit('rename')
		} else {
			scope.name = scope.old_name
			delete scope.old_name
		}
		return this;
	}
	isIconEnabled(btn) {
		switch (btn.id) {
			case 'visibility': 
				return this.visibility
				break;
			case 'export': 
				return this.export
				break;
			case 'shading': 
				return this.shade
				break;
			case 'autouv': 
				if (!this.autouv) {
					return false
				} else if (this.autouv === 1) {
					return true
				} else {
					return 'alt'
				}
				break;
		}
		return true;
	}
	isChildOf(group, max_levels) {
		function iterate(obj, level) {
			if (!obj || obj === 'root') {
				return false;
			} else if (obj === group) {
				return true;
			} else if (!max_levels || level < max_levels-1) {
				return iterate(obj.parent, level+1)
			}
			return false;
		}
		return iterate(this.parent, 0)
	}
	get mirror_uv() {
		return !this.shade;
	}
	set mirror_uv(val) {
		this.shade = !val;
	}
}
class Cube extends OutlinerElement {
	constructor(data, uuid) {
		super(uuid)
		let size = canvasGridSize();
		this.name = 'cube';
		this.from = [0, 0, 0];
		this.to = [size, size, size];
		this.shade = true;
		this.color = Math.floor(Math.random()*8)
		this.uv_offset = [0,0]
		this.inflate = 0;
		this.rotation = [0, 0, 0]
		if (Blockbench.entity_mode) {
			this.origin = [0, 0, 0]	
		} else {
			this.origin = [8, 8, 8]	
		}
		this.visibility = true;
		this.selected = true;
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
	init() {
		if (!elements.includes(this)) {
			elements.push(this)
		}
		if (Blockbench.entity_mode && textures[0]) {
			for (var face in this.faces) {
				this.faces[face].texture = textures[0].uuid
			}
			main_uv.loadData()
		}
		if (!this.parent || (this.parent === 'root' && TreeElements.indexOf(this) === -1)) {
			this.addTo('root')
		}
		if (this.visibility && (!this.mesh || !scene.children.includes(this.mesh))) {
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
				//if (!Blockbench.entity_mode && n === 0 && scope.to[axis] - scope.from[axis] > 0.02) {return 1}
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
	select(event, isOutlinerClick) {
		var scope = this;
		if (scope === undefined) return false;
		//Shiftv
		var just_selected = []
		if (event && event.shiftKey === true && scope.getParentArray().includes(selected[selected.length-1]) && isOutlinerClick) {
			var starting_point;
			var last_selected = selected[selected.length-1]
			scope.getParentArray().forEach(function(s, i) {
				if (s === last_selected || s === scope) {
					if (starting_point) {
						starting_point = false
					} else {
						starting_point = true
					}
					if (s.type !== 'group') {
						if (!selected.includes(s)) {
							selected.push(s)
							just_selected.push(s)
						}
					} else {
						s.selectLow()
					}
				} else if (starting_point) {
					if (s.type !== 'group') {
						if (!selected.includes(s)) {
							selected.push(s)
							just_selected.push(s)
						}
					} else {
						s.selectLow(false)
					}
				}
			})

		//Control
		} else if (event && (event.ctrlKey || event.shiftKey )) {
			if (selected.includes(scope)) {
				selected = selected.filter(function(e) {
					return e !== scope
				})
			} else {
				selected.push(scope)
				just_selected.push(scope)
			}


		//Normal
		} else {
			selected = [scope]
			just_selected.push(scope)
			scope.showInOutliner()
		}
		if (selected_group) {
			selected_group.unselect()
		}
		getAllOutlinerGroups().forEach(function(s) {
			s.selected = false;
		})
		Blockbench.dispatchEvent('added_to_selection', {added: just_selected})
		updateSelection()
		return this;
	}
	selectLow() {
		if (selected.includes(this) === false) {
			selected.push(this)
		}
	}
	extend(object) {
		Merge.string(this, object, 'name')
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
	remove() {
		TreeElements.clearObjectRecursive(this)
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
		selected.remove(this)
		elements.splice(this.index, 1)
		if (Transformer.dragging) {
			outlines.remove(outlines.getObjectByName(this.uuid+'_ghost_outline'))
		}
		delete this;
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
			if (!Blockbench.entity_mode) {
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
		var q = this.mesh.getWorldQuaternion(new THREE.Quaternion())
		var shift = new THREE.Vector3(
			this.origin[0] - origin[0],
			this.origin[1] - origin[1],
			this.origin[2] - origin[2],
		)
		var dq = new THREE.Vector3().copy(shift)
		dq.applyQuaternion(q)
		shift.sub(dq)
		shift.applyQuaternion(q.inverse())

		this.from[0] += shift.x;
		this.from[1] += shift.y;
		this.from[2] += shift.z;
		this.to[0] += shift.x;
		this.to[1] += shift.y;
		this.to[2] += shift.z;

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
		if (!Blockbench.entity_mode) {

			pos.x -= this.origin[0]
			pos.y -= this.origin[1]
			pos.z -= this.origin[2]
			var r = m.getWorldQuaternion(new THREE.Quaternion())
			pos.applyQuaternion(r)
			pos.x += this.origin[0]
			pos.y += this.origin[1]
			pos.z += this.origin[2]
		} else {
			var r = m.getWorldQuaternion(new THREE.Quaternion())
			pos.applyQuaternion(r)
			pos.add(m.getWorldPosition(new THREE.Vector3()))
			pos.x += 8
			pos.y += 8
			pos.z += 8
		}
		return pos;
	}
	setColor(index) {
		this.color = index;
		if (this.visibility) {
			Canvas.adaptObjectFaces(this)
		}
	}
	showContextMenu(event) {
		Prop.active_panel = 'outliner'
		if (!this.selected) {
			this.select()
		}
		this.menu.open(event, this)
		return this;
	}
	forSelected(fc, undo_tag) {
		if (selected.length <= 1 || !selected.includes(this)) {
			var edited = [this]
		} else {
			var edited = selected
		}
		if (typeof fc === 'function') {
			if (undo_tag) {
				Undo.initEdit({cubes: edited})
			}
			for (var i = 0; i < edited.length; i++) {
				fc(edited[i])
			}
			if (undo_tag) {
				Undo.finishEdit(undo_tag)
			}
		}
		return edited;
	}
	duplicate() {
		var old_group = this.parent
		var base_cube = new Cube(this)
		//Numberation
		var number = base_cube.name.match(/[0-9]+$/)
		if (number) {
			number = parseInt(number[0])
			base_cube.name = base_cube.name.split(number).join(number+1)
		}
		//Rest
		base_cube.addTo(old_group).init()
		var index = selected.indexOf(this)
		if (index >= 0) {
			selected[index] = base_cube
		} else {
			selected.push(base_cube)
		}
		TickUpdates.outliner = true;
		TickUpdates.selection = true;
	}
	applyTexture(texture, faces) {
		var scope = this;
		if (faces === true || Blockbench.entity_mode) {
			var sides = ['north', 'east', 'south', 'west', 'up', 'down']
		} else if (faces === undefined) {
			var sides = [main_uv.face]
		} else {
			var sides = faces
		}
		var id = null
		if (texture) {
			id = texture.uuid
		} else if (texture === 'blank') {
			id = undefined;
		}
		sides.forEach(function(side) {
			scope.faces[side].texture = id
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
		if (Blockbench.entity_mode) return;
		var scope = this
		if (scope.autouv === 2) {
			//Relative UV
			function gt(n) {
				return (n+16)%16
			}
			var all_faces = ['north', 'south', 'west', 'east', 'up', 'down']
			all_faces.forEach(function(side) {
				var uv = scope.faces[side].uv.slice()
				switch (side) {
					case 'north':
					uv = [
						16 - scope.to[0],
						16 - scope.to[1],
						16 - scope.from[0],
						16 - scope.from[1],
					];
					break;
					case 'south':
					uv = [
						scope.from[0],
						16 - scope.to[1],
						scope.to[0],
						16 - scope.from[1],
					];
					break;
					case 'west':
					uv = [
						scope.from[2],
						16 - scope.to[1],
						scope.to[2],
						16 - scope.from[1],
					];
					break;
					case 'east':
					uv = [
						16 - scope.to[2],
						16 - scope.to[1],
						16 - scope.from[2],
						16 - scope.from[1],
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
						16 - scope.to[2],
						scope.to[0],
						16 - scope.from[2],
					];
					break;
				}
				uv.forEach(function(s, uvi) {
					uv[uvi] = limitNumber(s, 0, 16)
					uv[uvi] *= 16 / (uvi%2 ? Project.texture_height : Project.texture_width)
				})
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
				//Limit Input to 16
				size.forEach(function(s) {
					if (s > 16) {
						s = 16
					}
				})
				//Calculate End Points
				var x = sx + size[0]
				var y = sy + size[1]
				//Prevent Over 16
				if (x > 16) {
					sx = 16 - (x - sx)
					x = 16
				}
				if (y > 16) {
					sy = 16 - (y - sy)
					y = 16
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
			scope.faces.up.uv =	calcAutoUV('up',	[scope.size(0), scope.size(2)])
			scope.faces.down.uv =  calcAutoUV('down',  [scope.size(0), scope.size(2)])

			Canvas.updateUV(scope)
		}
	}
	toggle(key, val) {
		if (val === undefined) {
			var val = !this[key]
		}
		this.forSelected((cube) => {
			cube[key] = val
		}, 'toggle '+key)
		if (key === 'visibility') {
			Canvas.updateVisibility()
		}
		return this;
	}
}
	Cube.prototype.title = tl('data.cube')
	Cube.prototype.type = 'cube'
	Cube.prototype.icon = 'fa fa-cube'
	Cube.prototype.isParent = false
	Cube.prototype.buttons = [
		OutlinerButtons.remove,
		OutlinerButtons.visibility,
		OutlinerButtons.export,
		OutlinerButtons.shading,
		OutlinerButtons.autouv
	]
	Cube.prototype.menu = new Menu([
		'copy',
		{name: 'menu.cube.duplicate', icon: 'content_copy', click: function(cube) {

			Undo.initEdit({outliner: true, cubes: [], selection: true});
			cube.forSelected(function(obj) {
				obj.duplicate(false)
			})
			TickUpdates.outliner = true;
			updateSelection()
			Undo.finishEdit('duplicate', {outliner: true, cubes: selected, selection: true})
		}},
		{name: 'generic.rename', icon: 'text_format', click: renameOutliner},
		'update_autouv',
		{name: 'menu.cube.color', icon: 'color_lens', children: [
			{icon: 'bubble_chart', color: cubeColors[0].hex, name: 'cube.color.'+cubeColors[0].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(0)}, 'change color')}},
			{icon: 'bubble_chart', color: cubeColors[1].hex, name: 'cube.color.'+cubeColors[1].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(1)}, 'change color')}},
			{icon: 'bubble_chart', color: cubeColors[2].hex, name: 'cube.color.'+cubeColors[2].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(2)}, 'change color')}},
			{icon: 'bubble_chart', color: cubeColors[3].hex, name: 'cube.color.'+cubeColors[3].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(3)}, 'change color')}},
			{icon: 'bubble_chart', color: cubeColors[4].hex, name: 'cube.color.'+cubeColors[4].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(4)}, 'change color')}},
			{icon: 'bubble_chart', color: cubeColors[5].hex, name: 'cube.color.'+cubeColors[5].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(5)}, 'change color')}},
			{icon: 'bubble_chart', color: cubeColors[6].hex, name: 'cube.color.'+cubeColors[6].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(6)}, 'change color')}},
			{icon: 'bubble_chart', color: cubeColors[7].hex, name: 'cube.color.'+cubeColors[7].name, click: function(cube) {cube.forSelected(function(obj){obj.setColor(7)}, 'change color')}}
		]},
		{name: 'menu.cube.texture', icon: 'collections', condition: function() {return !Blockbench.entity_mode}, children: function() {
			var arr = [
				{icon: 'crop_square', name: 'menu.cube.texture.blank', click: function(cube) {
					cube.forSelected(function(obj) {
						obj.applyTexture('blank', true)
					}, 'texture blank')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', click: function(cube) {
					cube.forSelected(function(obj) {
						obj.applyTexture(undefined, true)
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
	])
class Group extends OutlinerElement {
	constructor(data) {
		super()
		this.name = Blockbench.entity_mode ? 'bone' : 'group'
		this.children = []
		if (Blockbench.entity_mode) {
			this.origin = [0, 0, 0];
		} else {
			this.origin = [8, 8, 8];
		}
		this.rotation = [0, 0, 0];
		this.reset = false;
		this.shade = true;
		this.material;
		this.selected = false;
		this.visibility = true;
		this.export = true;
		this.autouv = 0;
		this.parent = 'root';
		this.isOpen = false;

		if (typeof data === 'object') {
			this.extend(data)
		} else if (typeof data === 'string') {
			this.name = data
		}
	}
	getMesh() {
		return this.mesh;
	}
	get mesh() {
		var bone = Canvas.bones[this.uuid]
		if (!bone) {
			bone = new THREE.Object3D()
			bone.name = this.name
			bone.isGroup = true
			Canvas.bones[this.uuid] = bone
		}
		return bone;
	}
	select(event) {
		var scope = this;
		if (Blockbench.hasFlag('renaming')) return;
		if (!event) event = true
		var allSelected = selected_group === this && selected.length && this.matchesSelection()

		//Clear Old Group
		if (selected_group) selected_group.unselect()
		if (event.shiftKey !== true && event.ctrlKey !== true) {
			selected.length = 0
		}
		//Select This Group
		getAllOutlinerGroups().forEach(function(s) {
			s.selected = false
		})
		this.selected = true
		selected_group = this

		//Select / Unselect Children
		if (allSelected && event.which === 1) {
			//Select Only Group, unselect Children
			selected.length = 0
		} else {
			scope.children.forEach(function(s) {
				s.selectLow()
			})
		}
		updateSelection()
		return this;
	}
	selectChildren(event) {
		var scope = this;
		if (Blockbench.hasFlag('renaming')) return;
		if (!event) event = {shiftKey: false}
		var firstChildSelected = false

		//Clear Old Group
		if (selected_group) selected_group.unselect()
		selected.length = 0

		//Select This Group
		getAllOutlinerGroups().forEach(function(s) {
			s.selected = false
		})
		this.selected = true
		selected_group = this

		scope.children.forEach(function(s) {
			s.selectLow()
		})
		updateSelection()
		return this;
	}
	selectLow(highlight) {
		//Only Select
		if (highlight !== false) {
			this.selected = true
		}
		this.children.forEach(function(s) {
			s.selectLow(highlight)
		})
		return this;
	}
	unselect() {
		if (this.selected === false) return;
		selected_group = undefined;
		this.selected = false
		return this;
	}
	matchesSelection() {
		var scope = this;
		var match = true;
		for (var i = 0; i < selected.length; i++) {
			if (!selected[i].isChildOf(scope, 20)) {
				return false
			}
		}
		this.forEachChild(obj => {
			if (!obj.selected) {
				match = false
			}
		})
		return match;
	}
	extend(object) {
		Merge.string(this, object, 'name')
		Merge.boolean(this, object, 'shade')
		Merge.boolean(this, object, 'mirror_uv')
		Merge.boolean(this, object, 'reset')
		Merge.string(this, object, 'material')
		if (object.origin) {
			Merge.number(this.origin, object.origin, 0)
			Merge.number(this.origin, object.origin, 1)
			Merge.number(this.origin, object.origin, 2)
		}
		if (object.rotation) {
			Merge.number(this.rotation, object.rotation, 0)
			Merge.number(this.rotation, object.rotation, 1)
			Merge.number(this.rotation, object.rotation, 2)
		}
		Merge.number(this, object, 'autouv')
		Merge.boolean(this, object, 'export')
		Merge.boolean(this, object, 'visibility')
		return this;
	}
	openUp() {
		this.isOpen = true
		this.updateElement()
		if (this.parent && this.parent !== 'root') {
			this.parent.openUp()
		}
		return this;
	}
	remove(undo) {
		if (undo) {
			var cubes = []
			this.forEachChild(function(element) {
				if (element.type === 'cube') {
					cubes.push(element)
				}
			})
			Undo.initEdit({cubes: cubes, outliner: true, selection: true})
		}
		this.unselect()
		var i = this.children.length-1
		while (i >= 0) {
			this.children[i].remove(false)
			i--;
		}
		if (typeof this.parent === 'object') {
			this.parent.children.remove(this)
		} else {
			TreeElements.remove(this)
		}
		TickUpdates.selection = true
		if (undo) {
			cubes.length = 0
			Undo.finishEdit('removed_group')
		}
	}
	createUniqueName(group_arr) {
		var scope = this;
		var others = getAllOutlinerGroups();
		if (group_arr && group_arr.length) {
			group_arr.forEach(g => {
				others.safePush(g)
			})
		}
		var name = this.name.replace(/\d+$/, '');
		function check(n) {
			for (var i = 0; i < others.length; i++) {
				if (others[i] !== scope && others[i].name == n) return false;
			}
			return true;
		}
		if (check(this.name)) {
			return this.name;
		}
		for (var num = 2; num < 2e3; num++) {
			if (check(name+num)) {
				scope.name = name+num;
				return scope.name;
			}
		}
		return false;
	}
	resolve() {
		var scope = this;
		var array

		if (array == undefined) {
			array = this.children.slice(0)
		}
		if (array.constructor !== Array) {
			array = [array]
		} else {
			array.reverse()
		}
		array.forEach(function(s, i) {
			s.addTo(scope.parent)
		})
		TickUpdates.outliner = true;
		TreeElements.clearObjectRecursive(this)
		selected_group = undefined
		delete this
		return array
	}
	showContextMenu(event) {
		Prop.active_panel = 'outliner'
		this.select(event)
		this.menu.open(event, this)
		return this;
	}
	setMaterial(material) {
		var scope = this;
		Blockbench.textPrompt('message.bone_material', scope.material, function(id) {
			Undo.initEdit({outliner: true})
			if (id) {
				scope.material = id
			} else {
				delete scope.material
			}
			Undo.finishEdit('bone_material')
		})
		return this;
	}
	sortContent() {
		Undo.initEdit({outliner: true})
		if (this.children.length < 1) return;
		this.children.sort(function(a,b) {
			return sort_collator.compare(a.name, b.name)
		});
		Undo.finishEdit('sort')
		return this;
	}
	duplicate(destination) {
		var copied_groups = [];
		function duplicateArray(g1, g2) {
			var array = g1.children
			var i = 0;
			while (i < array.length) {
				if (array[i].type !== 'group') {
					var copy = new Cube(array[i])
					copy.addTo(g2)
					if (destination === 'cache') {
						copy.parent = undefined;
					} else {
						copy.init(false)
					}
				} else {
					var copy = array[i].getChildlessCopy()
					copy.addTo(g2)
					if (destination == 'cache') {
						copy.parent = undefined;
					} else if (Blockbench.entity_mode) {
						copy.createUniqueName(copied_groups)
					}
					copied_groups.push(copy)
					duplicateArray(array[i], copy)
				}
				i++;
			}
		}
		var base_group = this.getChildlessCopy()
		if (destination !== 'cache') {
			base_group.createUniqueName()
			copied_groups.push(base_group)
		}
		duplicateArray(this, base_group)
		base_group.parent = undefined;

		if (!destination) {
			base_group.sortInBefore(this, 1).select()
		} else if (destination !== 'cache') {
			base_group.addTo(destination)
		}
		if (destination !== 'cache') {
			Canvas.updatePositions()
			TickUpdates.outliner = true;
		}
		return base_group;
	}
	getChildlessCopy() {
		var base_group = new Group();
		base_group.name = this.name;
		base_group.origin = this.origin.slice();
		base_group.rotation = this.rotation.slice();
		base_group.shade = this.shade;
		base_group.material = this.material;
		base_group.reset = this.reset;
		base_group.visibility = this.visibility;
		base_group.export = this.export;
		base_group.autouv = this.autouv;
		return base_group;
	}
	compile(undo) {
		var obj = {
			name: this.name
		}
		if (this.shade == false) {
			obj.shade = false
		}
		if (this.material) {
			obj.material = this.material
		}
		if (undo) {
			obj.uuid = this.uuid;
			obj.export = this.export;
			obj.isOpen = this.isOpen === true;
			obj.visibility = this.visibility;
			obj.autouv = this.autouv;
		}
		if (this.origin.join('_') !== '8_8_8' || Blockbench.entity_mode) {
			obj.origin = this.origin.slice()
		}
		if (this.rotation.join('_') !== '0_0_0') {
			obj.rotation = this.rotation.slice()
		}
		if (this.reset) {
			obj.reset = true
		}
		obj.children = []
		return obj;
	}
	forEachChild(cb, type, forSelf) {
		var i = 0
		if (forSelf) {
			cb(this)
		}
		while (i < this.children.length) {
			if (!type || this.children[i].type === type) {
				cb(this.children[i])
			}
			if (this.children[i].type === 'group') {
				this.children[i].forEachChild(cb, type)
			}
			i++;
		}
	}
	toggle(key, val) {
		if (val === undefined) {
			var val = !this[key]
		}
		var cubes = []
		this.forEachChild(obj => {
			cubes.push(obj)
		}, 'cube')
		Undo.initEdit({outliner: true, cubes: cubes})
		if (!Blockbench.entity_mode || key !=='shade') {
			this.forEachChild(function(s) {
				s[key] = val
				s.updateElement()
			})
		}
		this[key] = val;
		this.updateElement()
		if (key === 'visibility') {
			Canvas.updateVisibility()
		}
		Undo.finishEdit('toggle')
	}
	setAutoUV(val) {
		this.forEachChild(function(s) {
			s.autouv = val;
			s.updateElement()
		})
		this.autouv = val;
		this.updateElement()
	}
}
	Group.prototype.title = tl('data.group')
	Group.prototype.type = 'group'
	Group.prototype.icon = 'fa fa-folder'
	Group.prototype.isParent = true
	Group.prototype.buttons = [
		OutlinerButtons.remove,
		OutlinerButtons.visibility,
		OutlinerButtons.export,
		OutlinerButtons.shading,
		OutlinerButtons.autouv
	]
	Group.prototype.menu = new Menu([
		'copy',
		'paste',
		{icon: 'layers', name: 'menu.group.material', condition: () => Blockbench.entity_mode, click: function(group) {group.setMaterial()}},
		'_',
		{icon: 'content_copy', name: 'menu.group.duplicate', click: function(group) {
			var cubes_before = elements.length
			Undo.initEdit({outliner: true, cubes: [], selection: true})
			group.duplicate()
			Undo.finishEdit('duplicate_group', {outliner: true, cubes: elements.slice().slice(cubes_before), selection: true})
		}},
		'rename',
		{icon: 'sort_by_alpha', name: 'menu.group.sort', click: function(group) {group.sortContent()}},
		{icon: 'fa-leaf', name: 'menu.group.resolve', click: function(group) {
			Undo.initEdit({outliner: true})
			group.resolve()
			Undo.finishEdit('group resolve')
		}},
	])
Array.prototype.clearObjectRecursive = function(obj) {
	var i = 0
	while (i < this.length) {
		if (this[i] === obj) {
			this.splice(this.indexOf(obj), 1)
		} else if (this[i].children && this[i].children.length > 0) {
			this[i].children.clearObjectRecursive(obj)
		}
		i++;
	}
}
Array.prototype.findRecursive = function(key1, val) {
	var i = 0
	while (i < this.length) {
		if (this[i][key1] === val) {
			return this[i];
		} else if (this[i].children && this[i].children.length > 0) {
			let inner = this[i].children.findRecursive(key1, val)
			if (inner !== undefined) {
				return inner;
			}
		}
		i++;
	}
	return undefined;
}

function forOutlinerSelection(item, cb) {
	if (selected.length > 1 && selected.includes(item)) {
		var items = selected
	} else {
		var items = [item]
	}
	items.forEach(function(item) {
		cb(item)
	})
}

function getAllOutlinerObjects() {
	var ta = []
	function iterate(array) {
		var i = 0;
		while (i < array.length) {
			ta.push(array[i])
			if (array[i].children && array[i].children.length > 0) {
				iterate(array[i].children)
			}
			i++;
		}
	}
	iterate(TreeElements)
	return ta;
}
function getAllOutlinerGroups() {
	var ta = []
	function iterate(array) {
		var i = 0;
		while (i < array.length) {
			if (array[i].type === 'group')
				ta.push(array[i])
				if (array[i].children && array[i].children.length > 0) {
					iterate(array[i].children)
				}
			i++;
		}
	}
	iterate(TreeElements)
	return ta;
}
function compileGroups(undo, lut) {
	var result = []
	function iterate(array, save_array) {
		var i = 0;
		while (i < array.length) {
			if (array[i].type === 'cube') {
				if (undo) {
					save_array.push(array[i].uuid)
				} else {
					if (lut) {
						var index = lut[elements.indexOf(array[i])]
					} else {
						var index = elements.indexOf(array[i])
					}
					if (index >= 0) {
						save_array.push(index)
					}
				}
			} else if (array[i].type === 'group') {

				if (lut === undefined || array[i].export === true) {

					var obj = array[i].compile(undo)

					if (array[i].children.length > 0) {
						iterate(array[i].children, obj.children)
					}
					save_array.push(obj)
				}
			}
			i++;
		}
	}
	iterate(TreeElements, result)
	return result;
}
function parseGroups(array, importGroup, startIndex) {
	function iterate(array, save_array, addGroup) {
		var i = 0;
		while (i < array.length) {
			if (typeof array[i] === 'number' || typeof array[i] === 'string') {

				if (typeof array[i] === 'number') {
					var obj = elements[array[i] + (startIndex ? startIndex : 0) ]
				} else {
					var obj = elements.findRecursive('uuid', array[i])
				}
				if (obj && obj.type === 'cube') {
					obj.removeFromParent()
					save_array.push(obj)
					obj.parent = addGroup
					if (Blockbench.hasFlag('importing') && typeof addGroup === 'object') {
						if (addGroup.autouv !== undefined) {
							obj.autouv = addGroup.autouv
							if (obj.autouv === true) obj.autouv = 1
							if (obj.autouv === false) obj.autouv = 0
						}
						if (addGroup.visibility !== undefined) {
							obj.visibility = addGroup.visibility
						}
					}
				}
			} else {
				var obj = new Group(array[i])
				obj.parent = addGroup
				obj.isOpen = !!array[i].isOpen
				if (array[i].uuid) {
					obj.uuid = array[i].uuid
				}
				if (array[i].children && array[i].children.length > 0) {
					iterate(array[i].children, obj.children, obj)
				}
				if (array[i].content && array[i].content.length > 0) {
					iterate(array[i].content, obj.children, obj)
				}
				save_array.push(obj)
			}
			i++;
		}
	}
	if (importGroup && startIndex !== undefined) {
		iterate(array, importGroup.children, importGroup)
	} else {
		TreeElements.length = 1
		TreeElements.splice(0, 1)
		iterate(array, TreeElements, 'root')
	}
}
//Outliner
function loadOutlinerDraggable() {
	function getOrder(loc, obj) {
		if (!obj) {
			return;
		} else if (obj.type === 'group') {
			if (loc < 8) return -1;
			if (loc > 24) return 1;
		} else {
			if (loc < 16) return -1;
			return 1;
		}
		return 0;

	}
	Vue.nextTick(function() {
		$('li.outliner_node:not(.ui-droppable) > div.outliner_object').draggable({
			delay: 120,
			revertDuration: 50,
			helper: function() {
				var item = TreeElements.findRecursive('uuid', $(this).attr('id'))
				var helper = $(this).clone()
				if (selected.length > 1) {
					helper.append('<div class="outliner_drag_number">'+selected.length+'</div>')
				}
				helper.addClass('')
				helper.on('mousewheel', function() {
					var delta = event.deltaY * 1 + $('#cubes_list').scrollTop()
					$('#cubes_list').animate({scrollTop: delta}, 10);
				})
				return helper;
			},
			revert: 'invalid',
			appendTo: 'body',
			zIndex: 19,
			cursorAt: {left: 5},
			drag: function(event, ui) {
				$('.outliner_node[order]').attr('order', null)
				if ($('#cubes_list.drag_hover').length === 0) {
					var tar = $('#cubes_list li .drag_hover.outliner_node').deepest()
					var element = TreeElements.findRecursive('uuid', tar.attr('id'))
					if (element) {
						var location = event.clientY - tar.position().top
						var order = getOrder(location, element)
						tar.attr('order', order)
					}
				}
			}
		})
		$('li.outliner_node:not(.ui-droppable)').droppable({
			greedy: true,
			accept: function(s) { 
				if (s.hasClass('outliner_object') || s.hasClass('texture')) { 
					return true;
				}
			},
			tolerance: 'pointer',
			hoverClass: 'drag_hover',
			addClasses: false,
			drop: function(event, ui) {
				$('.outliner_node[order]').attr('order', null)
				var location = event.clientY - $(event.target).position().top
				$('.drag_hover').removeClass('drag_hover')
				var target = TreeElements.findRecursive('uuid', $(event.target).attr('id'))

				if ($(ui.draggable).hasClass('outliner_object')) {
					//Object
					var item = TreeElements.findRecursive('uuid', $(ui.draggable).parent().attr('id'))
					var order = getOrder(location, target)
					dropOutlinerObjects(item, target, event, order)

				} else if ($(ui.draggable).hasClass('texture')) {
					//Texture
					var uuid = $(ui.helper).attr('texid')
					var array = [];

					if (target.type === 'group') {
						target.forEachChild(function(cube) {
							array.push(cube)
						}, 'cube')
					} else {
						array = selected.includes(target) ? selected : [target];
					}
					Undo.initEdit({cubes: array, uv_only: true})
					array.forEach(function(cube) {
						for (var face in cube.faces) {
							cube.faces[face].texture = uuid
						}
					})
					Undo.finishEdit('drop texture')

					main_uv.loadData()
					Canvas.updateAllFaces()
				}
			}
		})
	})
}
function dropOutlinerObjects(item, target, event, order) {
	if (item.type === 'group' && target && target.parent) {
		var is_parent = false;
		function iterate(g) {
			if (!(is_parent = g === item) && g.parent.type === 'group') {
				iterate(g.parent)
			}
		}
		iterate(target)
		if (is_parent) return;
	}
	if (item.type === 'cube' && selected.includes( item )) {
		var items = selected.slice();
	} else {
		var items = [item];
	}
	if (event.altKey) {
		Undo.initEdit({cubes: [], outliner: true, selection: true})
		selected.length = 0
	} else {
		Undo.initEdit({outliner: true, selection: true})
		var updatePosRecursive = function(item) {
			if (item.type === 'cube') {
				Canvas.adaptObjectPosition(item)
			} else if (item.type === 'group' && item.children && item.children.length) {
				item.children.forEach(updatePosRecursive)
			}
		}
	}
	if (order) {
		var parent = target.parent
		if (!parent || parent === 'root') {
			parent = {children: TreeElements};
		}
	}
	function place(obj) {
		if (!order) {
			obj.addTo(target)
		} else {
			obj.removeFromParent()
			var position = parent.children.indexOf(target)
			if (order === 1) position++;
			parent.children.splice(position, 0, obj)
			obj.parent = parent.type ? parent : 'root';
		}
	}
	items.forEach(function(item) {
		if (item && item !== target) {
			if (event.altKey) {
				if (item.type === 'cube') {
					var cube = new Cube(item).init(false)
					place(cube)
					selected.push(cube)
				} else {
					var dupl = item.duplicate()
					place(dupl)
					dupl.select()
				}
			} else {
				place(item)
				if (Blockbench.entity_mode) {
					updatePosRecursive(item)
				}
			}
		}
	})
	loadOutlinerDraggable()
	if (event.altKey) {
		updateSelection()
		Undo.finishEdit('drag', {cubes: selected, outliner: true, selection: true})
	} else {
		Undo.finishEdit('drag')
	}
}

function addCube() {
	Undo.initEdit({outliner: true, cubes: [], selection: true});
	var base_cube = new Cube({
		autouv: (settings.autouv.value ? 1 : 0)
	}).addTo('root')
	if (selected_group) {
		base_cube.addTo(selected_group)
	} else if (selected[0] !== undefined &&
		selected[0].parent !== 'root'
	) {
		base_cube.addTo(selected[0].parent)
	}

	if (textures.length && Blockbench.entity_mode) {
		for (var face in base_cube.faces) {
			base_cube.faces[face].texture = textures[0].uuid
		}
		main_uv.loadData()
	}
	if (Blockbench.entity_mode) {
		var add_group = selected_group
		if (!add_group && selected.length) {
			add_group = selected[0].parent
		}
		if (add_group && add_group.type === 'group') {
			var pos1 = add_group.origin.slice()
			base_cube.extend({
				from:[ pos1[0]-0, pos1[1]-0, pos1[2]-0 ],
				to:[   pos1[0]+1, pos1[1]+1, pos1[2]+1 ]
			})
		}
	}

	if (selected_group) selected_group.unselect()
	elements.push(base_cube)
	selected = [elements[elements.length-1]]
	Canvas.updateSelected()
	loadOutlinerDraggable()
	Undo.finishEdit('add_cube', {outliner: true, cubes: selected, selection: true});
	Blockbench.dispatchEvent( 'add_cube', {object: base_cube} )

	Vue.nextTick(function() {
		updateSelection()
		if (settings.create_rename.value) {
			base_cube.rename()
		}
	})
	return base_cube
}
function addGroup() {
	Undo.initEdit({outliner: true});
	var add_group = selected_group
	if (!add_group && selected.length) {
		add_group = selected[0].parent
	}
	var base_group = new Group({
		origin: add_group ? add_group.origin : undefined
	})
	if (Blockbench.entity_mode) {
		base_group.createUniqueName()
	}
	selected.forEach(function(s, i) {
		s.addTo(base_group)
		if (i === 0) {
			s.selected = false
		}
	})
	base_group.addTo(add_group)
	base_group.isOpen = true
	base_group.select()
	Undo.finishEdit('add_group');
	loadOutlinerDraggable()
	Vue.nextTick(function() {
		updateSelection()
		if (settings.create_rename.value) {
			base_group.rename()
		}
		Blockbench.dispatchEvent( 'add_group', {object: base_group} )
	})
}

//Misc
function duplicateCubes() {
	Undo.initEdit({cubes: [], outliner: true, selection: true})
	selected.forEach(function(obj, i) {
		obj.duplicate(false)
	})
	loadOutlinerDraggable()
	updateSelection()
	BarItems.move_tool.select()
	Undo.finishEdit('duplicate', {cubes: selected, outliner: true, selection: true})
}
function renameOutliner(element) {
	stopRenameOutliner()

	if (selected_group && !element && !EditSession.active) {
		selected_group.rename()

	} else if (selected.length === 1 && !EditSession.active) {
		selected[0].rename()

	} else {

		if (selected_group && !element) {
			Blockbench.textPrompt(tl('message.rename_cubes'), selected_group.name, function (name) {

				Undo.initEdit({group: selected_group})
				selected_group.name = name
				if (Blockbench.entity_mode) {
					selected_group.createUniqueName()
				}
				Undo.finishEdit('rename group')
			})
		} else {
			Blockbench.textPrompt(tl('message.rename_cubes'), selected[0].name, function (name) {
				Undo.initEdit({cubes: selected})
				selected.forEach(function(obj, i) {
					obj.name = name.replace(/%/g, obj.index).replace(/\$/g, i)
				})
				Undo.finishEdit('rename')
			})
		}
	}
}
function stopRenameOutliner(save) {
	if (Blockbench.hasFlag('renaming')) {
		var uuid = $('.outliner_object input.renaming').parent().parent().attr('id')
		var element = TreeElements.findRecursive('uuid', uuid)
		if (element) {
			element.saveName(save)
		}
		$('.outliner_object input.renaming').attr('disabled', true).removeClass('renaming')
		$('body').focus()
		if (window.getSelection) {
			window.getSelection().removeAllRanges()
		} else if (document.selection) {
			document.selection.empty()
		}
		Blockbench.removeFlag('renaming')
	}
}
function toggleCubeProperty(key) {
	var state = selected[0][key]
	if (typeof state === 'number') {
		state++;
		if (state === 3) {
			state = 0
		}
	} else {
		state = !state
	}
	Undo.initEdit({cubes: selected})
	selected.forEach(cube => {
		cube[key] = state;
	})
	if (key === 'visibility') {
		Canvas.updateVisibility()
	}
	if (key === 'shade' && Blockbench.entity_mode) {
		Canvas.updateUVs()
	}
	Undo.finishEdit('toggle_prop')
}

onVueSetup(function() {
	outliner = new Vue({
		el: '#cubes_list',
		data: {
			option: {
				root: {
					name: 'Model',
					isParent: true,
					isOpen: true,
					selected: false,
					onOpened: function () {},
					select: function() {},
					children: TreeElements
				}
			}
		}
	})
})

BARS.defineActions(function() {
	new Action({
		id: 'add_cube',
		icon: 'add_box',
		category: 'edit',
		keybind: new Keybind({key: 78, ctrl: true}),
		condition: () => {return (!Blockbench.entity_mode || selected_group || selected.length) && !display_mode && !Animator.open},
		click: function () {
			addCube();
		}
	})
	new Action({
		id: 'add_group',
		icon: 'create_new_folder',
		category: 'edit',
		condition: () => !Animator.open,
		keybind: new Keybind({key: 71, ctrl: true}),
		click: function () {
			addGroup();
		}
	})
	new Action({
		id: 'outliner_toggle',
		icon: 'view_stream',
		category: 'edit',
		keybind: new Keybind({key: 115}),
		click: function () {
			
			var state = !$('.panel#outliner').hasClass('more_options')
			if (state) {
				$('.panel#outliner').addClass('more_options')
				BarItems.outliner_toggle.setIcon('dns')
			} else {
				$('.panel#outliner').removeClass('more_options')
				BarItems.outliner_toggle.setIcon('view_stream')
			}
		}
	})
	new BarText({
		id: 'cube_counter',
		right: true,
		click: function() {selectAll()},
		onUpdate: function() {
			if (Animator.open) {
				var all = getAllOutlinerGroups().length
				var sel = 0;
				if (selected_group) {
					selected_group.forEachChild(_ => sel++, 'group', true)
				}
				this.set(sel+'/'+all)
			} else {
				this.set(selected.length+'/'+elements.length)
			}
		}
	})
	new Action({
		id: 'rename',
		icon: 'text_format',
		category: 'edit',
		keybind: new Keybind({key: 113}),
		click: function () {
			if (Modes.id === 'edit') {
				renameOutliner()
			}
		}
	})

	new Action({
		id: 'duplicate',
		icon: 'content_copy',
		category: 'edit',
		condition: () => (!display_mode && !Animator.open && (selected.length || selected_group)),
		keybind: new Keybind({key: 68, ctrl: true}),
		click: function () {
			if (selected_group && (selected_group.matchesSelection() || selected.length === 0)) {
				var cubes_before = elements.length
				Undo.initEdit({outliner: true, cubes: [], selection: true})
				var g = selected_group.duplicate()
				g.select().isOpen = true;
				Undo.finishEdit('duplicate_group', {outliner: true, cubes: elements.slice().slice(cubes_before), selection: true})
			} else {
				duplicateCubes();
			}
		}
	})
	new Action({
		id: 'delete',
		icon: 'delete',
		category: 'edit',
		condition: () => (!display_mode && !Animator.open && (selected.length || selected_group)),
		keybind: new Keybind({key: 46}),
		click: function () {

			var array;
			Undo.initEdit({cubes: selected, outliner: true, selection: true})
			if (selected_group) {
				selected_group.remove(true)
				return;
			}
			if (array == undefined) {
				array = selected.slice(0)
			} else if (array.constructor !== Array) {
				array = [array]
			} else {
				array = array.slice(0)
			}
			array.forEach(function(s) {
				s.remove(false)
			})
			updateSelection()
			Undo.finishEdit('delete')
		}
	})
	new Action({
		id: 'sort_outliner',
		icon: 'sort_by_alpha',
		category: 'edit',
		click: function () {
			Undo.initEdit({outliner: true});
			if (TreeElements.length < 1) return;
			TreeElements.sort(function(a,b) {
				return sort_collator.compare(a.name, b.name)
			});
			Undo.finishEdit('sort_outliner')
		}
	})
	new Action({
		id: 'local_move',
		icon: 'check_box',
		category: 'edit',
		linked_setting: 'local_move',
		click: function () {
			BarItems.local_move.toggleLinkedSetting()
			updateSelection()
		}
	})
	new Action({
		id: 'element_colors',
		icon: 'check_box',
		category: 'edit',
		linked_setting: 'outliner_colors',
		click: function () {
			BarItems.element_colors.toggleLinkedSetting()
			updateSelection()
		}
	})
	new Action({
		id: 'select_window',
		icon: 'filter_list',
		category: 'edit',
		condition: () => (!display_mode && !Animator.open),
		keybind: new Keybind({key: 70, ctrl: true}),
		click: function () {
			showDialog('selection_creator')
			$('#selgen_name').focus()
		}
	})
	new Action({
		id: 'invert_selection',
		icon: 'swap_vert',
		category: 'edit',
		condition: () => (!display_mode && !Animator.open),
		click: function () {
			elements.forEach(function(s) {
				if (selected.includes(s)) {
					selected.splice(selected.indexOf(s), 1)
				} else {
					selected.push(s)
				}
			})
			if (selected_group) selected_group.unselect()
			updateSelection()
			Blockbench.dispatchEvent('invert_selection')
		}
	})
	new Action({
		id: 'select_all',
		icon: 'select_all',
		category: 'edit',
		condition: () => (!display_mode && !Animator.open),
		keybind: new Keybind({key: 65, ctrl: true}),
		click: function () {selectAll()}
	})
	new Action({
		id: 'collapse_groups',
		icon: 'format_indent_decrease',
		category: 'edit',
		condition: () => TreeElements.length > 0,
		click: function () {
			getAllOutlinerGroups().forEach(function(g) {
				g.isOpen = false
				var name = g.name
				g.name = '_$X0v_'
				g.name = name
			})
		}
	})
})
