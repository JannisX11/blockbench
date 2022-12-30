class UndoSystem {
	constructor() {
		this.index = 0;
		this.history = [];
	}
	initEdit(aspects, amended = false) {
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
		if (!amended && this.amend_edit_menu) {
			this.closeAmendEditMenu();
		}
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
			action: action,
			time: Date.now()
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
		if (Project.EditSession && Project.EditSession.active) {
			Project.EditSession.sendEdit(entry)
		}
		return entry;
	}
	cancelEdit() {
		if (!this.current_save) return;
		Canvas.outlines.children.empty();
		if (this.amend_edit_menu) {
			this.closeAmendEditMenu();
		}
		this.loadSave(this.current_save, new UndoSystem.save(this.current_save.aspects))
		delete this.current_save;
	}
	closeAmendEditMenu() {
		if (this.amend_edit_menu) {
			this.amend_edit_menu.node.remove();
			delete this.amend_edit_menu;
		}
	}
	amendEdit(form, callback) {
		let scope = this;
		let input_elements = {};
		let dialog = document.createElement('div');
		dialog.id = 'amend_edit_menu';
		this.amend_edit_menu = {
			node: dialog,
			form: {}
		};

		let close_button = document.createElement('div');
		close_button.append(Blockbench.getIconNode('clear'));
		close_button.className = 'amend_edit_close_button';
		close_button.title = tl('dialog.close')
		close_button.addEventListener('click', (event) => {
			Undo.closeAmendEditMenu();
		})
		dialog.append(close_button);

		function updateValue() {
			let form_values = {};
			for (let key in form) {
				let input = scope.amend_edit_menu.form[key];
				if (input) {
					if (input.type == 'number') {
						form_values[key] = input.slider.get();
					}
				}
			}
			Undo.undo(null, true);
			callback(form_values, scope.amend_edit_menu.form);
		}

		for (let key in form) {
			let form_line = form[key];
			if (!Condition(form_line.condition)) continue;
			let line = document.createElement('div');
			line.className = 'amend_edit_line';
			dialog.append(line);
			this.amend_edit_menu.form[key] = {
				type: form_line.type || 'number',
				label: form_line.label
			}

			if (this.amend_edit_menu.form[key].type == 'number') {
				let getInterval = form_line.getInterval;
				if (form_line.interval_type == 'position') getInterval = getSpatialInterval;
				if (form_line.interval_type == 'rotation') getInterval = getRotationInterval;
				let slider = new NumSlider({
					id: 'amend_edit_slider',
					name: tl(form_line.label),
					private: true,
					onChange: updateValue,
					getInterval,
					settings: {
						default: form_line.value || 0,
						min: form_line.min,
						max: form_line.max,
						step: form_line.step||1,
					},
				});
				line.append(slider.node);
				input_elements[key] = slider;
				this.amend_edit_menu.form[key].slider = slider
				slider.update();
			}

			let label = document.createElement('label');
			label.innerText = tl(form_line.label);
			line.append(label);
		}

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
		if (!amended && this.amend_edit_menu) {
			this.closeAmendEditMenu();
		}
		if (this.history.length <= 0 || this.index < 1) return;

		Project.saved = false;
		this.index--;

		var entry = this.history[this.index]
		this.loadSave(entry.before, entry.post)
		if (Project.EditSession && remote !== true) {
			Project.EditSession.sendAll('command', 'undo')
		}
		Blockbench.dispatchEvent('undo', {entry})
	}
	redo(remote, amended) {
		if (!amended && this.amend_edit_menu) {
			this.closeAmendEditMenu();
		}
		if (this.history.length <= 0) return;
		if (this.index >= this.history.length) {
			return;
		}
		Project.saved = false;

		var entry = this.history[this.index]
		this.index++;
		this.loadSave(entry.post, entry.before)
		if (Project.EditSession && remote !== true) {
			Project.EditSession.sendAll('command', 'redo')
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
				if (reference.elements.hasOwnProperty(uuid) && !save.elements.hasOwnProperty(uuid)) {
					var obj = OutlinerNode.uuids[uuid]
					if (obj) {
						obj.remove()
					}
				}
			}
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
			var sel_group = OutlinerNode.uuids[save.selection_group]
			if (sel_group) {
				sel_group.select()
			}
		}

		if (save.selection && !is_session) {
			selected.length = 0;
			elements.forEach(function(obj) {
				if (save.selection.includes(obj.uuid)) {
					obj.selectLow()
					if (save.mesh_selection[obj.uuid]) {
						Project.mesh_selection[obj.uuid] = save.mesh_selection[obj.uuid];
					}
				}
			})
		}

		if (save.group) {
			var group = OutlinerNode.uuids[save.group.uuid]
			if (group) {
				if (is_session) {
					delete save.group.isOpen;
				}
				group.extend(save.group)
				if (Format.bone_rig) {
					group.forEachChild(function(obj) {
						if (obj.preview_controller) obj.preview_controller.updateTransform(obj);
					})
				}
			}
		}

		if (save.textures) {
			Painter.current = {}
			for (var uuid in save.textures) {
				if (reference.textures[uuid]) {
					var tex = Texture.all.find(tex => tex.uuid == uuid)
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
					var tex = Texture.all.find(tex => tex.uuid == uuid)
					if (tex) {
						Texture.all.splice(Texture.all.indexOf(tex), 1)
					}
					if (Texture.selected == tex) {
						Texture.selected = undefined;
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
		} else if (save.selected_texture === null) {
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
		if (save.animation_controllers) {
			for (var uuid in save.animation_controllers) {

				var controller = (reference.animation_controllers && reference.animation_controllers[uuid]) ? this.getItemByUUID(AnimationController.all, uuid) : null;
				if (!controller) {
					controller = new AnimationController();
					controller.uuid = uuid;
				}
				controller.extend(save.animation_controllers[uuid]).add(false);
				if (save.animation_controllers[uuid].selected) {
					controller.select();
				}
			}
			for (var uuid in reference.animation_controllers) {
				if (!save.animation_controllers[uuid]) {
					var controller = this.getItemByUUID(AnimationController.all, uuid);
					if (controller) {
						controller.remove(false);
					}
				}
			}
		}
		if (save.animation_controller_state) {
			let controller = AnimationController.all.find(controller => save.animation_controller_state.controller == controller.uuid);
			let state = controller && controller.states.find(state => state.uuid == save.animation_controller_state.uuid);
			if (state) {
				state.extend(save.animation_controller_state);
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

				if (!Project.display_settings[slot] && data) {
					Project.display_settings[slot] = new DisplaySlot()
				} else if (data === null && Project.display_settings[slot]) {
					Project.display_settings[slot].default()
				}
				Project.display_settings[slot].extend(data).update()
			}
		}

		if (save.exploded_view !== undefined) {
			Project.exploded_view = BarItems.explode_skin_model.value = save.exploded_view;
			BarItems.explode_skin_model.updateEnabledState();
		}

		Blockbench.dispatchEvent('load_undo_save', {save, reference, mode})

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
			this.selection = [];
			this.mesh_selection = {};
			selected.forEach(obj => {
				this.selection.push(obj.uuid);
				if (obj instanceof Mesh && Project.mesh_selection[obj.uuid]) {
					this.mesh_selection[obj.uuid] = JSON.parse(JSON.stringify(Project.mesh_selection[obj.uuid]));
				}
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
	}
	addTexture(texture) {
		if (!this.textures) return;
		if (this.aspects.textures.safePush(texture)) {
			this.textures[texture.uuid] = texture.getUndoCopy(this.aspects.bitmap)
		}
	}
	addElements(elements, aspects = {}) {
		if (!this.elements) this.elements = {};
		elements.forEach(el => {
			this.elements[el.uuid] = el.getUndoCopy(aspects);
		})
	}
}

let Undo = null;

BARS.defineActions(function() {
	
	new Action('undo', {
		icon: 'undo',
		category: 'edit',
		condition: () => Project,
		work_in_dialog: true,
		keybind: new Keybind({key: 'z', ctrl: true}),
		click(e) {
			Project.undo.undo(e);
		}
	})
	new Action('redo', {
		icon: 'redo',
		category: 'edit',
		condition: () => Project,
		work_in_dialog: true,
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
				step = {
					name: entry.action,
					time: new Date(entry.time).toLocaleTimeString(),
					index,
					current: index == Undo.index
				};
				steps.push(step);
			})
			steps.push({
				name: 'Original',
				time: '',
				index: 0,
				current: Undo.index == 0
			})
			let step_selected = null;
			const dialog = new Dialog({
				id: 'edit_history',
				title: 'action.edit_history',
				component: {
					data() {return {
						steps,
						selected: null
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
									{{ step.name }}
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