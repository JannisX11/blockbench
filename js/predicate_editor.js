const PredicateOverrideEditor = {
	dialog: null,
	showDialog() {
		let previous_overrides;
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
					predicate_options: {
						custom_model_data: {type: 'int'},
						damage: {type: 'number'},
						damaged: {type: 'checkbox'},
						lefthanded: {type: 'checkbox'},
						angle: {type: 'number', filter: 'compass'},
						time: {type: 'number', filter: 'clock'},
						blocking: {type: 'checkbox', filter: 'shield'},
						broken: {type: 'checkbox', filter: 'elytra'},
						cast: {type: 'number', filter: 'fishing_rod'},
						cooldown: {type: 'number', filter: ['ender_pearl', 'chorus_fruit']},
						pull: {type: 'number', filter: ['bow', 'crossbow']},
						pulling: {type: 'checkbox', filter: ['bow', 'crossbow']},
						charged: {type: 'checkbox', filter: 'crossbow'},
						firework: {type: 'checkbox', filter: 'crossbow'},
						throwing: {type: 'checkbox', filter: 'trident'},
						level: {type: 'number', filter: 'light'},
						filled: {type: 'number', filter: 'bundle'},
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
						<div class="bar flex">
							<div>Model</div>
							<div>Predicates</div>
						</div>

						<ul class="list" id="predicate_override_list" v-sortable="{onUpdate: sort, animation: 160, handle: '.predicate_drag_handle'}" :style="{maxHeight: max_height + 'px'}">
							<li v-for="override in filtered_overrides" :key="override._uuid">
								<div class="predicate_drag_handle" v-show="!search_term"></div>
								<div class="predicate_model">
									<input type="text" v-model="override.model" class="dark_bordered" list="predicate_model_list" placeholder="item/custom_model">
								</div>
								<ul class="predicate_list"> 
									<li v-for="(value, key) in override.predicate" :key="key">
										<div class="tool" @click="removePredicate(override, key)" v-if="hasMultiplePredicates(override)">
											<i class="material-icons">clear</i>
										</div>
										<div class="tool" @click="addPredicate(override)" v-else>
											<i class="material-icons">add</i>
										</div>

										<select-input :value="key" @input="changePredicateType(override, $event, value, key)" :options="available_predicate_options" />
										<input type="checkbox" :checked="value > 0" @input="changePredicateValue(override, key, $event)" v-if="predicate_options[key] && predicate_options[key].type == 'checkbox'">
										<input type="number" :value="value" @input="changePredicateValue(override, key, $event)" class="dark_bordered" v-else>

									</li>
									<div class="tool" @click="addPredicate(override)" v-if="hasMultiplePredicates(override)">
										<i class="material-icons">add</i>
									</div>
								</ul>
								<div class="tool" @click="removeOverride(override)">
									<i class="material-icons">delete</i>
								</div>
							</li>
						</ul>
						<div id="predicate_override_add" @click="addOverride()" style="width: 100%;">
							<i class="material-icons">add</i>
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
				if (previous_overrides) {
					if (Project.overrides instanceof Array == false) Project.overrides = [];
					Project.overrides.replace(JSON.parse(previous_overrides))
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
			previous_overrides = JSON.stringify(Project.overrides);
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
