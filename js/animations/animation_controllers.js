class AnimationControllerState {
	constructor(controller, data = 0) {
		this.controller = controller;
		this.uuid = guid();

		for (let key in AnimationControllerState.properties) {
			AnimationControllerState.properties[key].reset(this);
		}

		this.folded = false;
		this.fold = {
			animations: false,
			particles: true,
			sounds: true,
			on_entry: true,
			on_exit: true,
			transitions: true,
		};
		this.muted = {
			sound: false,
			particle: false,
		}
		this.playing_sounds = [];

		if (data) {
			this.extend(data);
		}
		this.controller.states.safePush(this);
	}
	extend(data = 0) {
		for (let key in AnimationControllerState.properties) {
			if (AnimationControllerState.properties[key].type == 'array') continue;
			AnimationControllerState.properties[key].merge(this, data)
		}
		if (data.animations instanceof Array) {
			this.animations.empty();
			data.animations.forEach(a => {
				let animation;
				if (typeof a == 'object' && typeof a.uuid == 'string' && a.uuid.length == 36) {
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
					let anim_match = Animation.all.find(anim => anim.getShortName() == key);
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
				if (typeof a == 'object' && typeof a.uuid == 'string' && a.uuid.length == 36) {
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
		if (data.particles instanceof Array) {
			this.particles.empty();
			data.particles.forEach(particle => {
				this.particles.push(JSON.parse(JSON.stringify(particle)));
			})
		}
		if (data.sounds instanceof Array) {
			this.sounds.empty();
			data.sounds.forEach(sound => {
				this.sounds.push(JSON.parse(JSON.stringify(sound)));
			})
		}
		// From Bedrock
		if (data.particle_effects instanceof Array) {
			this.particles.empty();
			data.particles.forEach(effect => {
				let particle = {
					uuid: guid(),
					effect: effect.effect || '',
					locator: effect.locator || '',
					bind_to_actor: effect.bind_to_actor !== false,
					pre_effect_script: effect.pre_effect_script || '',
					file: '',
				};
				this.particles.push(particle);
			})
		}
		if (data.sound_effects instanceof Array) {
			this.sounds.empty();
			data.sounds.forEach(effect => {
				let sound = {
					uuid: guid(),
					effect: effect.effect || '',
					file: '',
				};
				this.sounds.push(sound);
			})
		}
	}
	getUndoCopy() {
		var copy = {
			uuid: this.uuid,
			name: this.name,
		}
		for (let key in AnimationControllerState.properties) {
			AnimationControllerState.properties[key].copy(this, copy)
		}
		copy.animations = JSON.parse(JSON.stringify(copy.animations));
		copy.transitions = JSON.parse(JSON.stringify(copy.transitions));
		copy.particles = JSON.parse(JSON.stringify(copy.particles));
		copy.sounds = JSON.parse(JSON.stringify(copy.sounds));
		return copy;
	}
	compileForBedrock() {
		let object = {};
		if (this.animations.length) {
			object.animations = this.animations.map(animation => {
				return animation.blend_value.trim()
					? new oneLiner({[animation.key]: animation.blend_value.trim()})
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
		if (this.particles.length) {
			object.particle_effects = this.particles.map(particle => {
				return {
					effect: particle.effect || '',
					locator: particle.locator || undefined,
					bind_to_actor: particle.bind_to_actor ? undefined : false,
					pre_effect_script: particle.pre_effect_script || undefined
				}
			})
		}
		if (this.sounds.length) {
			object.sound_effects = this.sounds.map(sound => {
				return new oneLiner({
					effect: sound.effect || ''
				});
			})
		}
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
	select(force) {
		if (this.controller.selected_state !== this || force) {
			this.controller.last_state = this.controller.selected_state;
			this.controller.transition_timestamp = Date.now();
			this.start_timestamp = Date.now();

			this.controller.selected_state = this;

			if (this.controller.last_state) this.controller.last_state.unselect();
			Animator.MolangParser.parse(this.on_entry);

			this.playEffects()
			Blockbench.dispatchEvent('select_animation_controller_state', {state: this});
		}
		return this;
	}
	unselect() {
		Animator.MolangParser.parse(this.on_exit);
		this.playing_sounds.forEach(media => {
			if (!media.paused) {
				media.pause();
			}
		})
		this.playing_sounds.empty();
	}
	playEffects() {
		if (!this.muted.sound) {
			this.sounds.forEach(sound => {
				if (sound.file && !sound.cooldown) {
					var media = new Audio(sound.file);
					media.volume = Math.clamp(settings.volume.value/100, 0, 1);
					media.play().catch(() => {});
					this.playing_sounds.push(media);
					media.onended = () => {
						this.playing_sounds.remove(media);
					}

					sound.cooldown = true;
					setTimeout(() => {
						delete sound.cooldown;
					}, 400)
				}
			})
		}
		
		if (!this.muted.particle) {
			this.particles.forEach((particle) => {
				let particle_effect = particle.file && Animator.particle_effects[particle.file]
				if (particle_effect) {

					let emitter = particle_effect.emitters[particle.uuid];
					if (!emitter) {
						emitter = particle_effect.emitters[particle.uuid] = new Wintersky.Emitter(WinterskyScene, particle_effect.config);

						let old_variable_handler = emitter.Molang.variableHandler;
						emitter.Molang.variableHandler = (key, params) => {
							let curve_result = old_variable_handler.call(emitter, key, params);
							if (curve_result !== undefined) return curve_result;
							return Animator.MolangParser.variableHandler(key);
						}
					}
					emitter.Molang.parse(particle.pre_effect_script, Animator.MolangParser.global_variables);

					let locator = particle.locator && Locator.all.find(l => l.name == particle.locator)
					if (locator) {
						locator.mesh.add(emitter.local_space);
						emitter.parent_mode = 'locator';
					} else {
						emitter.parent_mode = 'entity';
					}
					emitter.stopLoop().playLoop();
				}
			})
		}
	}
	scrollTo() {
		let node = document.querySelector(`.controller_state[uuid="${this.uuid}"]`);
		if (node) node.scrollIntoView({behavior: 'smooth', block: 'nearest'})
		return this;
	}
	rename() {
		Blockbench.textPrompt('generic.rename', this.name, value => {
			Undo.initEdit({animation_controller_state: this});
			this.name = value;
			this.createUniqueName();
			Undo.finishEdit('Rename animation controller state');
		})
		return this;
	}
	remove(undo) {
		if (undo) {
			Undo.initEdit({animation_controllers: [this.controller]});
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
		let scope = this;
		let others = this.controller.states;
		let name = this.name.replace(/\d+$/, '');
		function check(n) {
			for (let i = 0; i < others.length; i++) {
				if (others[i] !== scope && others[i].name == n) return false;
			}
			return true;
		}
		if (check(this.name)) {
			return this.name;
		}
		for (let num = 2; num < 8e3; num++) {
			if (check(name+num)) {
				scope.name = name+num;
				return scope.name;
			}
		}
		return false;
	}
	addAnimation(animation) {
		Undo.initEdit({animation_controller_state: this});
		let anim_link = {
			uuid: guid(),
			key: animation ? animation.getShortName() : '',
			animation: animation ? animation.uuid : '',
			blend_value: ''
		};
		this.animations.push(anim_link);
		this.fold.animations = false;
		Blockbench.dispatchEvent('add_animation_controller_animation', {state: this});
		Undo.finishEdit('Add animation to animation controller state');
	}
	addTransition(target = '') {
		Undo.initEdit({animation_controller_state: this});
		let transition = {
			uuid: guid(),
			target, // UUID
			condition: ''
		};
		this.transitions.push(transition);
		this.fold.transitions = false;
		Blockbench.dispatchEvent('add_animation_controller_transition', {state: this});
		Undo.finishEdit('Add transition to animation controller state');

		Vue.nextTick(() => {
			let node = document.querySelector(`.controller_state[uuid="${this.uuid}"] .controller_transition:last-child pre`);
			if (node) {
				$(node).trigger('focus');
			}
		})
	}
	addParticle(options = 0) {
		Undo.initEdit({animation_controller_state: this});
		let particle = {
			uuid: guid(),
			effect: options.effect || '',
			bind_to_actor: true,
			locator: '',
			pre_effect_script: '',
			file: '',
		};
		this.particles.push(particle);
		this.fold.particles = false;
		Blockbench.dispatchEvent('add_animation_controller_particle', {state: this});
		Undo.finishEdit('Add particle to animation controller state');

		Vue.nextTick(() => {
			let node = document.querySelector(`.controller_state[uuid="${this.uuid}"] .controller_particle input[type="text"]`);
			if (node) {
				$(node).trigger('focus');
			}
		})
	}
	addSound(options = 0) {
		Undo.initEdit({animation_controller_state: this});
		let sound = {
			uuid: guid(),
			effect: options.effect || '',
			file: options.file || '',
		};
		this.sounds.push(sound);
		this.fold.sounds = false;
		Blockbench.dispatchEvent('add_animation_controller_sound', {state: this});
		Undo.finishEdit('Add sound to animation controller state');

		Vue.nextTick(() => {
			let node = document.querySelector(`.controller_state[uuid="${this.uuid}"] .controller_sound input[type="text"]`);
			if (node) {
				$(node).trigger('focus');
			}
		})
	}
	openMenu(event) {
		AnimationControllerState.prototype.menu.open(event, this);
	}
	getStateTime() {
		return this.start_timestamp ? (Date.now() - this.start_timestamp) / 1000 : 0;
	}
}
new Property(AnimationControllerState, 'string', 'name', {default: 'default'});
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
		icon: (state) => (state.uuid == AnimationController.selected?.initial_state ? 'radio_button_checked' : 'radio_button_unchecked'),
		click(state) {
			if (!AnimationController.selected) return;
			Undo.initEdit({animation_controllers: [AnimationController.selected]});
			AnimationController.selected.initial_state = state.uuid;
			Undo.finishEdit('Change animation controller initial state');
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

		for (let key in AnimationController.properties) {
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
		for (let key in AnimationController.properties) {
			AnimationController.properties[key].merge(this, data)
		}
		Merge.string(this, data, 'name')

		if (data.states instanceof Array) {
			let old_states = this.states.splice(0, this.states.length);
			data.states.forEach(template => {
				let state = old_states.find(state2 => state2.name === template.name || (template.uuid && state2.uuid === template.uuid));
				if (state) {
					state.extend(template);
					if (template.uuid) state.uuid = template.uuid;
					this.states.push(state);
				} else {
					state = new AnimationControllerState(this, template);
					if (template.uuid) state.uuid = template.uuid;
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
		if (typeof data.initial_state == 'string') {
			if (data.initial_state.length == 36) {
				this.initial_state = data.initial_state;
			} else {
				this.initial_state = this.states.find(s => s.name == data.initial_state)?.uuid || '';
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
			type: 'animation_controller',
			name: this.name,
			selected: this.selected,
			selected_state: this.selected_state ? this.selected_state.uuid : null
		}
		for (let key in AnimationController.properties) {
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

		let initial_state = this.states.find(s => s.uuid == this.initial_state) || this.states[0];
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

					// Improve JSON formatting
					for (let key in data.animation_controllers) {
						let controller = data.animation_controllers[key];
						if (typeof controller.states == 'object') {
							for (let state_name in controller.states) {
								let state = controller.states[state_name];
								if (state.animations instanceof Array) {
									state.animations.forEach((a, i) => {
										if (typeof a == 'object') state.animations[i] = new oneLiner(a);
									})
								}
								if (state.transitions instanceof Array) {
									state.transitions.forEach((t, i) => {
										if (typeof t == 'object') state.transitions[i] = new oneLiner(t);
									})
								}
							}
						}
					}

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
		if (Timeline.playing) Timeline.pause()
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
				Undo.initEdit({animation_controllers: [scope]});
				scope.name = name;
				scope.createUniqueName();
				Undo.finishEdit('Rename animation controller');
			}
		})
		return this;
	}
	updatePreview() {
		let mode = BarItems.animation_controller_preview_mode.value;
		if (mode == 'paused') return;
		Animator.preview();

		// Transitions
		if (mode == 'play' && this.selected_state) {
			for (let transition of this.selected_state.transitions) {
				let match = Animator.MolangParser.parse(transition.condition);
				let target_state = match && this.states.find(s => s.uuid == transition.target);
				if (match && target_state) {
					target_state.select();
					break;
				}
			}
		}
	}
	togglePlayingState(state) {
		if (!this.selected) {
			this.playing = state !== undefined ? state : !this.playing;
			Animator.preview();
		} else {
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
			Undo.initEdit({animation_controllers: []})
		}
		if (!AnimationController.all.includes(this)) {
			AnimationController.all.push(this)
		}
		if (undo) {
			this.select()
			Undo.finishEdit('Add animation controller', {animation_controllers: [this]})
		}
		return this;
	}
	remove(undo, remove_from_file = true) {
		if (undo) {
			Undo.initEdit({animation_controllers: [this]})
		}
		AnimationController.all.remove(this)
		if (undo) {
			Undo.finishEdit('Remove animation controller', {animation_controllers: []})

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
						if (json && json.animation_controllers && json.animation_controllers[this.name]) {
							delete json.animation_controllers[this.name];
							Blockbench.writeFile(this.path, {content: compileJSON(json)});
							Undo.history.last().before.animation_controllers[this.uuid].saved = false
						}
					}
				})
			}
		}
		Blockbench.dispatchEvent('remove_animation', {animation_controllers: [this]})
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
				}
			},
			onConfirm: form_data => {
				dialog.hide().delete();
				if (
					form_data.name != this.name
					|| (isApp && form_data.path != this.path)
				) {
					Undo.initEdit({animation_controllers: [this]});

					this.name = form_data.name;
					this.createUniqueName();
					if (isApp) this.path = form_data.path;

					Blockbench.dispatchEvent('edit_animation_controller_properties', {animation_controllers: [this]})

					Undo.finishEdit('Edit animation controller properties');
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
			click(controller) {
				Undo.initEdit({animation_controllers: [controller]})
				controller.remove(false, false);
				Undo.finishEdit('Unload animation controller', {animation_controllers: []})
			}
		},
		'delete',
		'_',
		{name: 'menu.animation.properties', icon: 'cable', click(animation) {
			animation.propertiesDialog();
		}}
	])
	AnimationController.prototype.file_menu = Animation.prototype.file_menu;
	new Property(AnimationController, 'boolean', 'saved', {default: true})
	new Property(AnimationController, 'string', 'path', {condition: () => isApp})
	new Property(AnimationController, 'string', 'initial_state', {default: ''})

AnimationController.presets = [
	{
		name: 'Default',
		states: {
			default: {}
		}
	},
	{
		name: 'Simple Action',
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
		name: 'Walking',
		states: {
			idle: {
				transitions: [
					{walking: 'q.ground_speed > 1.0'}
				],
				blend_transition: 0.2
			},
			walking: {
				transitions: [
					{idle: 'q.ground_speed < 0.5'}
				],
				blend_transition: 0.2
			}
		}
	},
	{
		name: 'Open & Close',
		initial_state: 'default',
		states: {
			default: {
				transitions: [
					{closed: '!q.is_ignited'},
					{opened: 'q.is_ignited'}
				]
			},
			closed: {
				transitions: [
					{open: 'q.is_ignited'}
				]
			},
			open: {
				transitions: [
					{opened: 'query.any_animation_finished'},
					{close: '!q.is_ignited'}
				],
				blend_transition: 0.1
			},
			opened: {
				transitions: [
					{close: '!q.is_ignited'}
				],
				blend_transition: 0.1
			},
			close: {
				transitions: [
					{closed: 'query.all_animations_finished'}
				]
			}
		}
	}
];

Blockbench.on('finish_edit', event => {
	if (!Format.animation_controllers) return;
	if (event.aspects.animation_controllers) {
		event.aspects.animation_controllers.forEach(controller => {
			if (Undo.current_save && Undo.current_save.aspects.animation_controllers instanceof Array && Undo.current_save.aspects.animation_controllers.includes(controller)) {
				controller.saved = false;
			}
		})
	}
	if (event.aspects.animation_controller_state && AnimationController.selected) {
		AnimationController.selected.saved = false;
	}
})

Interface.definePanels(() => {
	let panel = new Panel('animation_controllers', {
		icon: 'cable',
		condition: {modes: ['animate'], features: ['animation_controllers'], method: () => AnimationController.selected},
		default_position: {
			slot: 'bottom',
			float_position: [100, 400],
			float_size: [600, 300],
			height: 260,
		},
		grow: true,
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
				connection_wrapper_offset: 0,
				connecting: false,
				pickwhip: {
					start_x: 0,
					start_y: 0,
					length: 0,
					angle: 0,
				}
			}},
			methods: {
				loadPreset(preset) {
					this.controller.extend({
						states: preset.states,
						initial_state: preset.initial_state
					});
					this.updateConnectionWrapperOffset();
				},
				toggleStateSection(state, section) {
					state.fold[section] = !state.fold[section];
				},
				openAnimationMenu(state, animation, target) {
					let apply = anim => {
						animation.key = anim.getShortName();
						animation.animation = anim.uuid;
					}
					let list = [
						{
							name: 'generic.unset',
							icon: animation.animation == '' ? 'radio_button_checked' : 'radio_button_unchecked',
							click: () => {
								animation.key = '';
								animation.animation = '';
							}
						},
						'_'
					];
					AnimationItem.all.forEach((anim, i) => {
						if (anim == this.controller) return;
						if (i && anim instanceof AnimationController) list.push('_');
						list.push({
							name: anim.name,
							icon: animation.animation == anim.uuid ? 'radio_button_checked' : (state.animations.find(a => a.animation == anim.uuid) ? 'task_alt' : 'radio_button_unchecked'),
							click: () => apply(anim)
						})
					})
					list.push(
						'_',
						{id: 'remove', name: 'generic.remove', icon: 'clear', click() {
							Undo.initEdit({animation_controller_state: state});
							state.animations.remove(animation);
							Undo.finishEdit('Remove animation from controller state');
						}}
					);
					let menu = new Menu('controller_state_animations', list, {searchable: list.length > 7});
					menu.open(target);
				},
				openTransitionMenu(state, transition, event) {
					let list = [];
					this.controller.states.forEach(state2 => {
						if (state2 == state) return;
						list.push({
							name: state2.name,
							icon: transition.target == state2.uuid ? 'radio_button_checked' : (state.transitions.find(t => t.target == state2.uuid) ? 'task_alt' : 'radio_button_unchecked'),
							click: () => {
								transition.target = state2.uuid;
							}
						})
					})
					list.push(
						'_',
						{id: 'remove', name: 'generic.remove', icon: 'clear', click() {
							Undo.initEdit({animation_controller_state: state});
							state.transitions.remove(transition);
							Undo.finishEdit('Remove transition from controller state');
						}}
					);
					let menu = new Menu('controller_state_transitions', list, {searchable: list.length > 9});
					menu.open(event.target);
				},
				openParticleMenu(state, particle) {
					new Menu('controller_state_particle', [
						{
							name: 'generic.remove',
							icon: 'clear',
							click() {
								Undo.initEdit({animation_controller_state: state});
								state.particles.remove(particle);
								Undo.finishEdit('Remove particle from controller state');
							}
						}
					])
				},
				openSoundMenu(state, sound) {
					new Menu('controller_state_sound', [
						{
							name: 'generic.remove',
							icon: 'clear',
							click() {
								Undo.initEdit({animation_controller_state: state});
								state.sounds.remove(sound);
								Undo.finishEdit('Remove sound from controller state');
							}
						}
					])
				},
				addAnimationButton(state, event) {
					state.select();
					let list = [
						{
							name: 'generic.unset',
							icon: 'call_to_action',
							click: () => {
								state.addAnimation();
							}
						}
					];
					AnimationItem.all.forEach((anim, i) => {
						if (anim == this.controller) return;
						if (i && anim instanceof AnimationController) list.push('_');
						list.push({
							name: anim.name,
							icon: anim instanceof AnimationController ? 'cable' : 'movie',
							click: () => {
								state.addAnimation(anim);
							}
						})
					})
					let menu = new Menu('controller_state_animations', list, {searchable: list.length > 7});
					menu.open(event.target);
				},
				addTransitionButton(state, event) {
					state.select();
					let list = [];
					this.controller.states.forEach(state2 => {
						if (state2 == state || state.transitions.find(t => t.target == state2.uuid)) return;
						list.push({
							name: state2.name,
							icon: 'login',
							click: () => {
								state.addTransition(state2.uuid);
							}
						})
					})
					if (!list.length) {
						list.push({
							name: 'generic.unset',
							icon: 'remove',
							click: () => {
								state.addTransition();
							}
						})
					}
					let menu = new Menu('controller_state_transitions', list, {searchable: list.length > 9});
					menu.open(event.target);
				},
				addParticleButton(state, event) {
					state.addParticle();
				},
				addSoundButton(state, event) {
					state.addSound();
				},
				addState() {
					BarItems.add_animation_controller_state.trigger();
				},
				sortStates(event) {
					let max_index = this.controller.states.length - 1;
					Undo.initEdit({animation_controllers: [this.controller]});
					var item = this.controller.states.splice(Math.min(event.oldIndex, max_index), 1)[0];
					this.controller.states.splice(Math.min(event.newIndex, max_index), 0, item);
					Undo.finishEdit('Reorder animation controller states');
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
				sortAnimation(state, event) {
					Undo.initEdit({animation_controller_state: state});
					var item = state.animations.splice(event.oldIndex, 1)[0];
					state.animations.splice(event.newIndex, 0, item);
					Undo.finishEdit('Reorder animations in controller state');
				},
				sortTransition(state, event) {
					Undo.initEdit({animation_controller_state: state});
					var item = state.transitions.splice(event.oldIndex, 1)[0];
					state.transitions.splice(event.newIndex, 0, item);
					Undo.finishEdit('Reorder transitions in controller state');
				},
				selectConnection(connection, event) {
					let state = this.controller.states[connection.state_index];
					let target = this.controller.states[connection.target_index];
					if (state == this.controller.selected_state || event.ctrlOrCmd || Pressing.overrides.ctrl) {
						target.select().scrollTo();
					} else {
						state.select().scrollTo();
					}
				},
				selectConnectionDeep(connection, event) {
					let state = this.controller.states[connection.state_index];
					let target = this.controller.states[connection.target_index];
					if (event.ctrlOrCmd || Pressing.overrides.ctrl) {
						target.select().scrollTo();
					} else {
						state.select().scrollTo();
						state.fold.transitions = false;
						Vue.nextTick(() => {
							let node = document.querySelector(`.controller_transition[uuid="${connection.uuid}"] pre`);
							if (node) {
								$(node).trigger('focus');
								document.execCommand('selectAll');
							}
						})
					}
				},
				connectionContextMenu(connection, event) {
					let state = this.controller.states[connection.state_index];
					new Menu('controller_connection_context', [
						{
							name: 'animation_controllers.state.edit_transition',
							icon: 'edit',
							click() {
								state.select().scrollTo();
								state.fold.transitions = false;
								Vue.nextTick(() => {
									let node = document.querySelector(`.controller_transition[uuid="${connection.uuid}"] pre`);
									if (node) {
										$(node).trigger('focus');
										document.execCommand('selectAll');
									}
								})
							}
						},
						{
							name: 'generic.remove',
							icon: 'clear',
							click() {
								let transition = state.transitions.find(t => t.uuid == connection.uuid);
								Undo.initEdit({animation_controller_state: state});
								state.transitions.remove(transition);
								Undo.finishEdit('Remove animation controller transition');
							}
						},
					]).open(event)
				},
				dragConnection(state, event) {
					state.select();
					convertTouchEvent(event);
					event.preventDefault();
					event.stopPropagation();
					let anchor = document.getElementById('animation_controllers_pickwhip_anchor');
					let anchor_offset = $(anchor).offset();
					let scope = this;
					let {controller, pickwhip} = this;
					this.connecting = true;
					pickwhip.start_x = event.clientX - anchor_offset.left;
					pickwhip.start_y = event.clientY - anchor_offset.top;
					pickwhip.length = 0;

					function move(e2) {
						convertTouchEvent(e2);
						// Visually update connection line
						let anchor_offset = $(anchor).offset();
						let pos2_x = e2.clientX - anchor_offset.left;
						let pos2_y = e2.clientY - anchor_offset.top;
						pickwhip.length = Math.sqrt(Math.pow(pos2_x - pickwhip.start_x, 2) + Math.pow(pos2_y - pickwhip.start_y, 2))
						pickwhip.angle = Math.radToDeg(Math.atan2(pos2_y - pickwhip.start_y, pos2_x - pickwhip.start_x));
						scope.connecting = pickwhip.length >= 5;
					}
					function stop(e2) {
						convertTouchEvent(e2);
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', stop);
						scope.connecting = false;

						if (Math.abs(event.clientX - e2.clientX) < 20) return;

						// find selected state
						let target;
						if (!Blockbench.isTouch) {
							let target_uuid = document.querySelector('.controller_state:hover')?.attributes.uuid.value;
							target = target_uuid && controller.states.find(s => s.uuid == target_uuid);
						} else {
							target = controller.states.find(state => {
								let rect = document.querySelector(`.controller_state[uuid="${state.uuid}"]`)?.getBoundingClientRect();
								return e2.clientX > rect.left && e2.clientY > rect.top && e2.clientX < rect.right && e2.clientY < rect.bottom;
							})
						}
						if (target == state || !target) return;

						// Create connection
						state.fold.transitions = false;
						state.addTransition(target.uuid);
					}
					addEventListeners(document, 'mousemove touchmove', move);
					addEventListeners(document, 'mouseup touchend', stop);
				},
				changeParticleFile(state, particle_entry) {
					Blockbench.import({
						resource_id: 'animation_particle',
						extensions: ['json'],
						type: 'Bedrock Particle',
						startpath: particle_entry.file
					}, (files) => {

						let {path} = files[0];
						Undo.initEdit({animation_controller_state: state});
						particle_entry.file = path;
						let effect = Animator.loadParticleEmitter(path, files[0].content);
						if (!particle_entry.effect) particle_entry.effect = files[0].name.toLowerCase().split('.')[0].replace(/[^a-z0-9._]+/g, '');
						delete effect.config.preview_texture;
						Undo.finishEdit('Change animation controller particle file');

						if (!isApp || effect.config.texture.image.src.startsWith('data:')) {
							Blockbench.import({
								extensions: ['png'],
								type: 'Particle Texture',
								readtype: 'image',
								startpath: effect.config.preview_texture || path
							}, (files) => {
								effect.config.preview_texture = isApp ? files[0].path : files[0].content;
								if (isApp) effect.config.updateTexture();
							})
						}
					})
				},
				changeSoundFile(state, sound_entry) {
					Blockbench.import({
						resource_id: 'animation_audio',
						extensions: ['ogg', 'wav', 'mp3'],
						type: 'Audio File',
						startpath: sound_entry.file
					}, (files) => {
						let path = isApp
							? files[0].path
							: URL.createObjectURL(files[0].browser_file);

						Undo.initEdit({animation_controller_state: state});
						sound_entry.file = path;
						if (!sound_entry.effect) sound_entry.effect = files[0].name.toLowerCase().replace(/\.[a-z]+$/, '').replace(/[^a-z0-9._]+/g, '');
						Undo.finishEdit('Change animation controller audio file')
					})
				},

				updateLocatorSuggestionList() {
					Locator.updateAutocompleteList();
				},
				autocomplete(text, position) {
					let test = Animator.autocompleteMolang(text, position, 'controller');
					return test;
				}
			},
			computed: {
				connections() {
					let connections = {
						forward: [],
						backward: [],
						colors: {},
						outgoing_plugs: {},
						max_layer_top: 0,
						max_layer_bottom: 0
					};
					if (!this.controller) return connections;
					let {states, selected_state} = this.controller;

					// Count incoming plugs
					let incoming_plugs = {};
					let total_incoming_plugs = {};
					states.forEach((state, state_index) => {
						total_incoming_plugs[state.uuid] = {top: 0, bottom: 0};
						states.forEach((origin_state, origin_state_index) => {
							if (state === origin_state) return;
							origin_state.transitions.forEach(t => {
								if (t.target === state.uuid) {
									state_index < origin_state_index
										? total_incoming_plugs[state.uuid].top++
										: total_incoming_plugs[state.uuid].bottom++;
								}
							});
						});
					});

					let plug_gap = 16;

					states.forEach((state, state_index) => {
						let transitions_forward = state.transitions.filter(t => {
							return state_index < states.findIndex(s => s.uuid == t.target)
						});
						let transitions_backward = state.transitions.filter(t => !transitions_forward.includes(t));
						connections.outgoing_plugs[state.uuid] = {
							top: transitions_backward.length,
							bottom: transitions_forward.length
						}
						//transitions_forward.sort((a, b) => states.findIndex(s => s.uuid == a.target) - states.findIndex(s => s.uuid == b.target));
						//transitions_backward.sort((a, b) => states.findIndex(s => s.uuid == b.target) - states.findIndex(s => s.uuid == a.target));

						state.transitions.forEach(transition => {
							let target_index = states.findIndex(s => s.uuid == transition.target);
							let target = states[target_index];
							if (!target) return;
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
							let same_level_transitions = back ? transitions_backward : transitions_forward;
							let start_plug_offset = (same_level_transitions.indexOf(transition) - (same_level_transitions.length-1)/2) * Math.min(plug_gap, 200 / same_level_transitions.length);

							let con = {
								state_index, target_index,
								layer, range,
								selected, relevant, color,
								uuid: transition.uuid,
								condition: transition.condition
							}

							if (back) {// Top
								let incoming_gap_width = Math.min(plug_gap, 260 / total_incoming_plugs[target.uuid].top);
								connections.max_layer_top = Math.max(connections.max_layer_top, layer);
								con.end_x = state_index * 312 + 150 + start_plug_offset;
								con.start_x = target_index * 312 + (300 - 25 - incoming_plugs[target.uuid].top * incoming_gap_width);
								incoming_plugs[target.uuid].top++;

							} else {// Bottom
								let incoming_gap_width = Math.min(plug_gap, 260 / total_incoming_plugs[target.uuid].bottom);
								connections.max_layer_bottom = Math.max(connections.max_layer_bottom, layer);
								con.start_x = state_index * 312 + 150 - start_plug_offset;
								con.end_x = target_index * 312 + 25 + incoming_plugs[target.uuid].bottom * incoming_gap_width;
								incoming_plugs[target.uuid].bottom++;
							}

							connection_list.push(con);
							connections.colors[transition.uuid] = color;
						})
					})
					connections.forward.sort((a, b) => b.layer - a.layer);
					connections.backward.sort((a, b) => b.layer - a.layer);
					return connections;
				}
			},
			watch: {
				controller() {
					this.updateConnectionWrapperOffset();
				},
				'controller.states'() {
					this.updateConnectionWrapperOffset();
				}
			},
			template: `
				<div id="animation_controllers_wrapper"
					:class="{connecting_controllers: connecting}"
					:style="{zoom: zoom, '--blend-transition': controller && controller.last_state ? controller.last_state.blend_transition + 's' : 0}"
					@click="deselect($event)" @mousewheel="onMouseWheel($event)"
				>

					<div style="position: relative;" id="animation_controllers_pickwhip_anchor" style="height: 0px;">
						<div id="animation_controllers_pickwhip"
							v-if="connecting"
							:style="{left: pickwhip.start_x + 'px', top: pickwhip.start_y + 'px', width: pickwhip.length + 'px', rotate: pickwhip.angle + 'deg'}"
						></div>
					</div>

					<div v-if="controller && controller.states.length" class="controller_state_connection_wrapper_top" :style="{'--max-layer': connections.max_layer_top, left: connection_wrapper_offset + 'px'}">
						<div v-for="connection in connections.backward"
							:style="{'--color-marker': connection.color, '--layer': connection.layer, left: (connection.start_x)+'px', width: (connection.end_x - connection.start_x)+'px'}"
							class="controller_state_connection backward" :class="{selected: connection.selected, relevant: connection.relevant}"
							:title="connection.condition"
							@click="selectConnection(connection, $event)" @dblclick="selectConnectionDeep(connection, $event)" @contextmenu="connectionContextMenu(connection, $event)"
						></div>
					</div>

					<ul v-if="controller && controller.states.length" v-sortable="{onUpdate: sortStates, touchStartThreshold: 20, animation: 160, handle: '.controller_state_title_bar'}">
						<li v-for="state in controller.states" :key="state.uuid"
							class="controller_state"
							:class="{selected: controller.selected_state == state, folded: state.folded, initial_state: controller.initial_state == state.uuid}"
							:uuid="state.uuid"
							@click="state.select().scrollTo()"
							@contextmenu="state.openMenu($event)"
						>
							<div class="controller_state_title_bar" @touchstart="state.select()">
								<label @dblclick="state.rename()">{{ state.name }}</label>
								<div class="tool" title="" @click="state.openMenu($event.target)" v-if="!state.folded"><i class="material-icons">drag_handle</i></div>
								<!--div class="tool" title="" @click="state.folded = !state.folded"><i class="material-icons">{{ state.folded ? 'chevron_right' : 'chevron_left' }}</i></div-->
							</div>

							<template v-if="!state.folded">

								<div class="controller_state_gate controller_state_gate_top"
									:style="{width: (10 + connections.outgoing_plugs[state.uuid].top * 16)+'px'}"
									@mousedown="dragConnection(state, $event)" @touchstart="dragConnection(state, $event)"
								></div>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'animations')">
									<i v-if="state.fold.animations || state.animations.length == 0" class="icon-open-state fa fa-angle-right"></i>
									<i v-else class="icon-open-state fa fa-angle-down"></i>

									<label>${tl('animation_controllers.state.animations')}</label>
									<span class="controller_state_section_info" v-if="state.animations.length">{{ state.animations.length }}</span>

									<div class="text_button" @click.stop="addAnimationButton(state, $event)"><i class="icon fa fa-plus"></i></div>
								</div>
								<ul v-if="!state.fold.animations" v-sortable="{onUpdate(event) {sortAnimation(state, event)}, animation: 160, handle: '.controller_item_drag_handle'}">
									<li v-for="animation in state.animations" :key="animation.uuid" class="controller_animation">
										<div class="controller_item_drag_handle"></div>
										<div class="tool" title="" @click="openAnimationMenu(state, animation, $event.target)"><i class="material-icons">movie</i></div>
										<input type="text" class="dark_bordered tab_target animation_controller_text_input" v-model="animation.key">
										<vue-prism-editor 
											class="molang_input animation_controller_text_input tab_target"
											v-model="animation.blend_value"
											language="molang"
											:autocomplete="autocomplete"
											:placeholder="'${tl('animation_controllers.state.condition')}'"
											:ignoreTabKey="true"
											:line-numbers="false"
										/>
									</li>
								</ul>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'particles')">
									<i v-if="state.fold.particles || state.particles.length == 0" class="icon-open-state fa fa-angle-right"></i>
									<i v-else class="icon-open-state fa fa-angle-down"></i>

									<label>${tl('animation_controllers.state.particles')}</label>
									<span class="controller_state_section_info" v-if="state.particles.length">{{ state.particles.length }}</span>

									<div class="text_button" v-if="state.particles.length" @click.stop="state.muted.particle = !state.muted.particle">
										<i class="channel_mute fas fa-eye-slash" style="color: var(--color-subtle_text)" v-if="state.muted.particle"></i>
										<i class="channel_mute fas fa-eye" v-else></i>
									</div>

									<div class="text_button" @click.stop="addParticleButton(state, $event)">
										<i class="icon fa fa-plus"></i>
									</div>
								</div>
								<ul v-if="!state.fold.particles">
									<li v-for="particle in state.particles" :key="particle.uuid" class="controller_particle" @contextmenu="openParticleMenu(state, particle)">
										<div class="bar flex">
											<label>${tl('data.effect')}</label>
											<input type="text" class="dark_bordered tab_target animation_controller_text_input" v-model="particle.effect">
											<div class="tool" title="${tl('action.change_keyframe_file')}" @click="changeParticleFile(state, particle)">
												<i class="material-icons">upload_file</i>
											</div>
										</div>
										<div class="bar flex">
											<label>${tl('data.locator')}</label>
											<input type="text" class="dark_bordered tab_target animation_controller_text_input" v-model="particle.locator" list="locator_suggestion_list" @focus="updateLocatorSuggestionList()">
											<input type="checkbox" v-model="particle.bind_to_actor" title="${tl('timeline.bind_to_actor')}">
										</div>
										<div class="bar flex">
											<label>${tl('timeline.pre_effect_script')}</label>
											<vue-prism-editor
												class="molang_input animation_controller_text_input tab_target"
												v-model="particle.script"
												language="molang"
												:autocomplete="autocomplete"
												:ignoreTabKey="true"
												:line-numbers="false"
											/>
										</div>
									</li>
								</ul>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'sounds')">
									<i v-if="state.fold.sounds || state.sounds.length == 0" class="icon-open-state fa fa-angle-right"></i>
									<i v-else class="icon-open-state fa fa-angle-down"></i>

									<label>${tl('animation_controllers.state.sounds')}</label>
									<span class="controller_state_section_info" v-if="state.sounds.length">{{ state.sounds.length }}</span>

									<div class="text_button" v-if="state.sounds.length" @click.stop="state.muted.sound = !state.muted.sound">
										<i class="channel_mute fas fa-volume-mute" style="color: var(--color-subtle_text)" v-if="state.muted.sound"></i>
										<i class="channel_mute fas fa-volume-up" v-else></i>
									</div>

									<div class="text_button" @click.stop="addSoundButton(state, $event)">
										<i class="icon fa fa-plus"></i>
									</div>
								</div>
								<ul v-if="!state.fold.sounds">
									<li v-for="sound in state.sounds" :key="sound.uuid" class="controller_sound" @contextmenu="openSoundMenu(state, sound)">
										<div class="bar flex">
											<label>${tl('data.effect')}</label>
											<input type="text" class="dark_bordered tab_target animation_controller_text_input" v-model="sound.effect">
											<div class="tool" title="${tl('action.change_keyframe_file')}" @click="changeSoundFile(state, sound)">
												<i class="material-icons">upload_file</i>
											</div>
										</div>
									</li>
								</ul>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'on_entry')">
									<i v-if="state.fold.on_entry" class="icon-open-state fa fa-angle-right"></i>
									<i v-else class="icon-open-state fa fa-angle-down"></i>
									<label>${tl('animation_controllers.state.on_entry')}</label>
									<span class="controller_state_section_info" v-if="state.on_entry">{{ state.on_entry.split('\\n').length }}</span>
								</div>
								<vue-prism-editor
									v-if="!state.fold.on_entry"
									class="molang_input animation_controller_text_input tab_target"
									v-model="state.on_entry"
									language="molang"
									:autocomplete="autocomplete"
									:ignoreTabKey="true"
									:line-numbers="false"
								/>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'on_exit')">
									<i v-if="state.fold.on_exit" class="icon-open-state fa fa-angle-right"></i>
									<i v-else class="icon-open-state fa fa-angle-down"></i>
									<label>${tl('animation_controllers.state.on_exit')}</label>
									<span class="controller_state_section_info" v-if="state.on_exit">{{ state.on_exit.split('\\n').length }}</span>
								</div>
								<vue-prism-editor
									v-if="!state.fold.on_exit"
									class="molang_input animation_controller_text_input tab_target"
									v-model="state.on_exit"
									language="molang"
									:autocomplete="autocomplete"
									:ignoreTabKey="true"
									:line-numbers="false"
								/>

								<div class="controller_state_section_title" @click="toggleStateSection(state, 'transitions')">
									<i v-if="state.fold.transitions || state.transitions.length == 0" class="icon-open-state fa fa-angle-right"></i>
									<i v-else class="icon-open-state fa fa-angle-down"></i>

									<label>${tl('animation_controllers.state.transitions')}</label>
									<span class="controller_state_section_info" v-if="state.transitions.length">{{ state.transitions.length }}</span>

									<div class="text_button" @click.stop="addTransitionButton(state, $event)"><i class="icon fa fa-plus"></i></div>
								</div>
								<template v-if="!state.fold.transitions">
									<ul v-sortable="{onUpdate(event) {sortTransition(state, event)}, animation: 160, handle: '.controller_item_drag_handle'}">
										<li v-for="transition in state.transitions" :key="transition.uuid" :uuid="transition.uuid" class="controller_transition">
											<div class="controller_item_drag_handle" :style="{'--color-marker': connections.colors[transition.uuid]}"></div>
											<bb-select @click="openTransitionMenu(state, transition, $event)">{{ getStateName(transition.target) }}</bb-select>
											<vue-prism-editor 
												class="molang_input animation_controller_text_input tab_target"
												v-model="transition.condition"
												language="molang"
												:autocomplete="autocomplete"
												:ignoreTabKey="true"
												:line-numbers="false"
											/>
										</li>
									</ul>
									<div class="controller_state_input_bar">
										<label>${tl('animation_controllers.state.blend_transition')}</label>
										<input type="number" class="dark_bordered" style="width: 70px;" v-model.number="state.blend_transition" min="0" step="0.05">
									</div>
									<div class="controller_state_input_bar">
										<label :for="state.uuid + '_shortest_path'">${tl('animation_controllers.state.shortest_path')}</label>
										<input type="checkbox" :id="state.uuid + '_shortest_path'" v-model="state.shortest_path">
									</div>
								</template>

								<div class="controller_state_gate controller_state_gate_bottom"
									:style="{width: (10 + connections.outgoing_plugs[state.uuid].bottom * 16)+'px'}"
									@mousedown="dragConnection(state, $event)" @touchstart="dragConnection(state, $event)"
								></div>
							</template>
						</li>
						<li class="controller_add_column" @click="addState()">
							<i class="material-icons">add</i>
						</li>
					</ul>

					<div v-if="controller && controller.states.length" class="controller_state_connection_wrapper_bottom" :style="{'--max-layer': connections.max_layer_top, left: connection_wrapper_offset + 'px'}">
						<div v-for="connection in connections.forward"
							:style="{'--color-marker': connection.color, '--layer': connection.layer, left: (connection.start_x)+'px', width: (connection.end_x - connection.start_x)+'px'}"
							class="controller_state_connection forward" :class="{selected: connection.selected, relevant: connection.relevant}"
							:title="connection.condition"
							@click="selectConnection(connection, $event)" @dblclick="selectConnectionDeep(connection, $event)" @contextmenu="connectionContextMenu(connection, $event)"
						></div>
					</div>

					<div v-if="controller && !controller.states.length" id="animation_controller_presets">
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
	
	let molang_edit_value;
	let class_name = 'animation_controller_text_input';
	function isTarget(target) {
		return target?.classList?.contains(class_name) || target?.parentElement?.parentElement?.classList?.contains(class_name);
	}
	document.addEventListener('focus', event => {
		if (isTarget(event.target)) {
			molang_edit_value = event.target.value || event.target.innerText;
			let state_uuid = document.querySelector('.controller_state:focus-within')?.attributes.uuid?.value;
			let state = state_uuid && AnimationController.selected?.states.find(s => s.uuid == state_uuid);
			if (state) {
				Undo.initEdit({animation_controller_state: state});
			}
		}
	}, true)
	document.addEventListener('focusout', event => {
		if (isTarget(event.target)) {

			let val = event.target.value || event.target.innerText;
			if (val != molang_edit_value) {
				Undo.finishEdit('Edit animation controller molang');
			} else {
				Undo.cancelEdit();
			}
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
			let controller = new AnimationController({
				name: 'controller.animation.' + (Project.geometry_name||'model') + '.new'
			}).add(true).propertiesDialog();
			Blockbench.dispatchEvent('add_animation_controller', {animation_controller: controller})
		}
	})
	new Action('add_animation_controller_state', {
		icon: 'add_box',
		category: 'animation',
		condition: {modes: ['animate'], features: ['animation_controllers'], method: () => AnimationController.selected},
		click() {
			Undo.initEdit({animation_controllers: [AnimationController.selected]})
			let state = new AnimationControllerState(AnimationController.selected, {}).select().scrollTo().rename();
			Blockbench.dispatchEvent('select_animation_controller_state', {animation_controller: AnimationController.selected, state});
			Undo.finishEdit('Add animation controller state')

		}
	})
	new BarSelect('animation_controller_preview_mode', {
		options: {
			paused: {name: true, icon: 'pause'},
			manual: {name: true, icon: 'back_hand'},
			play: {name: true, icon: 'play_arrow'},
		},
		icon_mode: true,
		value: 'manual',
		category: 'animation',
		keybind: new Keybind({key: 32}),
		condition: {modes: ['animate'], selected: {animation_controller: true}}
	})
})
