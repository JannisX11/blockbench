var Undo = {
	index: 0,
	history: [],
	initEdit(aspects) {
		if (aspects && aspects.cubes) {
			console.warn('Aspect "cubes" is deprecated. Please use "elements" instead.');
			aspects.elements = aspects.cubes;
		}
		/*
		if (
			aspects && Undo.current_save &&
			Objector.equalKeys(aspects, Undo.current_save.aspects) &&
			aspects.elements !== selected &&
			Undo.history.length == Undo.index
		) {
			return;
		}
		- This still causes issues, for example with different texture selections
		*/
		if (aspects.textures && aspects.textures.length == 0 && Format.single_texture && textures.length == 1) {
			aspects.textures[0] = textures[0];
		}
		Undo.current_save = new Undo.save(aspects)
		return Undo.current_save;
	},
	finishEdit(action, aspects) {
		if (aspects && aspects.cubes) {
			console.warn('Aspect "cubes" is deprecated. Please use "elements" instead.');
			aspects.elements = aspects.cubes;
		}
		if (!Undo.current_save) return;
		aspects = aspects || Undo.current_save.aspects
		//After
		Blockbench.dispatchEvent('finish_edit', {aspects})
		var entry = {
			before: Undo.current_save,
			post: new Undo.save(aspects),
			action: action
		}
		Undo.current_save = entry.post
		if (Undo.history.length > Undo.index) {
			Undo.history.length = Undo.index;
			delete Undo.current_save;
		}
	 
		Undo.history.push(entry)

		if (Undo.history.length > settings.undo_limit.value) {
			Undo.history.shift()
		}
		Undo.index = Undo.history.length
		if (!aspects || !aspects.keep_saved) {
			Prop.project_saved = false;
		}
		Blockbench.dispatchEvent('finished_edit', {aspects})
		if (EditSession.active) {
			EditSession.sendEdit(entry)
		}
		return entry;
	},
	cancelEdit() {
		if (!Undo.current_save) return;
		outlines.children.length = 0
		Undo.loadSave(Undo.current_save, new Undo.save(Undo.current_save.aspects))
		delete Undo.current_save;
	},
	addKeyframeCasualties(arr) {
		if (!arr || arr.length == 0) return;
		if (!Undo.current_save.keyframes) {
			Undo.current_save.keyframes = {
				animation: Animator.selected.uuid
			}
		}
		arr.forEach(kf => {
			Undo.current_save.affected = true
			Undo.current_save.keyframes[kf.uuid] = kf.getUndoCopy();
		})
	},
	undo(remote) {
		if (Undo.history.length <= 0 || Undo.index < 1) return;

		Prop.project_saved = false;
		Undo.index--;

		var entry = Undo.history[Undo.index]
		Undo.loadSave(entry.before, entry.post)
		if (EditSession.active && remote !== true) {
			EditSession.sendAll('command', 'undo')
		}
		Blockbench.dispatchEvent('undo', {entry})
	},
	redo(remote) {
		if (Undo.history.length <= 0) return;
		if (Undo.index >= Undo.history.length) {
			return;
		}
		Prop.project_saved = false;

		var entry = Undo.history[Undo.index]
		Undo.index++;
		Undo.loadSave(entry.post, entry.before)
		if (EditSession.active && remote !== true) {
			EditSession.sendAll('command', 'redo')
		}
		Blockbench.dispatchEvent('redo', {entry})
	},
	remoteEdit(entry) {
		Undo.loadSave(entry.post, entry.before, 'session')

		if (entry.save_history !== false) {
			delete Undo.current_save;
			Undo.history.push(entry)
			if (Undo.history.length > settings.undo_limit.value) {
				Undo.history.shift()
			}
			Undo.index = Undo.history.length
			Prop.project_saved = false;
			Blockbench.dispatchEvent('finished_edit', {remote: true})
		}
	},
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
	},
	save: function(aspects) {
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
			this.group = aspects.group.getChildlessCopy()
			this.group.uuid = aspects.group.uuid
		}

		if (aspects.textures) {
			this.textures = {}
			aspects.textures.forEach(function(t) {
				var tex = t.getUndoCopy(aspects.bitmap)
				scope.textures[t.uuid] = tex
			})
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
		if (aspects.keyframes && Animator.selected && Timeline.animators.length) {
			this.keyframes = {
				animation: Animator.selected.uuid
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
	},
	loadSave(save, reference, mode) {
		var is_session = mode === 'session';
		if (save.elements) {
			for (var uuid in save.elements) {
				if (save.elements.hasOwnProperty(uuid)) {
					var element = save.elements[uuid]

					var new_element = elements.findInArray('uuid', uuid)
					if (new_element) {
						for (var face in new_element.faces) {
							new_element.faces[face].reset()
						}
						new_element.extend(element)
						if (new_element.type == 'cube') {
							Canvas.adaptObjectPosition(new_element)
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
					var obj = elements.findInArray('uuid', uuid)
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
			var sel_group = Group.all.findInArray('uuid', save.selection_group)
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
			var group = Group.all.findInArray('uuid', save.group.uuid)
			if (group) {
				if (is_session) {
					delete save.group.isOpen;
				}
				group.extend(save.group)
				if (Format.bone_rig) {
					group.forEachChild(function(obj) {
						if (obj.type === 'cube') {
							Canvas.adaptObjectPosition(obj)
						}
					})
				}
			}
		}

		if (save.textures) {
			Painter.current = {}
			for (var uuid in save.textures) {
				if (reference.textures[uuid]) {
					var tex = Undo.getItemByUUID(textures, uuid)
					if (tex) {
						var require_reload = tex.mode !== save.textures[uuid].mode;
						tex.extend(save.textures[uuid]).updateMaterial()
						if (require_reload || reference.textures[uuid] === true) {
							tex.load()
						} else {
							tex.updateMaterial()
						}
					}
				} else {
					var tex = new Texture(save.textures[uuid], uuid)
					tex.load().add(false)
				}
			}
			for (var uuid in reference.textures) {
				if (!save.textures[uuid]) {
					var tex = Undo.getItemByUUID(textures, uuid)
					if (tex) {
						textures.splice(textures.indexOf(tex), 1)
					}
				}
			}
			Canvas.updateAllFaces()
		}
		if (save.settings) {
			for (var key in save.settings) {
				settings[key].value = save.settings[key]
			}
		}

		if (save.uv_mode) {
			Project.box_uv = save.uv_mode.box_uv;
			Project.texture_width = save.uv_mode.width;
			Project.texture_height = save.uv_mode.height;
			Canvas.updateAllUVs()
		}

		if (save.animations) {
			for (var uuid in save.animations) {

				var animation = (reference.animations && reference.animations[uuid]) ? Undo.getItemByUUID(Animator.animations, uuid) : null;
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
					var animation = Undo.getItemByUUID(Animator.animations, uuid)
					if (animation) {
						animation.remove(false)
					}
				}
			}
		}

		if (save.keyframes) {
			var animation = Animator.selected;
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
				if (added) {
					Vue.nextTick(Timeline.update)
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
Undo.save.prototype.addTexture = function(texture) {
	if (!this.textures) return;
	if (this.aspects.textures.safePush(texture)) {
		this.textures[texture.uuid] = texture.getUndoCopy(this.aspects.bitmap)
	}
}
BARS.defineActions(function() {
	
	new Action('undo', {
		icon: 'undo',
		category: 'edit',
		condition: () => (!open_dialog || open_dialog === 'uv_dialog' || open_dialog === 'toolbar_edit'),
		work_in_dialog: true,
		keybind: new Keybind({key: 90, ctrl: true}),
		click: Undo.undo
	})
	new Action('redo', {
		icon: 'redo',
		category: 'edit',
		condition: () => (!open_dialog || open_dialog === 'uv_dialog' || open_dialog === 'toolbar_edit'),
		work_in_dialog: true,
		keybind: new Keybind({key: 89, ctrl: true}),
		click: Undo.redo
	})
})