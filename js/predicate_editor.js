
const PredicateOverrideEditor = {
	dialog: null,
	showDialog() {
		PredicateOverrideEditor.dialog = PredicateOverrideEditor.dialog || new Dialog({
			id: 'predicate_overrides',
			title: 'action.predicate_overrides',
			width: 700,
			component: {
				data() {return {
					overrides: [],
					name: '',
					search_term: '',
					model_options: [],
					predicate_options: {
						custom_model_data: {type: 'number'},
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
					
				},
				computed: {
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
						<div class="bar">
							<search-bar id="predicate_search_bar" v-model="search_term"></search-bar>
						</div>
						<div class="bar" style="display: flex;">
							<div>Model</div>
							<div>Predicates</div>
						</div>

						<ul class="list" id="predicate_list">
							<li v-for="override in overrides">
								<div>
									<input type="text" v-model="override.model" class="dark_bordered" list="predicate_model_list">
								</div>
							</li>
						</ul>
					</div>
				`
			},
			onClose() {
				Project.saved = false;
				if (Project.overrides instanceof Array == false) Project.overrides = [];
				Project.overrides.replace(dialog.content_vue.overrides);
				model_options_datalist.remove();
			}
		});
		let model_options_datalist = Interface.createElement('datalist', {id: 'predicate_model_list'});
		let model_options = [];
		let {dialog} = PredicateOverrideEditor;
		dialog.show();
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
