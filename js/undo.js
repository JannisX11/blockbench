class UndoSystem {
	constructor() {
		this.index = 0;
		this.history = [];
	}
	initEdit(aspects) {
		if (aspects && aspects.cubes) {
			console.warn('Aspect "cubes" is deprecated. Please use "elements" instead.');
			aspects.elements = aspects.cubes;
		}
		/*
		if (
			aspects && this.current_save &&
			Objector.equalKeys(aspects, this.current_save.aspects) &&
			aspects.elements !== selected &&
			this.history.length == this.index
		) {
			return;
		}
		- This still causes issues, for example with different texture selections
		*/
		this.current_save = new UndoSystem.save(aspects)
		return this.current_save;
	}
	finishEdit(action, aspects) {
		if (aspects && aspects.cubes) {
			console.warn('Aspect "cubes" is deprecated. Please use "elements" instead.');
			aspects.elements = aspects.cubes;
		}
		if (!this.current_save) return;
		aspects = aspects || this.current_save.aspects
		//After
		Blockbench.dispatchEvent('finish_edit', {aspects})
		var entry = {
			before: this.current_save,
			post: new UndoSystem.save(aspects),
			action: action
		}
		this.current_save = entry.post
		if (this.history.length > this.index) {
			this.history.length = this.index;
			delete this.current_save;
		}
	 
		this.history.push(entry)

		if (this.history.length > settings.undo_limit.value) {
			this.history.shift()
		}
		this.index = this.history.length
		if (!aspects || !aspects.keep_saved) {
			Project.saved = false;
		}
		Blockbench.dispatchEvent('finished_edit', {aspects})
		if (EditSession.active) {
			EditSession.sendEdit(entry)
		}
		return entry;
	}
	cancelEdit() {
		if (!this.current_save) return;
		outlines.children.length = 0
		this.loadSave(this.current_save, new UndoSystem.save(this.current_save.aspects))
		delete this.current_save;
	}
	addKeyframeCasualties(arr) {
		if (!arr || arr.length == 0) return;
		if (!this.current_save.keyframes) {
			this.current_save.keyframes = {
				animation: Animation.selected.uuid
			}
		}
		arr.forEach(kf => {
			this.current_save.affected = true
			this.current_save.keyframes[kf.uuid] = kf.getUndoCopy();
		})
	}
	undo(remote) {
		if (this.history.length <= 0 || this.index < 1) return;

		Project.saved = false;
		this.index--;

		var entry = this.history[this.index]
		this.loadSave(entry.before, entry.post)
		if (EditSession.active && remote !== true) {
			EditSession.sendAll('command', 'undo')
		}
		Blockbench.dispatchEvent('undo', {entry})
	}
	redo(remote) {
		if (this.history.length <= 0) return;
		if (this.index >= this.history.length) {
			return;
		}
		Project.saved = false;

		var entry = this.history[this.index]
		this.index++;
		this.loadSave(entry.post, entry.before)
		if (EditSession.active && remote !== true) {
			EditSession.sendAll('command', 'redo')
		}
		Blockbench.dispatchEvent('redo', {entry})
	}
	remoteEdit(entry) {
		this.loadSave(entry.post, entry.before, 'session')

		if (entry.save_history !== false) {
			delete this.current_save;
			this.history.push(entry)
			if (this.history.length > settings.undo_limit.value) {
				this.history.shift()
			}
			this.index = this.history.length
			Project.saved = false;
			Blockbench.dispatchEvent('finished_edit', {remote: true})
		}
	}
	getItemByUUID(list, uuid) {
		if (!list || typeof list !== 'object' || !list.length) {return false;}
		var i = 0;
		while (i < list.length) {
			if (list[i].uuid === uuid) {
				return list[i]
			}
			i++;
		}
		return false;
	}
	loadSave(save, reference, mode) {
		var is_session = mode === 'session';
		
		if (save.uv_mode) {
			Project.box_uv = save.uv_mode.box_uv;
			Project.texture_width = save.uv_mode.width;
			Project.texture_height = save.uv_mode.height;
			Canvas.updateAllUVs()
		}

		if (save.elements) {
			for (var uuid in save.elements) {
				if (save.elements.hasOwnProperty(uuid)) {
					var element = save.elements[uuid]

					var new_element = OutlinerElement.uuids[uuid]
					if (new_element) {
						for (var face in new_element.faces) {
							new_element.faces[face].reset()
						}
						new_element.extend(element)
						if (new_element.type == 'cube') {
							Canvas.adaptObjectPosition(new_element)
							Canvas.adaptObjectFaceGeo(new_element)
							Canvas.adaptObjectFaces(new_element)
							Canvas.updateUV(new_element)
						}
					} else {
						new_element = NonGroup.fromSave(element, true);
					}
				}
			}
			for (var uuid in reference.elements) {
				if (reference.elements.hasOwnProperty(uuid) && !save.elements.hasOwnProperty(uuid)) {
					var obj = OutlinerElement.uuids[uuid]
					if (obj) {
						obj.remove()
					}
				}
			}
			loadOutlinerDraggable()
			Canvas.updateVisibility()
		}

		if (save.outliner) {
			Group.selected = undefined
			parseGroups(save.outliner)
			if (is_session) {
				function iterate(arr) {
					arr.forEach((obj) => {
						delete obj.isOpen;
						if (obj.children) {
							iterate(obj.children)
						}
					})
				}
				iterate(save.outliner)
			}
			if (Format.bone_rig) {
				Canvas.updateAllPositions()
			}
		}

		if (save.selection_group && !is_session) {
			Group.selected = undefined
			var sel_group = OutlinerElement.uuids[save.selection_group]
			if (sel_group) {
				sel_group.select()
			}
		}

		if (save.selection && !is_session) {
			selected.length = 0;
			elements.forEach(function(obj) {
				if (save.selection.includes(obj.uuid)) {
					obj.selectLow()
				}
			})
		}

		if (save.group) {
			var group = OutlinerElement.uuids[save.group.uuid]
			if (group) {
				if (is_session) {
					delete save.group.isOpen;
				}
				group.extend(save.group)
				if (Format.bone_rig) {
					group.forEachChild(function(obj) {
						Canvas.adaptObjectPosition(obj)
					}, Cube)
				}
			}
		}

		if (save.textures) {
			Painter.current = {}
			for (var uuid in save.textures) {
				if (reference.textures[uuid]) {
					var tex = this.getItemByUUID(textures, uuid)
					if (tex) {
						var require_reload = tex.mode !== save.textures[uuid].mode;
						tex.extend(save.textures[uuid]).updateSource()
						tex.keep_size = true;
						if (require_reload || reference.textures[uuid] === true) {
							tex.load()
						}
					}
				} else {
					var tex = new Texture(save.textures[uuid], uuid)
					tex.load().add(false)
				}
			}
			for (var uuid in reference.textures) {
				if (!save.textures[uuid]) {
					var tex = this.getItemByUUID(Texture.all, uuid)
					if (tex) {
						Texture.all.splice(Texture.all.indexOf(tex), 1)
					}
					if (Texture.selected == tex) {
						Texture.selected = textures.selected = undefined;
					}
				}
			}
			Canvas.updateAllFaces()
		}

		if (save.texture_order) {
			Texture.all.sort((a, b) => {
				return save.texture_order.indexOf(a.uuid) - save.texture_order.indexOf(b.uuid);
			})
			Canvas.updateLayeredTextures()
		}

		if (save.selected_texture) {
			let tex = Texture.all.find(tex => tex.uuid == save.selected_texture);
			if (tex instanceof Texture) tex.select()
		} else if (save.selected_texture == null) {
			unselectTextures()
		}

		if (save.settings) {
			for (var key in save.settings) {
				settings[key].value = save.settings[key]
			}
		}


		if (save.animations) {
			for (var uuid in save.animations) {

				var animation = (reference.animations && reference.animations[uuid]) ? this.getItemByUUID(Animator.animations, uuid) : null;
				if (!animation) {
					animation = new Animation()
					animation.uuid = uuid
				}
				animation.extend(save.animations[uuid]).add(false)
				if (save.animations[uuid].selected) {
					animation.select()
				}
			}
			for (var uuid in reference.animations) {
				if (!save.animations[uuid]) {
					var animation = this.getItemByUUID(Animator.animations, uuid)
					if (animation) {
						animation.remove(false)
					}
				}
			}
		}

		if (save.keyframes) {
			var animation = Animation.selected;
			if (!animation || animation.uuid !== save.keyframes.animation) {
				animation = Animator.animations.findInArray('uuid', save.keyframes.animation)
				if (animation.select && Animator.open && is_session) {
					animation.select()
				}
			}
			if (animation) {

				function getKeyframe(uuid, animator) {
					var i = 0;
					while (i < animator.keyframes.length) {
						if (animator.keyframes[i].uuid === uuid) {
							return animator.keyframes[i];
						}
						i++;
					}
				}
				var added = 0;
				for (var uuid in save.keyframes) {
					if (uuid.length === 36 && save.keyframes.hasOwnProperty(uuid)) {
						var data = save.keyframes[uuid];
						var animator = animation.animators[data.animator];
						if (!animator) continue;
						var kf = getKeyframe(uuid, animator);
						if (kf) {
							kf.extend(data)
						} else {
							animator.addKeyframe(data, uuid);
							added++;
						}
					}
				}
				for (var uuid in reference.keyframes) {
					if (uuid.length === 36 && reference.keyframes.hasOwnProperty(uuid) && !save.keyframes.hasOwnProperty(uuid)) {
						var data = reference.keyframes[uuid];
						var animator = animation.animators[data.animator];
						if (!animator) continue;
						var kf = getKeyframe(uuid, animator)
						if (kf) {
							kf.remove()
						}
					}
				}
				updateKeyframeSelection()
			}
		}

		if (save.display_slots) {
			for (var slot in save.display_slots) {
				var data = save.display_slots[slot]

				if (!display[slot] && data) {
					display[slot] = new DisplaySlot()
				} else if (data === null && display[slot]) {
					display[slot].default()
				}
				display[slot].extend(data).update()
			}
		}
		if (open_dialog == 'uv_dialog') {
			for (var key in uv_dialog.editors) {
				if (uv_dialog.editors[key]) {
					uv_dialog.editors[key].loadData()
				}
			}
		}
		updateSelection()
		if ((save.outliner || save.group) && Format.bone_rig) {
			Canvas.updateAllBones();
		}
		if (Modes.animate) {
			Animator.preview();
		}
	}
}
UndoSystem.save = class {
	constructor(aspects) {

		var scope = this;
		this.aspects = aspects;

		if (aspects.selection) {
			this.selection = []
			selected.forEach(function(obj) {
				scope.selection.push(obj.uuid)
			})
			if (Group.selected) {
				this.selection_group = Group.selected.uuid
			}
		}

		if (aspects.elements) {
			this.elements = {}
			aspects.elements.forEach(function(obj) {
				scope.elements[obj.uuid] = obj.getUndoCopy(aspects)
			})
		}

		if (aspects.outliner) {
			this.outliner = compileGroups(true)
		}

		if (aspects.group) {
			this.group = aspects.group.getChildlessCopy(true)
		}

		if (aspects.textures) {
			this.textures = {}
			aspects.textures.forEach(t => {
				var tex = t.getUndoCopy(aspects.bitmap)
				this.textures[t.uuid] = tex
			})
		}

		if (aspects.texture_order && Texture.all.length) {
			this.texture_order = [];
			Texture.all.forEach(tex => {
				this.texture_order.push(tex.uuid);
			})
		}

		if (aspects.selected_texture && Texture.all.length) {
			this.selected_texture = Texture.selected ? Texture.selected.uuid : null;
		}

		if (aspects.settings) {
			this.settings = aspects.settings
		}

		if (aspects.uv_mode) {
			this.uv_mode = {
				box_uv: Project.box_uv,
				width:  Project.texture_width,
				height: Project.texture_height
			}
		}

		if (aspects.animations) {
			this.animations = {}
			aspects.animations.forEach(a => {
				scope.animations[a.uuid] = a.getUndoCopy();
			})
		}
		if (aspects.keyframes && Animation.selected && Timeline.animators.length) {
			this.keyframes = {
				animation: Animation.selected.uuid
			}
			aspects.keyframes.forEach(kf => {
				scope.keyframes[kf.uuid] = kf.getUndoCopy()
			})
		}

		if (aspects.display_slots) {
			scope.display_slots = {}
			aspects.display_slots.forEach(slot => {
				if (display[slot]) {
					scope.display_slots[slot] = display[slot].copy()
				} else {
					scope.display_slots[slot] = null
				}
			})
		}
	}
	addTexture(texture) {
		if (!this.textures) return;
		if (this.aspects.textures.safePush(texture)) {
			this.textures[texture.uuid] = texture.getUndoCopy(this.aspects.bitmap)
		}
	}
}

let Undo = null;

BARS.defineActions(function() {
	
	new Action('undo', {
		icon: 'undo',
		category: 'edit',
		condition: () => (!open_dialog || open_dialog === 'uv_dialog' || open_dialog === 'toolbar_edit'),
		work_in_dialog: true,
		keybind: new Keybind({key: 90, ctrl: true}),
		click(e) {
			Project.undo.undo(e);
		}
	})
	new Action('redo', {
		icon: 'redo',
		category: 'edit',
		condition: () => (!open_dialog || open_dialog === 'uv_dialog' || open_dialog === 'toolbar_edit'),
		work_in_dialog: true,
		keybind: new Keybind({key: 89, ctrl: true}),
		click(e) {
			Project.undo.redo(e);
		}
	})
})