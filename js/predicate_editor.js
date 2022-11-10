const PredicateOverrideEditor = {
	dialog: null,
	predicate_options: {
		custom_model_data: {type: 'int'},
		damage: {type: 'peronetage'},
		damaged: {type: 'checkbox'},
		lefthanded: {type: 'checkbox'},
		angle: {type: 'peronetage', filter: 'compass'},
		time: {type: 'peronetage', filter: 'clock'},
		blocking: {type: 'checkbox', filter: 'shield'},
		broken: {type: 'checkbox', filter: 'elytra'},
		cast: {type: 'checkbox', filter: 'fishing_rod'},
		cooldown: {type: 'peronetage', filter: ['ender_pearl', 'chorus_fruit']},
		pull: {type: 'peronetage', filter: ['bow', 'crossbow']},
		pulling: {type: 'checkbox', filter: ['bow', 'crossbow']},
		charged: {type: 'checkbox', filter: 'crossbow'},
		firework: {type: 'checkbox', filter: 'crossbow'},
		throwing: {type: 'checkbox', filter: 'trident'},
		level: {type: 'peronetage', filter: 'light'},
		filled: {type: 'peronetage', filter: 'bundle'},
		tooting: {type: 'checkbox', filter: 'goat_horn'},
	},
	addPredicateOption(key, settings) {
		Vue.set(PredicateOverrideEditor.predicate_options, key, settings);
		return {
			delete() {
				Vue.delete(PredicateOverrideEditor.predicate_options, key);
			}
		}
	},
	showDialog() {
		let default_variants = {
			custom_model_data: 4,
			damage: {
				wooden_pickaxe: 59,
				stone_pickaxe: 131,
				iron_pickaxe: 250,
				golden_pickaxe: 32,
				diamond_pickaxe: 1561,
				netherite_pickaxe: 2031,

				wooden_axe: 32,
				stone_axe: 131,
				iron_axe: 250,
				golden_axe: 32,
				diamond_axe: 1561,
				netherite_axe: 2031,

				wooden_shovel: 59,
				stone_shovel: 131,
				iron_shovel: 250,
				golden_shovel: 32,
				diamond_shovel: 1561,
				netherite_shovel: 2031,

				wooden_hoe: 59,
				stone_hoe: 131,
				iron_hoe: 250,
				golden_hoe: 32,
				diamond_hoe: 1561,
				netherite_hoe: 2031,

				wooden_sword: 59,
				stone_sword: 131,
				iron_sword: 250,
				golden_sword: 32,
				diamond_sword: 1561,
				netherite_sword: 2031,

				leather_helmet: 55,
				chainmail_helmet: 165,
				iron_helmet: 165,
				golden_helmet: 77,
				diamond_helmet: 363,
				netherite_helmet: 407,
				turtle_helmet: 275,

				leather_chestplate: 80,
				chainmail_chestplate: 240,
				iron_chestplate: 240,
				golden_chestplate: 112,
				diamond_chestplate: 528,
				netherite_chestplate: 592,

				leather_leggings: 75,
				chainmail_leggings: 225,
				iron_leggings: 225,
				golden_leggings: 105,
				diamond_leggings: 495,
				netherite_leggings: 555,

				leather_boots: 65,
				chainmail_boots: 195,
				iron_boots: 195,
				golden_boots: 91,
				diamond_boots: 429,
				netherite_boots: 481,

				trident: 250,
				elytra: 432,
				shield: 336,
				bow: 384,
				crossbow: 465,
				fishing_rod: 64,
				shears: 238,
				flint_and_steel: 64,

				default: 100,
			},
			angle: 32,
			time: 64,
			pull: 3
		}

		PredicateOverrideEditor.dialog = PredicateOverrideEditor.dialog || new Dialog({
			id: 'predicate_overrides',
			title: 'action.predicate_overrides',
			width: 750,
			component: {
				data() {return {
					overrides: [],
					name: '',
					search_term: '',
					model_options: [],
					max_height: window.innerHeight - 350,
					predicate_options: PredicateOverrideEditor.predicate_options,
					generator: {
						active: false,
						type: 'custom_model_data',
						variants: 64,
						start_value: 0,
						model: ''
					}
				}},
				methods: {
					addOverride() {
						this.overrides.push({
							model: '',
							predicate: {custom_model_data: 0},
							_uuid: guid()
						});
					},
					removeOverride(override) {
						this.overrides.remove(override);
					},
					addPredicate(override) {
						let options = Object.keys(this.available_predicate_options);
						let key = options.find(option => override.predicate[option] === undefined);
						if (!key) return;
						Vue.set(override.predicate, key, 0);
					},
					changePredicateType(override, new_key, value, key) {
						if (key !== new_key) {
							Vue.set(override.predicate, new_key, value);
							Vue.delete(override.predicate, key);
						}
					},
					changePredicateValue(override, key, event) {
						let data = this.predicate_options[key];
						if (data.type == 'checkbox') {
							override.predicate[key] = event.target.checked ? 1 : 0;
						} else if (data.type == 'int') {
							override.predicate[key] = parseInt(event.target.value);
						} else {
							override.predicate[key] = parseFloat(event.target.value);
						}
					},
					removePredicate(override, key) {
						Vue.delete(override.predicate, key);
					},
					hasMultiplePredicates(override) {
						return Object.keys(override.predicate).length > 1
					},
					deleteAll() {
						if (confirm(tl('dialog.predicate_overrides.confirm_delete'))) {
							this.overrides.empty();
							this.search_term = '';
						}
					},
					startGenerator() {
						this.generator.active = true;
						this.generator.type = 'custom_model_data';
						this.generator.variants = 16;
						this.generator.start_value = 0;
						this.generator.model = '';
					},
					runGenerator() {
						let is_circular = ['angle', 'time'].includes(this.generator.type);
						if (this.generator.type !== 'custom_model_data') {
							this.generator.variants++;
						}
						for (let i = 0; i < this.generator.variants; i++) {
							let value = Math.clamp((is_circular ? i-0.5 : i) / this.generator.variants, 0, 1);
							if (this.generator.type == 'custom_model_data') {
								value = this.generator.start_value + i;
							}
							let model = this.generator.model.replace(/%+/, blank => i.toDigitString(blank.length));
							this.overrides.push({
								model,
								predicate: {
									[this.generator.type]: value
								},
								_uuid: guid()
							});
						}
						this.generator.active = false;
					},
					updateGeneratorType() {
						let variants = 16;
						if (typeof default_variants[this.generator.type] == 'object') {
							variants = default_variants[this.generator.type][this.name] || 64;
						} else if (typeof default_variants[this.generator.type] == 'number') {
							variants = default_variants[this.generator.type];
						}
						this.generator.variants = variants;
					},

					sort(event) {
						if (this.search_term) return false;
						var item = this.overrides.splice(event.oldIndex, 1)[0];
						this.overrides.splice(event.newIndex, 0, item);
					}
				},
				computed: {
					filtered_overrides() {
						if (!this.search_term) {
							return this.overrides;
						} else {
							let search = this.search_term.toLowerCase();
							return this.overrides.filter(override => {
								return override.model.toLowerCase().includes(search) || Object.keys(override.predicate).find(key => key.includes(search));
							})
						}
					},
					available_predicate_options() {
						let options = {};
						for (let key in this.predicate_options) {
							let data = this.predicate_options[key];
							if ((typeof data.filter == 'string' && data.filter !== this.name) || (data.filter instanceof Array && !data.filter.includes(this.name))) continue;
							options[key] = tl(`dialog.predicate_overrides.predicate.${key}`);
						}
						return options;
					}
				},
				template: `
					<div style="margin-top: 10px;">
						<div class="predicate_override_top_bar">
							<span>${tl('action.predicate_overrides.desc')}</span>
							<search-bar id="predicate_search_bar" v-model="search_term"></search-bar>
						</div>
						<div class="bar flex" style="height: 24px;">
							<div>${tl('dialog.predicate_overrides.model')}</div>
							<div>${tl('dialog.predicate_overrides.predicates')}</div>
						</div>

						<ul class="list" id="predicate_override_list" v-sortable="{onUpdate: sort, animation: 160, handle: '.predicate_drag_handle'}" :style="{maxHeight: max_height + 'px', minHeight: '16px'}">
							<li v-for="override in filtered_overrides" :key="override._uuid">
								<div class="predicate_drag_handle" v-show="!search_term"></div>
								<div class="predicate_model">
									<input type="text" v-model="override.model" class="dark_bordered" list="predicate_model_list" placeholder="item/custom_model">
								</div>
								<ul class="predicate_list"> 
									<li v-for="(value, key) in override.predicate" :key="key">
										<div class="tool" @click="removePredicate(override, key)" v-if="hasMultiplePredicates(override)" title="${tl('generic.remove')}">
											<i class="material-icons">clear</i>
										</div>
										<div class="tool" @click="addPredicate(override)" v-else title="${tl('dialog.predicate_overrides.add_predicate')}">
											<i class="material-icons">add</i>
										</div>

										<select-input :value="key" @input="changePredicateType(override, $event, value, key)" :options="available_predicate_options" />
										<input type="checkbox" :checked="value > 0" @input="changePredicateValue(override, key, $event)" v-if="predicate_options[key] && predicate_options[key].type == 'checkbox'">
										<input type="number" v-else
											min="0"
											:max="predicate_options[key] && predicate_options[key].type == 'peronetage' ? 1 : undefined"
											:step="predicate_options[key] && predicate_options[key].type == 'int' ? 1 : undefined"
											:value="value" @input="changePredicateValue(override, key, $event)"
											class="dark_bordered"
										>

									</li>
									<div class="tool" @click="addPredicate(override)" v-if="hasMultiplePredicates(override)">
										<i class="material-icons">add</i>
									</div>
								</ul>
								<div class="tool" @click="removeOverride(override)" title="${tl('generic.delete')}">
									<i class="material-icons">delete</i>
								</div>
							</li>
						</ul>

						<div id="predicate_override_add" class="flex" style="width: 100%;" v-if="!generator.active">
							<button @click="addOverride()" >
								<i class="material-icons">add</i>
								${tl('dialog.predicate_overrides.add_override')}
							</button>
							<button @click="startGenerator()">
								<i class="material-icons">playlist_add</i>
								${tl('dialog.predicate_overrides.generate_overrides')}
							</button>
							<button @click="deleteAll()">
								<i class="material-icons">delete</i>
								${tl('generic.delete_all')}
							</button>
						</div>

						<div v-if="generator.active" class="bar" id="predicate_override_generator">
							<div class="tool" @click="generator.active = false" title="${tl('generic.remove')}">
								<i class="material-icons">clear</i>
							</div>

							<select-input v-model="generator.type" :options="available_predicate_options" @input="updateGeneratorType()" />

							<label>${tl('dialog.predicate_overrides.variants')}</label>
							<input type="number" v-model="generator.variants" class="dark_bordered" min="1" step="1" style="width: 70px;">

							<template v-if="generator.type == 'custom_model_data'">
								<label>${tl('dialog.predicate_overrides.start_value')}</label>
								<input type="number" v-model="generator.start_value" min="0" step="1" class="dark_bordered" style="width: 45px;">
							</template>

							<label>${tl('dialog.predicate_overrides.model')}</label>
							<input type="text" v-model="generator.model" class="dark_bordered" list="predicate_model_list" placeholder="item/custom_%%">

							<div class="tool" @click="runGenerator()" title="${tl('dialog.predicate_overrides.generate_overrides')}">
								<i class="material-icons">send</i>
							</div>
						</div>
					</div>
				`
			},
			cancel_on_click_outside: false,
			onConfirm() {
				Project.saved = false;
				if (Project.overrides instanceof Array == false) Project.overrides = [];
				dialog.content_vue.overrides.forEach(override => delete override._uuid);
				Project.overrides.replace(dialog.content_vue.overrides);
			},
			onCancel() {
				if (PredicateOverrideEditor.previous_overrides) {
					if (Project.overrides instanceof Array == false) Project.overrides = [];
					Project.overrides.replace(JSON.parse(PredicateOverrideEditor.previous_overrides))
				} else {
					Project.overrides = [];
				}
			},
			onClose() {
				model_options_datalist.remove();
			}
		});

		let model_options_datalist = Interface.createElement('datalist', {id: 'predicate_model_list'});
		let model_options = [];
		let {dialog} = PredicateOverrideEditor;
		dialog.show();

		if (Project.overrides instanceof Array) {
			PredicateOverrideEditor.previous_overrides = JSON.stringify(Project.overrides);
			Project.overrides.forEachReverse((override, i) => {
				if (typeof override !== 'object' || override instanceof Array) {
					Project.overrides.splice(i, 1);
					return;
				}
				if (!override.model) override.model = '';
				if (!override.predicate) override.predicate = {};
				override._uuid = guid();
			})
		}
		dialog.content_vue.name = Project.name;
		dialog.content_vue.overrides.replace(Project.overrides || []);

		if (isApp && Project.export_path) {
			let path_array = Project.export_path.split(/[\\\/]/g);
			let base_path = path_array.slice(0, path_array.lastIndexOf('models')+1).join(osfs);

			let searchFolder = (path) => {
				try {
					var files = fs.readdirSync(path);	
					for (var name of files) {
						var new_path = path + osfs + name;
						if (name.match(/\.json$/)) {
							let rel_path = new_path.replace(base_path, '').replace(/^[\\\/]/, '').replace(/\.json$/, '').replace(/\\+/g, '/');
							model_options.push(rel_path);
							if (model_options.length > 2000) return false;
							
						} else if (!name.includes('.')) {
							let result = searchFolder(new_path);
							if (result) return false;
						}
					}
				} catch (err) {}
			}
			searchFolder(base_path);
		}
		model_options.forEach(model => {
			let option = Interface.createElement('option', {value: model})
			model_options_datalist.append(option);
		})
		document.body.append(model_options_datalist);
	}
}


BARS.defineActions(function() {
	new Action('predicate_overrides', {
		icon: 'format_list_bulleted',
		category: 'tools',
		condition: {formats: ['java_block']},
		click(e) {
			PredicateOverrideEditor.showDialog();
		}
	})
})
