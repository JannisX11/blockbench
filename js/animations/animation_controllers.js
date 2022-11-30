class AnimationControllerState {
	constructor(controller, data = 0) {
		this.controller = controller;
		this.uuid = guid();
		this.name = 'default';

		this.fold = {
			animations: false,
			particles: true,
			sounds: true,
			on_entry: true,
			on_exit: true,
			transitions: false,
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
			AnimationControllerState.properties[key].merge(this, data)
		}
	}
}
new Property(AnimationControllerState, 'string', 'on_entry');
new Property(AnimationControllerState, 'string', 'on_exit');

class AnimationController {
	constructor(data) {
		this.name = '';
		this.uuid = guid()
		this.playing = false;
		this.selected = false;
		this.states = [];

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
			data.states.forEach(state => {
				if (!this.states.find(state2.name !== state.name)) {
					this.states.push(new AnimationControllerState(state));
				}
			})
		}
		return this;
	}
	getUndoCopy(options = 0, save) {
		var copy = {
			uuid: this.uuid,
			name: this.name,
			selected: this.selected,
		}
		for (var key in Animation.properties) {
			Animation.properties[key].copy(this, copy)
		}
		return copy;
	}
	compileBedrockAnimationController() {
		return {};
	}
	save() {
		if (isApp && !this.path) {
			Blockbench.export({
				resource_id: 'animation',
				type: 'JSON Animation',
				extensions: ['json'],
				name: (Project.geometry_name||'model')+'.animation',
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
			format_version: '1.8.0',
			animations: {
				[this.name]: this.compileBedrockAnimation()
			}
		}
		if (isApp && this.path) {
			if (fs.existsSync(this.path)) {
				//overwrite path
				let data;
				try {
					data = fs.readFileSync(this.path, 'utf-8');
					data = autoParseJSON(data, false);
					if (typeof data.animations !== 'object') {
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
					let animation = content.animations[this.name];
					content = data;
					if (this.saved_name && this.saved_name !== this.name) delete content.animations[this.saved_name];
					content.animations[this.name] = animation;

					// Sort
					let file_keys = Object.keys(content.animations);
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
						let sorted_animations = {};
						file_keys.forEach(key => {
							sorted_animations[key] = content.animations[key];
						})
						content.animations = sorted_animations;
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
		Animator.animations.forEach(function(a) {
			a.selected = a.playing = false;
		})

		Panels.animation_controllers.inside_vue.controller = this;

		this.selected = true;
		this.playing = true;
		AnimationController.selected = this;

		if (Modes.animate) {
			//Animator.preview();
		}
		updateInterface();
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
		if (!Animator.animations.includes(this)) {
			Animator.animations.push(this)
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
		Animator.animations.remove(this)
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
	new Property(AnimationController, 'boolean', 'saved', {default: true, condition: () => Format.animation_files})
	new Property(AnimationController, 'string', 'path', {condition: () => isApp && Format.animation_files})


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
		toolbars: {
			animation_controllers: Toolbars.animation_controllers
		},
		onResize() {
			Timeline.updateSize();
		},
		component: {
			name: 'panel-animation-controllers',
			data() {return {
				controller: null,
			}},
			methods: {
				toggleStateSection(state, section) {
					state.fold[section] = !state.fold[section];
				}
			},
			template: `
				<div id="animation_controllers_wrapper">
					<ul v-if="controller">
						<li v-for="state in controller.states"
							class="controller_state"
						>
							<div class="controller_state_title_bar">
								{{ state.name }}
							</div>

							<div class="controller_state_section_title" @click="toggleStateSection(state, 'animations')">
								<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.animations, "fa-angle-down": !state.fold.animations}\'></i>
								<label>${tl('animation_controllers.state.animations')}</label>
							</div>
							<ul v-if="!state.fold.animations">
								<li>
									<input type="text" class="dark_bordered">
								</li>
							</ul>

							<div class="controller_state_section_title" @click="toggleStateSection(state, 'particles')">
								<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.particles, "fa-angle-down": !state.fold.particles}\'></i>
								<label>${tl('animation_controllers.state.particles')}</label>
							</div>
							<ul v-if="!state.fold.particles">
								<li>
									<input type="text" class="dark_bordered">
								</li>
							</ul>

							<div class="controller_state_section_title" @click="toggleStateSection(state, 'sounds')">
								<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.sounds, "fa-angle-down": !state.fold.sounds}\'></i>
								<label>${tl('animation_controllers.state.sounds')}</label>
							</div>
							<ul v-if="!state.fold.sounds">
								<li>
									<input type="text" class="dark_bordered">
								</li>
							</ul>

							<div class="controller_state_section_title" @click="toggleStateSection(state, 'on_entry')">
								<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.on_entry, "fa-angle-down": !state.fold.on_entry}\'></i>
								<label>${tl('animation_controllers.state.on_entry')}</label>
							</div>
							<div v-if="!state.fold.on_entry">
								<vue-prism-editor 
									class="molang_input dark_bordered tab_target"
									v-model="state.on_entry"
									language="molang"
									:ignoreTabKey="true"
									:line-numbers="false"
								/>
							</div>

							<div class="controller_state_section_title" @click="toggleStateSection(state, 'on_exit')">
								<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.on_exit, "fa-angle-down": !state.fold.on_exit}\'></i>
								<label>${tl('animation_controllers.state.on_exit')}</label>
							</div>
							<div v-if="!state.fold.on_exit">
								<vue-prism-editor 
									class="molang_input dark_bordered tab_target"
									v-model="state.on_exit"
									language="molang"
									:ignoreTabKey="true"
									:line-numbers="false"
								/>
							</div>

							<div class="controller_state_section_title" @click="toggleStateSection(state, 'transitions')">
								<i class="icon-open-state fa" :class=\'{"fa-angle-right": state.fold.transitions, "fa-angle-down": !state.fold.transitions}\'></i>
								<label>${tl('animation_controllers.state.transitions')}</label>
							</div>
							<ul v-if="!state.fold.transitions">
								<li>
									<input type="text" class="dark_bordered">
								</li>
							</ul>

						</li>
					</ul>
				</div>
			`
		}
	})
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
