class AnimationControllerState {
	constructor(controller, data = 0) {
		this.controller = controller;
		this.uuid = guid();
		this.name = 'default';

		this.folded = false;
		this.fold = {
			animations: false,
			particles: true,
			sounds: true,
			on_entry: true,
			on_exit: true,
			transitions: true,
		};

		for (var key in AnimationControllerState.properties) {
			AnimationControllerState.properties[key].reset(this);
		}

		if (data) {
			this.extend(data);
		}
		this.controller.states.safePush(this);
	}
	extend(data = 0) {
		for (var key in AnimationControllerState.properties) {
			if (AnimationControllerState.properties[key].type == 'array') continue;
			AnimationControllerState.properties[key].merge(this, data)
		}
		if (data.animations instanceof Array) {
			this.animations.empty();
			data.animations.forEach(a => {
				let animation;
				if (typeof a == 'object' && typeof a.animation == 'string' && a.animation.length == 36) {
					// Internal
					animation = {
						uuid: a.uuid || guid(),
						key: a.key || '',
						animation: a.animation || '',// UUID
						blend_value: a.blend_value || ''
					};
				} else if (typeof a == 'object' || typeof a == 'string') {
					// Bedrock
					let key = typeof a == 'object' ? Object.keys(a)[0] : a;
					let anim_match = Animation.all.find(anim => anim.name.endsWith(key));
					animation = {
						uuid: guid(),
						key: key || '',
						animation: anim_match ? anim_match.uuid : '',// UUID
						blend_value: (typeof a == 'object' && a[key]) || ''
					};
				}
				this.animations.push(animation);
			})
		}
		if (data.transitions instanceof Array) {
			this.transitions.empty();
			data.transitions.forEach(a => {
				let transition;
				if (typeof a == 'object' && typeof a.target == 'string' && a.target.length == 36) {
					// Internal
					transition = {
						uuid: a.uuid || guid(),
						target: a.target || '',
						condition: a.condition || ''
					};
				} else if (typeof a == 'object') {
					// Bedrock
					let key = Object.keys(a)[0];
					let state_match = this.controller.states.find(state => state !== this && state.name == key);
					transition = {
						uuid: guid(),
						target: state_match ? state_match.uuid : '',
						condition: a[key] || ''
					};
					if (!state_match) {
						setTimeout(() => {
							// Delay to after loading controller so that all states can be found
							let state_match = this.controller.states.find(state => state !== this && state.name == key);
							if (state_match) transition.target = state_match.uuid;
						}, 0);
					}
				}
				this.transitions.push(transition);
			})
		}
	}
	getUndoCopy() {
		var copy = {
			uuid: this.uuid,
			name: this.name,
		}
		for (var key in AnimationControllerState.properties) {
			AnimationControllerState.properties[key].copy(this, copy)
		}
		return copy;
	}
	compileForBedrock() {
		let object = {};
		if (this.animations.length) {
			object.animations = this.animations.map(animation => {
				return animation.blend_value
					? new oneLiner({[animation.key]: animation.blend_value})
					: animation.key;
			})
		}
		['on_entry', 'on_exit'].forEach(type => {
			if (!this[type] || this[type] == '\\n') return;
			let lines = this[type].split('\n');
			lines = lines.filter(script => !!script.replace(/[\n\s;.]+/g, ''));
			lines = lines.map(line => (line.match(/;\s*$/) || line.startsWith('/')) ? line : (line+';'));
			object[type] = lines;
		})
		if (this.transitions.length) {
			object.transitions = this.transitions.map(transition => {
				let state = this.controller.states.find(s => s.uuid == transition.target);
				return new oneLiner({[state ? state.name : 'missing_state']: transition.condition})
			})
		}
		if (this.blend_transition) object.blend_transition = this.blend_transition;
		if (this.blend_via_shortest_path) object.blend_via_shortest_path = this.blend_via_shortest_path;
		return object;
	}
	select() {
		this.controller.selected_state = this;
	}
	rename() {
		Blockbench.textPrompt('generic.rename', this.name, value => {
			// Undo
			this.name = value;
			this.createUniqueName();
		})
	}
	remove(undo) {
		if (undo) {
			Undo.initEdit({animations: [this.controller]});
		}
		this.controller.states.forEach(state => {
			state.transitions.forEach(transition => {
				if (transition.target == this.uuid) transition.target = '';
			})
		})
		this.controller.states.remove(this);
		if (this.controller.selected_state == this) this.controller.selected_state = null;
		if (undo) {
			Undo.finishEdit('Remove animation controller state');
		}
	}
	createUniqueName() {
		var scope = this;
		var others = this.controller.states;
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
		for (var num = 2; num < 8e3; num++) {
			if (check(name+num)) {
				scope.name = name+num;
				return scope.name;
			}
		}
		return false;
	}
	addAnimation() {
		// Undo
		let animation = {
			key: '',
			animation: '',// UUID
			blend_value: ''
		};
		this.animations.push(animation);
		this.fold.animations = false;
	}
	addTransition(target = '') {
		// Undo
		let transition = {
			uuid: guid(),
			target, // UUID
			condition: ''
		};
		this.transitions.push(transition);
		this.fold.transitions = false;
	}
	sortAnimation(event) {
		// Undo
		var item = this.animations.splice(event.oldIndex, 1)[0];
		this.animations.splice(event.newIndex, 0, item);
	}
	openMenu(event) {
		AnimationControllerState.prototype.menu.open(event, this);
	}
}
new Property(AnimationControllerState, 'array', 'animations');
new Property(AnimationControllerState, 'array', 'transitions');
new Property(AnimationControllerState, 'array', 'sounds');
new Property(AnimationControllerState, 'array', 'particles');
new Property(AnimationControllerState, 'string', 'on_entry');
new Property(AnimationControllerState, 'string', 'on_exit');
new Property(AnimationControllerState, 'number', 'blend_transition');
new Property(AnimationControllerState, 'boolean', 'blend_via_shortest_path');
AnimationControllerState.prototype.menu = new Menu([
	{
		id: 'set_as_initial_state',
		name: 'Initial State',
		icon: (state) => (state == AnimationController.selected?.initial_state ? 'radio_button_checked' : 'radio_button_unchecked'),
		click(state) {
			if (!AnimationController.selected) return;
			// undo
			AnimationController.selected.initial_state = state.uuid;
		}
	},
	'_',
	'duplicate',
	'rename',
	'delete',
]);

class AnimationController extends AnimationItem {
	constructor(data) {
		super(data);
		this.name = '';
		this.uuid = guid()
		this.playing = false;
		this.selected = false;
		this.states = [];
		this.selected_state = null;

		for (var key in AnimationController.properties) {
			AnimationController.properties[key].reset(this);
		}
		if (typeof data === 'object') {
			this.extend(data);
			if (isApp && Format.animation_files && data.saved_name) {
				this.saved_name = data.saved_name;
			}
		}
	}
	extend(data) {
		for (var key in AnimationController.properties) {
			AnimationController.properties[key].merge(this, data)
		}
		Merge.string(this, data, 'name')

		if (data.states instanceof Array) {
			data.states.forEach(template => {
				let state = this.states.find(state2 => state2.name === template.name || (template.uuid && state2.uuid === template.uuid));
				if (state) {
					state.extend(template);
				} else {
					state = new AnimationControllerState(this, template);
				}
			})
		} else if (typeof data.states === 'object') {
			for (let name in data.states) {
				let state = this.states.find(state2 => state2.name === name);
				if (state) {
					state.extend(data.states[name]);
				} else {
					state = new AnimationControllerState(this, data.states[name]);
				}
				state.name = name;
			}
		}
		if (typeof data.selected_state == 'string') {
			let state = this.states.find(s => s.uuid == data.selected_state);
			if (state) this.selected_state = state;
		}
		if (data.states) {
			this.states.forEach(state => state.createUniqueName());
		}
		return this;
	}
	getUndoCopy(options = 0, save) {
		var copy = {
			uuid: this.uuid,
			name: this.name,
			selected: this.selected,
			selected_state: this.selected_state ? this.selected_state.uuid : null
		}
		for (var key in AnimationController.properties) {
			AnimationController.properties[key].copy(this, copy);
		}
		copy.states = this.states.map(state => {
			return state.getUndoCopy();
		})
		return copy;
	}
	compileForBedrock() {
		let object = {};
		if (!this.states.length) return object;

		let initial_state = this.states.find(s => s.name == 'default') || this.states[0];
		if (initial_state.name !== 'default') object.initial_state = initial_state.name;

		object.states = {};
		this.states.forEach(state => {
			object.states[state.name] = state.compileForBedrock();
		})

		return object;
	}
	save() {
		if (isApp && !this.path) {
			Blockbench.export({
				resource_id: 'animation_controller',
				type: 'JSON Animation Controller',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation_controllers',
				startpath: this.path,
				custom_writer: (content, path) => {
					if (!path) return
					this.path = path;
					this.save();
				}
			})
			return;
		}
		let content = {
			format_version: '1.19.0',
			animation_controllers: {
				[this.name]: this.compileForBedrock()
			}
		}
		if (isApp && this.path) {
			if (fs.existsSync(this.path)) {
				//overwrite path
				let data;
				try {
					data = fs.readFileSync(this.path, 'utf-8');
					data = autoParseJSON(data, false);
					if (typeof data.animation_controllers !== 'object') {
						throw 'Incompatible format'
					}

				} catch (err) {
					data = null;
					var answer = electron.dialog.showMessageBoxSync(currentwindow, {
						type: 'warning',
						buttons: [
							tl('message.bedrock_overwrite_error.overwrite'),
							tl('dialog.cancel')
						],
						title: 'Blockbench',
						message: tl('message.bedrock_overwrite_error.message'),
						detail: err+'',
						noLink: false
					})
					if (answer === 1) {
						return;
					}
				}
				if (data) {
					let animation = content.animation_controllers[this.name];
					content = data;
					if (this.saved_name && this.saved_name !== this.name) delete content.animation_controllers[this.saved_name];
					content.animation_controllers[this.name] = animation;

					// Sort
					let file_keys = Object.keys(content.animation_controllers);
					let anim_keys = Animation.all.filter(anim => anim.path == this.path).map(anim => anim.name);
					let changes = false;
					let index = 0;

					anim_keys.forEach(key => {
						let key_index = file_keys.indexOf(key);
						if (key_index == -1) {
							//Skip
						} else if (key_index < index) {
							file_keys.splice(key_index, 1);
							file_keys.splice(index, 0, key);
							changes = true;

						} else {
							index = key_index;
						}
					})
					if (changes) {
						let sorted_animation_controllers = {};
						file_keys.forEach(key => {
							sorted_animation_controllers[key] = content.animation_controllers[key];
						})
						content.animation_controllers = sorted_animation_controllers;
					}
				}
			}
			// Write
			Blockbench.writeFile(this.path, {content: compileJSON(content)}, (real_path) => {
				this.saved = true;
				this.saved_name = this.name;
				this.path = real_path;
			});

		} else {
			// Web Download
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
				startpath: this.path,
				content: compileJSON(content),
			}, (real_path) => {
				this.path == real_path;
				this.saved = true;
			})
		}
		return this;
	}
	select() {
		Prop.active_panel = 'animations';
		if (this == AnimationController.selected) return;
		AnimationItem.all.forEach((a) => {
			a.selected = a.playing = false;
		})

		Panels.animation_controllers.inside_vue.controller = this;

		this.selected = true;
		this.playing = true;
		AnimationItem.selected = this;

		if (Modes.animate) {
			Animator.preview();
			updateInterface();
		}
		return this;
	}
	createUniqueName(arr) {
		var scope = this;
		var others = AnimationController.all;
		if (arr && arr.length) {
			arr.forEach(g => {
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
		for (var num = 2; num < 8e3; num++) {
			if (check(name+num)) {
				scope.name = name+num;
				return scope.name;
			}
		}
		return false;
	}
	rename() {
		var scope = this;
		Blockbench.textPrompt('generic.rename', this.name, function(name) {
			if (name && name !== scope.name) {
				Undo.initEdit({animations: [scope]});
				scope.name = name;
				scope.createUniqueName();
				Undo.finishEdit('Rename animation');
			}
		})
		return this;
	}
	togglePlayingState(state) {
		if (!this.selected) {
			this.playing = state !== undefined ? state : !this.playing;
			Animator.preview();
		} else {
			Timeline.start();
		}
		return this.playing;
	}
	showContextMenu(event) {
		this.select();
		this.menu.open(event, this);
		return this;
	}
	add(undo) {
		if (undo) {
			Undo.initEdit({animations: []})
		}
		if (!AnimationController.all.includes(this)) {
			AnimationController.all.push(this)
		}
		if (undo) {
			this.select()
			Undo.finishEdit('Add animation controller', {animations: [this]})
		}
		return this;
	}
	remove(undo, remove_from_file = true) {
		if (undo) {
			Undo.initEdit({animations: [this]})
		}
		AnimationController.all.remove(this)
		if (undo) {
			Undo.finishEdit('Remove animation', {animations: []})

			if (isApp && remove_from_file && this.path && fs.existsSync(this.path)) {
				Blockbench.showMessageBox({
					translateKey: 'delete_animation',
					icon: 'movie',
					buttons: ['generic.delete', 'dialog.cancel'],
					confirm: 0,
					cancel: 1,
				}, (result) => {
					if (result == 0) {
						let content = fs.readFileSync(this.path, 'utf-8');
						let json = autoParseJSON(content, false);
						if (json && json.animations && json.animations[this.name]) {
							delete json.animations[this.name];
							Blockbench.writeFile(this.path, {content: compileJSON(json)});
							Undo.history.last().before.animations[this.uuid].saved = false
						}
					}
				})
			}
		}
		Blockbench.dispatchEvent('remove_animation', {animations: [this]})
		if (Animation.selected === this) {
			Animation.selected = null;
			Timeline.clear();
			Animator.preview();
		}
		return this;
	}
	propertiesDialog() {
		let dialog = new Dialog({
			id: 'animation_properties',
			title: this.name,
			width: 660,
			part_order: ['form', 'component'],
			form: {
				name: {label: 'generic.name', value: this.name},
				path: {
					label: 'menu.animation.file',
					value: this.path,
					type: 'file',
					extensions: ['json'],
					filetype: 'JSON Animation',
					condition: Animation.properties.path.condition
				},
				loop: {
					label: 'menu.animation.loop',
					type: 'select',
					value: this.loop,
					options: {
						once: 'menu.animation.loop.once',
						hold: 'menu.animation.loop.hold',
						loop: 'menu.animation.loop.loop',
					},
				},
				override: {label: 'menu.animation.override', type: 'checkbox', value: this.override},
				snapping: {label: 'menu.animation.snapping', type: 'number', value: this.snapping, step: 1, min: 10, max: 500},
			},
			component: {
				components: {VuePrismEditor},
				data: {
					anim_time_update: this.anim_time_update,
					blend_weight: this.blend_weight,
					start_delay: this.start_delay,
					loop_delay: this.loop_delay,
					loop_mode: this.loop
				},
				template: 
					`<div id="animation_properties_vue">
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.anim_time_update')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="anim_time_update" language="molang" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.blend_weight')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="blend_weight" language="molang" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar">
							<label class="name_space_left">${tl('menu.animation.start_delay')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="start_delay" language="molang" :line-numbers="false" />
						</div>
						<div class="dialog_bar form_bar" v-if="loop_mode == 'loop'">
							<label class="name_space_left">${tl('menu.animation.loop_delay')}:</label>
							<vue-prism-editor class="molang_input dark_bordered" v-model="loop_delay" language="molang" :line-numbers="false" />
						</div>
					</div>`
			},
			onFormChange(form) {
				this.component.data.loop_mode = form.loop;
			},
			onConfirm: form_data => {
				dialog.hide().delete();
				if (
					form_data.loop != this.loop
					|| form_data.name != this.name
					|| (isApp && form_data.path != this.path)
					|| form_data.loop != this.loop
					|| form_data.override != this.override
					|| form_data.snapping != this.snapping
					|| dialog.component.data.anim_time_update != this.anim_time_update
					|| dialog.component.data.blend_weight != this.blend_weight
					|| dialog.component.data.start_delay != this.start_delay
					|| dialog.component.data.loop_delay != this.loop_delay
				) {
					Undo.initEdit({animations: [this]});

					this.extend({
						loop: form_data.loop,
						name: form_data.name,
						override: form_data.override,
						snapping: form_data.snapping,
						anim_time_update: dialog.component.data.anim_time_update.trim().replace(/\n/g, ''),
						blend_weight: dialog.component.data.blend_weight.trim().replace(/\n/g, ''),
						start_delay: dialog.component.data.start_delay.trim().replace(/\n/g, ''),
						loop_delay: dialog.component.data.loop_delay.trim().replace(/\n/g, ''),
					})
					this.createUniqueName();
					if (isApp) this.path = form_data.path;

					Blockbench.dispatchEvent('edit_animation_properties', {animation: this})

					Undo.finishEdit('Edit animation properties');
				}
			},
			onCancel() {
				dialog.hide().delete();
			}
		})
		dialog.show();
	}
}
	Object.defineProperty(AnimationController, 'all', {
		get() {
			return Project.animation_controllers || [];
		},
		set(arr) {
			Project.animation_controllers.replace(arr);
		}
	})
	AnimationController.selected = null;
	AnimationController.prototype.menu = new Menu([
		'copy',
		'paste',
		'duplicate',
		'_',
		{
			name: 'menu.animation.save',
			id: 'save',
			icon: 'save',
			condition: () => Format.animation_files,
			click(animation) {
				animation.save();
			}
		},
		{
			name: 'menu.animation.open_location',
			id: 'open_location',
			icon: 'folder',
			condition(animation) {return isApp && Format.animation_files && animation.path && fs.existsSync(animation.path)},
			click(animation) {
				shell.showItemInFolder(animation.path);
			}
		},
		'rename',
		{
			id: 'unload',
			name: 'menu.animation.unload',
			icon: 'remove',
			condition: () => Format.animation_files,
			click(animation) {
				Undo.initEdit({animations: [animation]})
				animation.remove(false, false);
				Undo.finishEdit('Unload animation', {animations: []})
			}
		},
		'delete',
		'_',
		{name: 'menu.animation.properties', icon: 'list', click(animation) {
			animation.propertiesDialog();
		}}
	])
	AnimationController.prototype.file_menu = Animation.prototype.file_menu;
	new Property(AnimationController, 'boolean', 'saved', {default: true})
	new Property(AnimationController, 'string', 'path', {condition: () => isApp})
	new Property(AnimationController, 'string', 'initial_state')

AnimationController.presets = [
	{
		name: 'empty',
		states: {
			default: {}
		}
	},
	{
		name: 'simple',
		states: {
			default: {
				transitions: [{active: 'query.foo'}]
			},
			active: {
				transitions: [{default: '!query.foo'}]
			}
		}
	},
	{
		name: 'walking',
		states: {
			idle: {},
			walking: {}
		}
	}
];

Interface.definePanels(() => {
	let panel = new Panel('animation_controllers', {
		icon: 'timeline',
		condition: {modes: ['animate'], features: ['animation_controllers'], method: () => AnimationController.selected},
		default_position: {
			slot: 'bottom',
			float_position: [100, 400],
			float_size: [600, 300],
			height: 260,
		},
		onResize() {
			if (this.inside_vue) this.inside_vue.updateConnectionWrapperOffset();
		},
		component: {
			name: 'panel-animation-controllers',
			components: {VuePrismEditor},
			data() {return {
				controller: null,
				presets: AnimationController.presets,
				zoom: 1,
				connection_wrapper_offset: 0
			}},
			methods: {
				loadPreset(preset) {
					this.controller.extend({
						states: preset.states
					});
				},
				toggleStateSection(state, section) {
					state.fold[section] = !state.fold[section];
				},
				openAnimationMenu(state, animation, target) {
					let apply = anim => {
						animation.key = anim.name.split(/\./).last();
						animation.animation = anim.uuid;
					}
					let list = [];
					Animation.all.forEach(anim => {
						list.push({
							name: anim.name,
							icon: 'movie',
							click: () => apply(anim)
						})
					})
					list.push('_');
					AnimationController.all.forEach(anim => {
						if (anim == this.controller) return;
						list.push({
							name: anim.name,
							icon: 'list',
							click: () => apply(anim)
						})
					})
					let menu = new Menu('controller_state_animations', list, {searchable: list.length > 7});
					menu.open(target);
				},
				openTransitionMenu(this_state, transition, event) {
					let list = [];
					this.controller.states.forEach(state => {
						if (state == this_state) return;
						list.push({
							name: state.name,
							icon: transition.target == state.uuid ? 'radio_button_checked' : 'radio_button_unchecked',
							click: () => {
								transition.target = state.uuid;
							}
						})
					})
					let menu = new Menu('controller_state_transitions', list, {searchable: list.length > 7});
					menu.open(event.target);
				},
				addState() {
					BarItems.add_animation_controller_state.trigger();
				},
				sortStates(event) {
					// Undo
					var item = this.controller.states.splice(event.oldIndex, 1)[0];
					console.log(item)
					this.controller.states.splice(event.newIndex, 0, item);
				},
				getStateName(uuid) {
					let state = this.controller.states.find(s => s.uuid == uuid);
					return state ? state.name : '';
				},
				onMouseWheel(event) {
					if (event.ctrlOrCmd) {
						let delta = (event.deltaY < 0) ? 0.1 : -0.1;
						this.zoom = Math.clamp(this.zoom + delta, 0.3, 1);
						this.updateConnectionWrapperOffset();
					}
				},
				updateConnectionWrapperOffset() {
					Vue.nextTick(() => {
						let first = document.querySelector('#animation_controllers_wrapper .controller_state');
						this.connection_wrapper_offset = first ? first.offsetLeft : 0;
					})
				},
				deselect(event) {
					if (this.controller && event.target?.id == 'animation_controllers_wrapper' || event.target?.parentElement?.id == 'animation_controllers_wrapper') {
						this.controller.selected_state = null;
					}
				},
				selectConnection(connection, event) {
					let state = this.controller.states[connection.state_index];
					let target = this.controller.states[connection.target_index];
					// todo: scroll to state
					if (state == this.controller.selected_state) {
						target.select();
					} else {
						state.select();
					}
				}
			},
			computed: {
				connections() {
					let connections = {
						forward: [],
						backward: [],
						colors: {},
						max_layer_top: 0,
						max_layer_bottom: 0
					};
					if (!this.controller) return connections;
					let {states, selected_state} = this.controller;
					// todo: implement different state width
					let selected_index = states.indexOf(selected_state);
					let incoming_plugs = {};

					let plug_gap = 16;

					states.forEach((state, state_index) => {
						state.transitions.forEach(transition => {
							let target_index = states.findIndex(s => s.uuid == transition.target);
							let target = states[target_index];
							let selected = state == this.controller.selected_state || !this.controller.selected_state;
							let relevant = target == this.controller.selected_state;
							let back = target_index < state_index;
							let range = back ? [target_index, state_index] : [state_index, target_index];
							let connection_list = back ? connections.backward : connections.forward;
							let color = markerColors[(connections.forward.length + connections.backward.length) % markerColors.length].standard;

							if (!incoming_plugs[target.uuid]) incoming_plugs[target.uuid] = {top: 0, bottom: 0};

							let layer = 0;
							for (let i = range[0]; i < range[1]; i++) {
								while (connection_list.find(c => c.layer == layer && i >= c.range[0] && i < c.range[1])) {
									layer++;
								}
							}
							let same_level_transitions = state.transitions.filter(t => {
								return (state_index - states.findIndex(s => s.uuid == t.target) > 0) == back
							});
							let start_plug_offset = (same_level_transitions.indexOf(transition) - (same_level_transitions.length-1)/2) * Math.min(plug_gap, 200 / same_level_transitions.length);

							let con = {
								state_index, target_index,
								layer, range,
								selected, relevant, color,
							}

							if (back) {// Top
								connections.max_layer_top = Math.max(connections.max_layer_top, layer);
								con.end_x = state_index * 312 + 156 + start_plug_offset;
								con.start_x = target_index * 312 + (300 - 25 - incoming_plugs[target.uuid].top * plug_gap);
								incoming_plugs[target.uuid].top++;

							} else {// Bottom
								connections.max_layer_bottom = Math.max(connections.max_layer_bottom, layer);
								con.start_x = state_index * 312 + 156 - start_plug_offset;
								con.end_x = target_index * 312 + 25 + incoming_plugs[target.uuid].bottom * plug_gap;
								incoming_plugs[target.uuid].bottom++;
							}

							connection_list.push(con);
							connections.colors[transition.uuid] = color;
						})
					})
					return connections;
				}
			},
			watch: {
				controller() {
					this.updateConnectionWrapperOffset();
				}
			},
			template: `
				<div id="animation_controllers_wrapper" @mousewheel="onMouseWheel($event)" :style="{zoom}" @click="deselect($event)">
					<div class="controller_state_connection_wrapper_top" :style="{'--max-layer': connections.max_layer_top, left: connection_wrapper_offset + 'px'}">
						<div v-for="connection in connections.backward"
							:style="{'--color-marker': connection.color, '--layer': connection.layer, left: (connection.start_x)+'px', width: (connection.end_x - connection.start_x)+'px'}"
							class="controller_state_connection backward" :class="{selected: connection.selected, relevant: connection.relevant}"
							@click="selectConnection(connection, $event)"
						></div>
					</div>
					<ul v-if="controller && controller.states.length" v-sortable="{onUpdate: sortStates, animation: 160, handle: '.controller_state_title_bar'}">
						<li v-for="state in controller.states" :key="state.uuid"
							class="controller_state"
							:class="{selected: controller.selected_state == state, folded: state.folded, initial_state: controller.initial_state == state.uuid}"
							@click="state.select()"
							@contextmenu="state.openMenu($event)"
						>
							<div class="controller_state_title_bar">
								<label @dblclick="state.rename()">{{ state.name }}</label>
								<div class="tool" title="" @click="state.openMenu($event.target)" v-if="!state.folded"><i class="material-icons">drag_handle</i></div>
								<div class="tool" title="" @click="state.folded = !state.folded"><i class="material-icons">{{ state.folded ? 'chevron_right' : 'chevron_left' }}</i></div>
							</div>

							<template v-if="!state.folded">

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'animations')">
									<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.animations, "fa-angle-down": !state.fold.animations}\'></i>
									<label>${tl('animation_controllers.state.animations')}</label>
									<span class="controller_state_section_info" v-if="state.animations.length">{{ state.animations.length }}</span>
									<i v-if="!state.fold.animations" class="icon fa fa-plus" @click.stop="state.addAnimation()"></i>
								</div>
								<ul v-if="!state.fold.animations" v-sortable="{onUpdate: state.sortAnimation, animation: 160, handle: '.controller_item_drag_handle'}">
									<li v-for="animation in state.animations" :key="animation.uuid" class="controller_animation">
										<div class="controller_item_drag_handle"></div>
										<div class="tool" title="" @click="openAnimationMenu(state, animation, $event.target)"><i class="material-icons">movie</i></div>
										<input type="text" class="dark_bordered" v-model="animation.key">
										<vue-prism-editor 
											class="molang_input dark_bordered tab_target"
											v-model="animation.blend_value"
											language="molang"
											:ignoreTabKey="true"
											:line-numbers="false"
										/>
									</li>
								</ul>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'particles')">
									<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.particles, "fa-angle-down": !state.fold.particles}\'></i>
									<label>${tl('animation_controllers.state.particles')}</label>
									<span class="controller_state_section_info" v-if="state.particles.length">{{ state.particles.length }}</span>
								</div>
								<ul v-if="!state.fold.particles">
									<li>
										<input type="text" class="dark_bordered">
									</li>
								</ul>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'sounds')">
									<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.sounds, "fa-angle-down": !state.fold.sounds}\'></i>
									<label>${tl('animation_controllers.state.sounds')}</label>
									<span class="controller_state_section_info" v-if="state.sounds.length">{{ state.sounds.length }}</span>
								</div>
								<ul v-if="!state.fold.sounds">
									<li>
										<input type="text" class="dark_bordered">
									</li>
								</ul>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'on_entry')">
									<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.on_entry, "fa-angle-down": !state.fold.on_entry}\'></i>
									<label>${tl('animation_controllers.state.on_entry')}</label>
									<span class="controller_state_section_info" v-if="state.on_entry">{{ state.on_entry.split('\\n').length }}</span>
								</div>
								<vue-prism-editor
									v-if="!state.fold.on_entry"
									class="molang_input dark_bordered tab_target"
									v-model="state.on_entry"
									language="molang"
									:ignoreTabKey="true"
									:line-numbers="false"
								/>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'on_exit')">
									<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.on_exit, "fa-angle-down": !state.fold.on_exit}\'></i>
									<label>${tl('animation_controllers.state.on_exit')}</label>
									<span class="controller_state_section_info" v-if="state.on_exit">{{ state.on_exit.split('\\n').length }}</span>
								</div>
								<vue-prism-editor
									v-if="!state.fold.on_exit"
									class="molang_input dark_bordered tab_target"
									v-model="state.on_exit"
									language="molang"
									:ignoreTabKey="true"
									:line-numbers="false"
								/>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'transitions')">
									<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.transitions, "fa-angle-down": !state.fold.transitions}\'></i>
									<label>${tl('animation_controllers.state.transitions')}</label>
									<span class="controller_state_section_info" v-if="state.transitions.length">{{ state.transitions.length }}</span>
									<i v-if="!state.fold.transitions" class="icon fa fa-plus" @click.stop="state.addTransition()"></i>
								</div>
								<template v-if="!state.fold.transitions">
									<ul v-sortable="{onUpdate: state.sortTransition, animation: 160, handle: '.controller_item_drag_handle'}">
										<li v-for="transition in state.transitions" :key="transition.uuid" class="controller_transition">
											<div class="controller_item_drag_handle" :style="{'--color-marker': connections.colors[transition.uuid]}"></div>
											<bb-select @click="openTransitionMenu(state, transition, $event)">{{ getStateName(transition.target) }}</bb-select>
											<vue-prism-editor 
												class="molang_input dark_bordered tab_target"
												v-model="transition.condition"
												language="molang"
												:ignoreTabKey="true"
												:line-numbers="false"
											/>
										</li>
									</ul>
									<div class="controller_state_input_bar">
										<label>${tl('animation_controllers.state.blend_transition')}</label>
										<input type="number" class="dark_bordered" style="width: 70px;" v-model="state.blend_transition" min="0" step="0.05">
									</div>
									<div class="controller_state_input_bar">
										<label :for="state.uuid + '_shortest_path'">${tl('animation_controllers.state.shortest_path')}</label>
										<input type="checkbox" :id="state.uuid + '_shortest_path'" v-model="state.shortest_path">
									</div>
								</template>
							</template>
						</li>
						<li class="controller_add_column" @click="addState()">
							<i class="material-icons">add</i>
						</li>
					</ul>
					<div class="controller_state_connection_wrapper_bottom" :style="{'--max-layer': connections.max_layer_top, left: connection_wrapper_offset + 'px'}">
						<div v-for="connection in connections.forward"
							:style="{'--color-marker': connection.color, '--layer': connection.layer, left: (connection.start_x)+'px', width: (connection.end_x - connection.start_x)+'px'}"
							class="controller_state_connection forward" :class="{selected: connection.selected, relevant: connection.relevant}"
							@click="selectConnection(connection, $event)"
						></div>
					</div>
					<div v-else-if="controller" id="animation_controller_presets">
						<h4>${tl('animation_controllers.select_preset')}</h4>
						<ul>
							<li v-for="preset in presets" :key="preset.name" @click="loadPreset(preset)">
								{{ preset.name }}
							</li>
						</ul>
					</div>
				</div>
			`
		}
	})
})

Object.defineProperty(AnimationItem, 'all', {
	get() {
		return [...Animation.all, ...AnimationController.all]
	},
	set() {
		console.warn('AnimationItem.all is read-only')
	}
})
Object.defineProperty(AnimationItem, 'selected', {
	get() {
		return Animation.selected || AnimationController.selected
	},
	set(item) {
		if (item instanceof Animation) {
			Animation.selected = item;
			AnimationController.selected = null;
		} else {
			Animation.selected = null;
			AnimationController.selected = item;
		}
	}
})

BARS.defineActions(function() {
	new Action('add_animation_controller', {
		icon: 'post_add',
		category: 'animation',
		condition: {modes: ['animate'], features: ['animation_controllers']},
		click() {
			new AnimationController({
				name: 'controller.animation.' + (Project.geometry_name||'model') + '.new'
			}).add(true)//.propertiesDialog()

		}
	})
	new Action('add_animation_controller_state', {
		icon: 'add_box',
		category: 'animation',
		condition: {modes: ['animate'], features: ['animation_controllers'], method: () => AnimationController.selected},
		click() {
			new AnimationControllerState(AnimationController.selected, {})

		}
	})
})
