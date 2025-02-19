class UndoSystem {
	constructor() {
		this.index = 0;
		this.history = [];
	}
	startChange(amended) {
		/*if (this.current_save && Painter.painting) {
			throw 'Canceled edit: Cannot perform edits while painting'
		}*/
		/*if (this.current_save && Transformer.dragging) {
			throw 'Canceled edit: Cannot perform other edits while transforming elements'
		}*/
		if (!amended && this.amend_edit_menu) {
			this.closeAmendEditMenu();
		}
	}
	initEdit(aspects, amended = false) {
		// todo: selecting all groups, moving, then undoing, unselects all multi-selected groups
		if (aspects && aspects.cubes) {
			console.warn('Aspect "cubes" is deprecated. Please use "elements" instead.');
			aspects.elements = aspects.cubes;
		}
		this.startChange(amended);
		this.current_save = new UndoSystem.save(aspects);
		if (aspects.selection) {
			this.current_selection_save = new UndoSystem.selectionSave(typeof aspects.selection == 'object' ? typeof aspects.selection : 0);
		}
		Blockbench.dispatchEvent('init_edit', {aspects, amended, save: this.current_save})
		return this.current_save;
	}
	finishEdit(message, aspects) {
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
			action: message,
			type: 'edit',
			time: Date.now()
		}

		if (aspects.selection && this.current_selection_save) {
			let selection_aspects = typeof aspects.selection == 'object' ? aspects.selection : this.current_selection_save.aspects;
			let selection_before = this.current_selection_save;
			let selection_post = new UndoSystem.selectionSave(selection_aspects);
			if (!selection_before.matches(selection_post)) {
				entry.selection_before = selection_before;
				entry.selection_post = selection_post;
			}
		}


		if (this.history.length > this.index) {
			this.history.length = this.index;
		}
		delete this.current_save;
	 
		this.history.push(entry)

		if (this.history.length > settings.undo_limit.value) {
			this.history.shift()
		}
		this.index = this.history.length
		if (!aspects || !aspects.keep_saved) {
			Project.saved = false;
		}
		Blockbench.dispatchEvent('finished_edit', {aspects})
		if (Project.EditSession && Project.EditSession.active) {
			Project.EditSession.sendEdit(entry)
		}
		return entry;
	}
	initSelection(aspects) {
		if (!settings.undo_selections.value || Blockbench.hasFlag('loading_selection_save') || Project.EditSession) return;

		if (this.current_selection_save) return;
		this.current_selection_save = new UndoSystem.selectionSave(aspects);
		Blockbench.dispatchEvent('init_selection_change', {aspects, save: this.current_selection_save})
		return this.current_selection_save;
	}
	finishSelection(message, aspects) {
		if (!settings.undo_selections.value || Blockbench.hasFlag('loading_selection_save') || Project.EditSession) return;

		if (!this.current_selection_save) return;
		aspects = aspects || this.current_selection_save.aspects;
		let selection_before = this.current_selection_save;
		let selection_post = new UndoSystem.selectionSave(aspects);
		if (selection_before.matches(selection_post)) {
			this.cancelSelection();
			return;
		}
		//After
		Blockbench.dispatchEvent('finish_selection_change', {aspects})
		var entry = {
			selection_before,
			selection_post,
			action: message,
			type: 'selection',
			time: Date.now()
		}
		if (this.history.length > this.index) {
			this.history.length = this.index;
		}
		delete this.current_selection_save;
	 
		this.history.push(entry)

		if (this.history.length > settings.undo_limit.value) {
			this.history.shift()
		}
		this.index = this.history.length
		Blockbench.dispatchEvent('finished_selection_change', {aspects})
		return entry;
	}
	cancelEdit(revert_changes = false) {
		if (!this.current_save) return;
		this.startChange();
		if (revert_changes) {
			Canvas.outlines.children.empty();
			this.loadSave(this.current_save, new UndoSystem.save(this.current_save.aspects))
		}
		delete this.current_save;
	}
	cancelSelection(revert_changes = false) {
		let selection_before = this.current_selection_save;
		if (revert_changes) {
			selection_before.load(new UndoSystem.save(selection_before.aspects));
		}
		delete this.current_selection_save;
		Blockbench.dispatchEvent('cancel_selection_change', {selection_before})
	}
	closeAmendEditMenu() {
		if (this.amend_edit_menu) {
			this.amend_edit_menu.node.remove();
			delete this.amend_edit_menu;
		}
	}
	amendEdit(form, callback) {
		let dialog = document.createElement('div');
		dialog.id = 'amend_edit_menu';
		this.amend_edit_menu = {
			node: dialog,
			form: null
		};

		let close_button = document.createElement('div');
		close_button.append(Blockbench.getIconNode('clear'));
		close_button.className = 'amend_edit_close_button';
		close_button.title = tl('dialog.close')
		close_button.addEventListener('click', (event) => {
			Undo.closeAmendEditMenu();
		})
		dialog.append(close_button);

		this.amend_edit_menu.form = new InputForm(form);
		this.amend_edit_menu.form.on('change', ({result}) => {
			if (Undo.history.length != Undo.index) {
				console.error('Detected error in amending edit. Skipping this edit.');
				return;
			}
			Undo.undo(null, true);
			callback(result, this.amend_edit_menu.form);
		})
		dialog.append(this.amend_edit_menu.form.node);

		let preview_container = document.getElementById('preview');
		preview_container.append(dialog);
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
	undo(remote, amended) {
		this.startChange(amended);
		if (this.history.length <= 0 || this.index < 1) return;

		Project.saved = false;
		this.index--;

		var entry = this.history[this.index];
		if (entry.before) {
			this.loadSave(entry.before, entry.post);
		}
		if (entry.selection_before instanceof UndoSystem.selectionSave) {
			entry.selection_before.load(entry.selection_post);
		}
		if (Project.EditSession && remote !== true && entry.type != 'selection') {
			Project.EditSession.sendAll('command', 'undo');
		}
		Blockbench.dispatchEvent('undo', {entry})
	}
	redo(remote, amended) {
		this.startChange(amended);
		if (this.history.length <= 0) return;
		if (this.index >= this.history.length) {
			return;
		}
		Project.saved = false;

		var entry = this.history[this.index]
		this.index++;
		if (entry.post) {
			this.loadSave(entry.post, entry.before);
		}
		if (entry.selection_post instanceof UndoSystem.selectionSave) {
			entry.selection_post.load(entry.selection_before);
		}
		if (Project.EditSession && remote !== true && entry.type != 'selection') {
			Project.EditSession.sendAll('command', 'redo');
		}
		Blockbench.dispatchEvent('redo', {entry})
	}
	remoteEdit(entry) {
		this.loadSave(entry.post, entry.before, 'session');

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
		if (save instanceof UndoSystem.save == false) {
			save = new UndoSystem.save().fromJSON(save);
		}
		save.load(reference, mode);
	}
}
UndoSystem.save = class {
	constructor(aspects) {
		if (aspects) {
			this.fromState(aspects);
		}
	}
	fromJSON(data) {
		Object.assign(this, data);
		return this;
	}
	fromState(aspects) {
		var scope = this;
		this.aspects = aspects;

		this.mode = Modes.selected.id;

		/*if (aspects.selection) {
			this.selection = [];
			this.mesh_selection = {};
			selected.forEach(obj => {
				this.selection.push(obj.uuid);
				if (obj instanceof Mesh && Project.mesh_selection[obj.uuid]) {
					this.mesh_selection[obj.uuid] = JSON.parse(JSON.stringify(Project.mesh_selection[obj.uuid]));
				}
			})
			if (Group.multi_selected.length) {
				this.selected_groups = Group.multi_selected.map(g => g.uuid);
			}
		}*/

		if (aspects.elements) {
			this.elements = {}
			aspects.elements.forEach(function(obj) {
				scope.elements[obj.uuid] = obj.getUndoCopy(aspects)
			})
		}

		if (aspects.outliner) {
			this.outliner = compileGroups(true)
		}

		if (aspects.groups) {
			this.groups = aspects.groups.map(group => group.getChildlessCopy(true));
		} else if (aspects.group) {
			this.groups = [aspects.group.getChildlessCopy(true)];
		}

		if (aspects.collections) {
			this.collections = {};
			aspects.collections.forEach(tg => {
				let copy = tg.getUndoCopy();
				this.collections[tg.uuid] = copy;
			})
		}

		if (aspects.textures) {
			this.textures = {}
			aspects.textures.forEach(t => {
				let tex = t.getUndoCopy(aspects.bitmap)
				this.textures[t.uuid] = tex
			})
		}

		if (aspects.texture_groups) {
			this.texture_groups = {};
			aspects.texture_groups.forEach(tg => {
				let copy = tg.getUndoCopy()
				this.texture_groups[tg.uuid] = copy;
			})
		}

		if (aspects.layers) {
			this.layers = {};
			aspects.layers.forEach(layer => {
				let copy = layer.getUndoCopy(aspects.bitmap)
				this.layers[layer.uuid] = copy;
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
		if (aspects.animation_controllers) {
			this.animation_controllers = {}
			aspects.animation_controllers.forEach(a => {
				scope.animation_controllers[a.uuid] = a.getUndoCopy();
			})
		}
		if (aspects.animation_controller_state) {
			this.animation_controller_state = aspects.animation_controller_state.getUndoCopy();
			this.animation_controller_state.controller = aspects.animation_controller_state.controller?.uuid;
		}

		if (aspects.display_slots) {
			scope.display_slots = {}
			aspects.display_slots.forEach(slot => {
				if (Project.display_settings[slot]) {
					scope.display_slots[slot] = Project.display_settings[slot].copy()
				} else {
					scope.display_slots[slot] = null
				}
			})
		}

		if (aspects.exploded_view !== undefined) {
			this.exploded_view = !!aspects.exploded_view;
		}

		Blockbench.dispatchEvent('create_undo_save', {save: this, aspects})
		return this;
	}
	load(reference, mode) {
		let is_session = mode === 'session';
		let save = this;

		if (this.mode && Modes.options[this.mode] && Modes.selected.id != this.mode && mode != 'session') {
			Modes.options[this.mode].select();
		}
		
		if (this.uv_mode) {
			Project.box_uv = this.uv_mode.box_uv;
			Project.texture_width = this.uv_mode.width;
			Project.texture_height = this.uv_mode.height;
			Canvas.updateAllUVs()
		}

		if (this.elements) {
			for (var uuid in this.elements) {
				if (this.elements.hasOwnProperty(uuid)) {
					var element = this.elements[uuid]

					var new_element = OutlinerNode.uuids[uuid]
					if (new_element) {
						for (var face in new_element.faces) {
							new_element.faces[face].reset()
						}
						new_element.extend(element)
						new_element.preview_controller.updateAll(new_element);
					} else {
						new_element = OutlinerElement.fromSave(element, true);
					}
				}
			}
			for (var uuid in reference.elements) {
				if (reference.elements.hasOwnProperty(uuid) && !this.elements.hasOwnProperty(uuid)) {
					var obj = OutlinerNode.uuids[uuid]
					if (obj) {
						obj.remove()
					}
				}
			}
			Canvas.updateVisibility()
		}

		if (this.outliner) {
			Group.multi_selected.empty();
			parseGroups(this.outliner)
			if (is_session) {
				function iterate(arr) {
					arr.forEach((obj) => {
						delete obj.isOpen;
						if (obj.children) {
							iterate(obj.children)
						}
					})
				}
				iterate(this.outliner)
			}
			if (Format.bone_rig) {
				Canvas.updateAllPositions()
			}
		}

		if (this.selected_groups && !is_session) {
			Group.multi_selected.empty();
			for (let uuid of this.selected_groups) {
				let sel_group = OutlinerNode.uuids[uuid];
				if (sel_group) {
					Group.multi_selected.push(sel_group)
				}
			}
		}

		/*if (this.selection && !is_session) {
			selected.length = 0;
			Outliner.elements.forEach((obj) => {
				if (this.selection.includes(obj.uuid)) {
					obj.selectLow()
					if (this.mesh_selection[obj.uuid]) {
						Project.mesh_selection[obj.uuid] = this.mesh_selection[obj.uuid];
					}
				}
			})
		}*/

		if (this.groups) {
			for (let saved_group of this.groups) {
				let group = OutlinerNode.uuids[saved_group.uuid];
				if (!group) continue;
				if (is_session) {
					delete saved_group.isOpen;
				}
				group.extend(saved_group)
				if (Format.bone_rig) {
					group.forEachChild(function(obj) {
						if (obj.preview_controller) obj.preview_controller.updateTransform(obj);
					})
				}
			}
		}

		if (this.collections) {
			for (let uuid in this.collections) {
				let collection;
				let data = this.collections[uuid];
				if (reference.collections[uuid]) {
					collection = Collection.all.find(tg => tg.uuid == uuid);
					if (collection) {
						collection.extend(data);
					}
				} else {
					collection = new Collection(data, uuid).add();
				}
				//order
				let index = Collection.all.indexOf(collection);
				if (index != -1 && index != data.index && typeof data.index == 'number') {
					Collection.all.remove(collection);
					Collection.all.splice(data.index, 0, collection);
				}
			}
			for (let uuid in reference.collections) {
				if (!this.collections[uuid]) {
					let collection = Collection.all.find(tg => tg.uuid == uuid);
					if (collection) {
						Collection.all.remove(collection);
					}
				}
			}
		}

		if (this.texture_groups) {
			for (let uuid in this.texture_groups) {
				let group;
				let data = this.texture_groups[uuid];
				if (reference.texture_groups[uuid]) {
					group = TextureGroup.all.find(tg => tg.uuid == uuid);
					if (group) {
						group.extend(data);
					}
				} else {
					group = new TextureGroup(data, uuid).add(false);
				}
				//order
				let index = TextureGroup.all.indexOf(group);
				if (index != -1 && index != data.index && typeof data.index == 'number') {
					TextureGroup.all.remove(group);
					TextureGroup.all.splice(data.index, 0, group);
				}
			}
			for (let uuid in reference.texture_groups) {
				if (!this.texture_groups[uuid]) {
					let group = TextureGroup.all.find(tg => tg.uuid == uuid);
					if (group) {
						TextureGroup.all.remove(group);
					}
				}
			}
		}
		if (this.textures) {
			Painter.current = {}
			for (var uuid in this.textures) {
				if (reference.textures[uuid]) {
					var tex = Texture.all.find(tex => tex.uuid == uuid)
					if (tex) {
						var require_reload = tex.mode !== this.textures[uuid].mode;
						tex.extend(this.textures[uuid]);
						if (tex.source_overwritten && this.textures[uuid].image_data) {
							// If the source file was overwritten by more recent changes, make sure to display the original data
							tex.convertToInternal(this.textures[uuid].image_data);
						}
						if (tex.layers_enabled) {
							tex.updateLayerChanges(true);
						}
						tex.updateSource();
						tex.keep_size = true;
						if (require_reload || reference.textures[uuid] === true) {
							tex.load()
						}
						tex.syncToOtherProject();
					}
				} else {
					var tex = new Texture(this.textures[uuid], uuid)
					tex.load().add(false)
				}
			}
			for (var uuid in reference.textures) {
				if (!this.textures[uuid]) {
					var tex = Texture.all.find(tex => tex.uuid == uuid)
					if (tex) {
						Texture.all.splice(Texture.all.indexOf(tex), 1)
					}
					if (Texture.selected == tex) {
						Texture.selected = undefined;
						Blockbench.dispatchEvent('update_texture_selection');
					}
				}
			}
			Canvas.updateAllFaces();
			updateInterfacePanels();
			UVEditor.vue.updateTexture();
		}

		if (this.layers) {
			let affected_textures = [];
			for (let uuid in this.layers) {
				if (reference.layers[uuid]) {
					let tex = Texture.all.find(tex => tex.uuid == this.layers[uuid].texture);
					let layer = tex && tex.layers.find(l => l.uuid == uuid);
					if (layer) {
						layer.extend(this.layers[uuid]);
						affected_textures.safePush(tex);
					}
				}
			}
			affected_textures.forEach(tex => {
				/*if (tex.source_overwritten && this.layers[uuid].image_data) {
					// If the source file was overwritten by more recent changes, make sure to display the original data
					tex.convertToInternal(this.layers[uuid].image_data);
				}*/
				tex.updateLayerChanges(true);
				tex.updateSource();
				tex.keep_size = true;
				tex.syncToOtherProject();
			})
			Canvas.updateAllFaces();
			UVEditor.vue.updateTexture();
		}

		if (this.texture_order) {
			Texture.all.sort((a, b) => {
				return this.texture_order.indexOf(a.uuid) - this.texture_order.indexOf(b.uuid);
			})
			Canvas.updateLayeredTextures()
		}

		if (this.selected_texture) {
			let tex = Texture.all.find(tex => tex.uuid == this.selected_texture);
			if (tex instanceof Texture) tex.select()
		} else if (this.selected_texture === null) {
			unselectTextures()
		}

		if (this.settings) {
			for (var key in this.settings) {
				settings[key].value = this.settings[key]
			}
		}


		if (this.animations) {
			for (var uuid in this.animations) {

				var animation = (reference.animations && reference.animations[uuid]) ? Undo.getItemByUUID(Animator.animations, uuid) : null;
				if (!animation) {
					animation = new Animation()
					animation.uuid = uuid
				}
				animation.extend(this.animations[uuid]).add(false)
				if (this.animations[uuid].selected) {
					animation.select()
				}
			}
			for (var uuid in reference.animations) {
				if (!this.animations[uuid]) {
					var animation = Undo.getItemByUUID(Animator.animations, uuid)
					if (animation) {
						animation.remove(false)
					}
				}
			}
		}
		if (this.animation_controllers) {
			for (var uuid in this.animation_controllers) {

				var controller = (reference.animation_controllers && reference.animation_controllers[uuid]) ? Undo.getItemByUUID(AnimationController.all, uuid) : null;
				if (!controller) {
					controller = new AnimationController();
					controller.uuid = uuid;
				}
				controller.extend(this.animation_controllers[uuid]).add(false);
				if (this.animation_controllers[uuid].selected) {
					controller.select();
				}
			}
			for (var uuid in reference.animation_controllers) {
				if (!this.animation_controllers[uuid]) {
					var controller = Undo.getItemByUUID(AnimationController.all, uuid);
					if (controller) {
						controller.remove(false);
					}
				}
			}
		}
		if (this.animation_controller_state) {
			let controller = AnimationController.all.find(controller => this.animation_controller_state.controller == controller.uuid);
			let state = controller && controller.states.find(state => state.uuid == this.animation_controller_state.uuid);
			if (state) {
				state.extend(this.animation_controller_state);
			}
		}

		if (this.keyframes) {
			var animation = Animation.selected;
			if (!animation || animation.uuid !== this.keyframes.animation) {
				animation = Animator.animations.findInArray('uuid', this.keyframes.animation)
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
				for (var uuid in this.keyframes) {
					if (uuid.length === 36 && this.keyframes.hasOwnProperty(uuid)) {
						var data = this.keyframes[uuid];
						var animator = animation.animators[data.animator];
						if (!animator) continue;
						var kf = getKeyframe(uuid, animator);
						if (kf) {
							kf.extend(data)
						} else {
							animator.addKeyframe(data, uuid);
						}
					}
				}
				for (var uuid in reference.keyframes) {
					if (uuid.length === 36 && reference.keyframes.hasOwnProperty(uuid) && !this.keyframes.hasOwnProperty(uuid)) {
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

		if (this.display_slots) {
			for (let slot in this.display_slots) {
				let data = this.display_slots[slot]

				if (!Project.display_settings[slot] && data) {
					Project.display_settings[slot] = new DisplaySlot(slot)
				} else if (data === null && Project.display_settings[slot]) {
					Project.display_settings[slot].default()
				}
				if (Project.display_settings[slot]) {
					Project.display_settings[slot].extend(data).update();
				}
			}
		}

		if (this.exploded_view !== undefined) {
			Project.exploded_view = BarItems.explode_skin_model.value = this.exploded_view;
			BarItems.explode_skin_model.updateEnabledState();
		}

		Blockbench.dispatchEvent('load_undo_save', {save: this, reference, mode})

		updateSelection()
		if ((this.outliner || this.groups?.length) && Format.bone_rig) {
			Canvas.updateAllBones();
		}
		if (this.outliner && Format.per_group_texture) {
			Canvas.updateAllFaces();
		}
		if (Modes.animate) {
			Animator.preview();
		}
	}
	addTexture(texture) {
		if (!this.textures) return;
		if (this.aspects.textures.safePush(texture)) {
			this.textures[texture.uuid] = texture.getUndoCopy(this.aspects.bitmap)
		}
	}
	addTextureOrLayer(texture) {
		if (texture.layers_enabled && texture.layers[0]) {
			let layer = texture.getActiveLayer();
			if (!this.aspects.layers) this.aspects.layers = [];
			if (this.aspects.layers.safePush(layer)) {
				if (!this.layers) this.layers = {};
				this.layers[layer.uuid] = layer.getUndoCopy(this.aspects.bitmap);
			}
		} else {
			if (!this.aspects.textures) this.aspects.textures = [];
			if (this.aspects.textures.safePush(texture)) {
				if (!this.textures) this.textures = {};
				this.textures[texture.uuid] = texture.getUndoCopy(this.aspects.bitmap)
			}
		}
	}
	addElements(elements, aspects = {}) {
		if (!this.elements) this.elements = {};
		elements.forEach(el => {
			this.elements[el.uuid] = el.getUndoCopy(aspects);
		})
	}
}
UndoSystem.selectionSave = class {
	constructor(aspects = 0) {
		this.aspects = aspects;
		this.elements = Outliner.selected.map(element => element.uuid);
		this.groups = Group.multi_selected.map(element => element.uuid);
		this.geometry = {};
		this.mode = Modes.selected.id;
		this.mesh_selection_mode = BarItems.selection_mode.value;

		for (let element of Outliner.selected) {
			if (element instanceof Mesh) {
				this.geometry[element.uuid] = {
					faces: element.getSelectedFaces().slice(),
					edges: element.getSelectedEdges().map(edge => edge.slice()),
					vertices: element.getSelectedVertices().slice(),
				}
			} else if (element instanceof Cube && !element.box_uv) {
				this.geometry[element.uuid] = {
					faces: UVEditor.getSelectedFaces(element).slice()
				}
			}
		}

		if (Texture.selected) {
			this.texture = Texture.selected?.uuid;
			if (aspects.texture_selection && UVEditor.texture) {
				let texture_selection = UVEditor.texture.selection;
				if (texture_selection.is_custom) {
					this.texture_selection = new Int8Array(texture_selection.array);
				} else {
					this.texture_selection = texture_selection.override;
				}
			}
		}

		if (Modes.animate && AnimationItem.selected) {
			this.animation_item = AnimationItem.selected.uuid;
		}
		if (Modes.animate && Animation.selected) {
			this.timeline = {};
			let animator_keys = Object.keys(Animation.selected.animators);
			for (let animator of Timeline.animators) {
				let key = animator_keys.find(key => Animation.selected.animators[key] == animator);
				this.timeline[key] = {
					selected: animator.selected,
					keyframes: animator.keyframes.filter(kf => kf.selected).map(kf => kf.uuid)
				}
			}
			this.graph_editor_channel = Timeline.vue.graph_editor_channel;
			this.graph_editor_axis = Timeline.vue.graph_editor_axis;
			this.graph_editor_open = Timeline.vue.graph_editor_open;
		}
	}
	load(reference) {
		Blockbench.addFlag('loading_selection_save');
		if (this.mode && Modes.options[this.mode] && Modes.selected.id != this.mode) {
			Modes.options[this.mode].select();
		}
		if (this.mesh_selection_mode) {
			BarItems.selection_mode.set(this.mesh_selection_mode);
		}

		unselectAllElements();
		if (this.elements) {
			Outliner.selected.replace(this.elements.map(uuid => OutlinerNode.uuids[uuid]).filter(element => element instanceof OutlinerElement));
		}
		if (this.groups) {
			for (let uuid of this.groups) {
				let group = OutlinerNode.uuids[uuid];
				if (group instanceof Group) {
					group.multiSelect();
				}
			}
		}

		if (this.geometry) {
			for (let uuid in this.geometry) {
				let geo_data = this.geometry[uuid];
				let element = OutlinerNode.uuids[uuid];
				if (element instanceof Mesh) {
					element.getSelectedFaces(true).replace(geo_data.faces);
					element.getSelectedEdges(true).replace(geo_data.edges);
					element.getSelectedVertices(true).replace(geo_data.vertices);

				} else if (element instanceof Cube && !element.box_uv) {
					UVEditor.getSelectedFaces(element, true).replace(geo_data.faces);
				}
			}
		}

		if (this.texture) {
			let texture = Texture.all.find(t => t.uuid == this.texture);
			if (texture) {
				texture.select();
			}
		}
		if (UVEditor.texture?.selection && this.texture_selection !== undefined) {
			let texture_selection = UVEditor.texture.selection;
			if (typeof this.texture_selection == 'boolean') {
				texture_selection.setOverride(this.texture_selection);
			} else if (texture_selection.height * texture_selection.width == this.texture_selection.length) {
				texture_selection.override = null;
				if (!texture_selection.array || texture_selection.array.length != this.texture_selection.length) {
					texture_selection.array = new Int8Array(this.texture_selection);
				} else {
					texture_selection.array.set(this.texture_selection);
				}
			}
			UVEditor.updateSelectionOutline();
		}
		if (Modes.animate && this.animation_item) {
			let animation = AnimationItem.all.find(a => a.uuid == this.animation_item);
			if (animation && animation != AnimationItem.selected) animation.select();
		}
		if (Modes.animate && Animation.selected && this.timeline) {
			Timeline.animators.empty();
			Keyframe.selected.forEach(kf => kf.selected = false);
			Keyframe.selected.empty();
			for (let uuid in this.timeline) {
				let animator = Animation.selected.animators[uuid];
				if (!animator) continue;
				Timeline.animators.push(animator);
				if (this.timeline[uuid].selected) animator.select();
				for (let kf_uuid of this.timeline[uuid].keyframes) {
					let kf = animator.keyframes.find(kf => kf.uuid == kf_uuid);
					if (kf) {
						Keyframe.selected.push(kf);
						kf.selected = true;
					}
				}
			}
			Timeline.vue.graph_editor_channel = this.graph_editor_channel;
			Timeline.vue.graph_editor_axis = this.graph_editor_axis;
			Timeline.vue.graph_editor_open = this.graph_editor_open;
			updateKeyframeSelection();
		}

		updateSelection();
		Blockbench.removeFlag('loading_selection_save');
	}
	matches(other) {
		if (this.texture_selection) return false;
		let compare = (a, b) => {
			if (typeof a != typeof b) return false;
			if (typeof a == 'function') return false;
			if (a instanceof Array && b instanceof Array) {
				if (a.length != b.length) return false;
				let i = 0;
				for (let item of a) {
					if (!compare(item, b[i])) return false;
					i++;
				}
				return true;
			}
			if (typeof a == 'object') {
				for (let key in a) {
					if (!compare(a[key], b[key])) return false;
				}
				return true;
			}
			return a == b;
		}
		for (let key in this) {
			if (key == 'aspects') continue;
			let result = compare(this[key], other[key]);
			if (result == false) return false;
		}
		return true;
	}
}

let Undo = null;

BARS.defineActions(function() {
	
	new Action('undo', {
		icon: 'undo',
		category: 'edit',
		condition: () => Project,
		keybind: new Keybind({key: 'z', ctrl: true}),
		click(e) {
			Project.undo.undo(e);
		}
	})
	new Action('redo', {
		icon: 'redo',
		category: 'edit',
		condition: () => Project,
		keybind: new Keybind({key: 'y', ctrl: true}),
		click(e) {
			Project.undo.redo(e);
		}
	})
	new Action('edit_history', {
		icon: 'history',
		category: 'edit',
		condition: () => Project,
		click() {
			let steps = [];
			Undo.history.forEachReverse((entry, index) => {
				index++;
				let step = {
					name: entry.action,
					time: new Date(entry.time).toLocaleTimeString(),
					index,
					type: entry.type,
					current: index == Undo.index
				};
				steps.push(step);
			})
			steps.push({
				name: 'Original',
				time: '',
				index: 0,
				type: 'original',
				current: Undo.index == 0
			})
			let step_selected = null;
			const dialog = new Dialog({
				id: 'edit_history',
				title: 'action.edit_history',
				component: {
					data() {return {
						steps,
						selected: null,
						icons: {
							original: 'draft',
							selection: 'arrow_selector_tool',
							edit: 'construction',
						}
					}},
					methods: {
						select(index) {
							this.selected = step_selected = index;
						},
						confirm() {
							dialog.confirm();
						}
					},
					template: `
						<div id="edit_history_list">
							<ul>
								<li v-for="step in steps" :class="{current: step.current, selected: step.index == selected}" @click="select(step.index)" @dblclick="confirm()">
									<dynamic-icon :icon="icons[step.type]" />
									<label>{{ step.name }}</label>
									<div class="edit_history_time">{{ step.time }}</div>
								</li>
							</ul>
						</div>
					`
				},
				onConfirm() {
					if (step_selected === null) return;

					let difference = step_selected - Undo.index;
					if (step_selected < Undo.index) {
						for (let i = 0; i < -difference; i++) {
							Undo.undo();
						}
					} else if (step_selected > Undo.index) {
						for (let i = 0; i < difference; i++) {
							Undo.redo();
						}
					}
				}
			}).show();
		}
	})
})