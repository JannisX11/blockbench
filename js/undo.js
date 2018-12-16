var Undo = {
	index: 0,
	history: [],
	initEdit: function(aspects) {
		//Before
		if (aspects && Undo.current_save) {
			//This "before" is the same as the "after" of the previous step
			if (Objector.equalKeys(aspects, Undo.current_save.aspects) && aspects.cubes !== selected) {
				//return;
			}
		}
		Undo.current_save = new Undo.save(aspects)
	},
	finishEdit: function(action, aspects) {
		aspects = aspects || Undo.current_save.aspects
		//After
		var entry = {
			before: Undo.current_save,
			post: new Undo.save(aspects),
			action: action
		}
		Undo.current_save = entry.post

		if (Undo.history.length-1 > Undo.index) {
			Undo.history.length = Undo.index+1
		}
	 
		Undo.history.push(entry)

		if (Undo.history.length > settings.undo_limit.value) {
			Undo.history.shift()
		}
		Undo.index = Undo.history.length
		if (!aspects || !aspects.keep_saved) {
			Prop.project_saved = false;
		}
	},
	undo: function() {
		if (Undo.history.length <= 0 || Undo.index < 1) return;

		Prop.project_saved = false;
		Undo.index--;

		var entry = Undo.history[Undo.index]
		Undo.loadSave(entry.before, entry.post)
		console.log('Undo: '+entry.action)
		Blockbench.dispatchEvent('undo', {entry: entry})
	},
	redo: function() {
		if (Undo.history.length <= 0) return;
		if (Undo.index >= Undo.history.length) {
			return;
		}
		Prop.project_saved = false;
		Undo.index++;

		var entry = Undo.history[Undo.index-1]
		Undo.loadSave(entry.post, entry.before)
		console.log('Redo: '+entry.action)
		Blockbench.dispatchEvent('redo', {})
	},
	getItemByUUID: function(list, uuid) {
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
		this.aspects = aspects

		if (aspects.selection) {
			this.selection = []
			selected.forEach(function(obj) {
				scope.selection.push(obj.uuid)
			})
			if (selected_group) {
				this.selection_group = selected_group.uuid
			}
		}

		if (aspects.cubes) {
			this.cubes = {}
			aspects.cubes.forEach(function(obj) {
				if (aspects.uv_only) {
					var copy = new Cube(obj)
					copy = {
						uv_offset: copy.uv_offset,
						faces: copy.faces,
					}
				} else {
					var copy = new Cube(obj)
				}
				copy.uuid = obj.uuid
				scope.cubes[obj.uuid] = copy
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

		if (aspects.resolution) {
			this.resolution = {
				width:  Project.texture_width,
				height: Project.texture_height
			}
		}

		if (aspects.animation) {
			this.animation = aspects.animation ? aspects.animation.undoCopy() : null; 
		}
		if (aspects.keyframes && Animator.selected && Animator.selected.getBoneAnimator()) {
			this.keyframes = {
				animation: Animator.selected.uuid,
				bone: Animator.selected.getBoneAnimator().uuid
			}
			aspects.keyframes.forEach(kf => {
				scope.keyframes[kf.uuid] = kf.undoCopy()
			})
		}
	},
	loadSave: function(save, reference) {
		if (save.cubes) {
			for (var uuid in save.cubes) {
				if (save.cubes.hasOwnProperty(uuid)) {
					var data = save.cubes[uuid]
					var obj = TreeElements.findRecursive('uuid', uuid)
					if (obj) {
						for (var face in obj.faces) {
							obj.faces[face] = {uv: []}
						}
						obj.extend(data)
						Canvas.adaptObjectPosition(obj)
						Canvas.adaptObjectFaces(obj)
						Canvas.updateUV(obj)
					} else {
						obj = new Cube(data, uuid).init(false)
					}
				}
			}
			for (var uuid in reference.cubes) {
				if (reference.cubes.hasOwnProperty(uuid) && !save.cubes.hasOwnProperty(uuid)) {
					var obj = TreeElements.findRecursive('uuid', uuid)
					if (obj) {
						obj.remove(false)
					}
				}
			}
			loadOutlinerDraggable()
			Canvas.updateVisibility()
		}

		if (save.outliner) {
			selected_group = undefined
			parseGroups(save.outliner)
			if (Blockbench.entity_mode) {
				Canvas.updateAllPositions()
			}
		}

		if (save.selection_group) {
			selected_group = undefined
			var sel_group = TreeElements.findRecursive('uuid', save.selection_group)
			if (sel_group) {
				sel_group.select()
			}
		}

		if (save.selection) {
			selected.length = 0;
			elements.forEach(function(obj) {
				if (save.selection.includes(obj.uuid)) {
					selected.push(obj)
				}
			})
		}

		if (save.group) {
			var group = TreeElements.findRecursive('uuid', save.group.uuid)
			if (group) {
				group.extend(save.group)
				if (Blockbench.entity_mode) {
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
						tex.extend(save.textures[uuid]).updateMaterial()
					}
				} else {
					new Texture(save.textures[uuid]).load().add(false)
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

		if (save.resolution) {
			Project.texture_width = save.resolution.width
			Project.texture_height = save.resolution.height
		}

		if (save.animation) {

			var animation = Animator.animations.findInArray('uuid', save.animation)
			if (!animation) {
				//new
				animation = new Animation()
			}
			//populate
			Animation.extend(save.animation)

		} else if (reference.animation) {
			//remove
			var animation = Animator.animations.findInArray('uuid', reference.animation.uuid)
			if (animation.remove) {
				animation.remove()
			}
		}

		if (save.keyframes && Animator.selected) {
			var animation = false;
			if (Animator.selected.uuid !== save.keyframes.animation) {
				animation = Animator.animations.findInArray('uuid', save.keyframes.animation)
			} else {
				animation = Animator.selected
			}

			if (animation.select && animation !== Animator.selected) {
				animation.select()
			}
			var bone = false;
			if (Animator.selected.uuid !== save.keyframes.animation) {
				animation = Animator.animations.findInArray('uuid', save.keyframes.animation)
			} else {
				animation = Animator.selected
			}

			if (animation.select && animation !== Animator.selected) {
				animation.select()
			}


			function getKeyframe(uuid) {
				var i = 0;
				while (i < Timeline.keyframes.length) {
					if (Timeline.keyframes[i].uuid === uuid) {
						return Timeline.keyframes[i];
					}
					i++;
				}
			}
			var added = 0;
			for (var uuid in save.keyframes) {
				if (uuid.length === 36 && save.keyframes.hasOwnProperty(uuid)) {
					var data = save.keyframes[uuid]
					var kf = getKeyframe(uuid)
					if (kf) {
						kf.extend(data)
					} else {
						kf = new Keyframe(data)
						Timeline.keyframes.push(kf)
						added++;
					}
				}
			}
			for (var uuid in reference.keyframes) {
				if (uuid.length === 36 && reference.keyframes.hasOwnProperty(uuid) && !save.keyframes.hasOwnProperty(uuid)) {
					var kf = getKeyframe(uuid)
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
		updateSelection()
	}
}