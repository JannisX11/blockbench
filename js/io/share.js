BARS.defineActions(function() {

	function uploadSketchfabModel() {
		if (elements.length === 0 || !Format) {
			return;
		}
		let tag_suggestions = ['low-poly', 'pixel-art', 'NoAI'];
		if (Format.id !== 'free') tag_suggestions.push('minecraft');
		if (Format.id === 'skin') tag_suggestions.push('skin');
		if (!Mesh.all.length) tag_suggestions.push('voxel');
		let clean_project_name = Project.name.toLowerCase().replace(/[_.-]+/g, '-').replace(/[^a-z0-9-]+/, '').replace(/-geo/, '');
		if (Project.name) tag_suggestions.push(clean_project_name);
		if (clean_project_name.includes('-')) tag_suggestions.safePush(...clean_project_name.split('-').filter(s => s.length > 2 && s != 'geo').reverse());
	
		let categories = {
			"": "-",
			"animals-pets": "Animals & Pets",
			"architecture": "Architecture",
			"art-abstract": "Art & Abstract",
			"cars-vehicles": "Cars & Vehicles",
			"characters-creatures": "Characters & Creatures",
			"cultural-heritage-history": "Cultural Heritage & History",
			"electronics-gadgets": "Electronics & Gadgets",
			"fashion-style": "Fashion & Style",
			"food-drink": "Food & Drink",
			"furniture-home": "Furniture & Home",
			"music": "Music",
			"nature-plants": "Nature & Plants",
			"news-politics": "News & Politics",
			"people": "People",
			"places-travel": "Places & Travel",
			"science-technology": "Science & Technology",
			"sports-fitness": "Sports & Fitness",
			"weapons-military": "Weapons & Military",
		}
	
		var dialog = new Dialog({
			id: 'sketchfab_uploader',
			title: 'dialog.sketchfab_uploader.title',
			width: 640,
			form: {
				token: {label: 'dialog.sketchfab_uploader.token', value: settings.sketchfab_token.value, type: 'password'},
				about_token: {type: 'info', text: tl('dialog.sketchfab_uploader.about_token', ['[sketchfab.com/settings/password](https://sketchfab.com/settings/password)'])},
				name: {label: 'dialog.sketchfab_uploader.name', value: capitalizeFirstLetter(Project.name.replace(/\..+/, '').replace(/[_.-]/g, ' '))},
				description: {label: 'dialog.sketchfab_uploader.description', type: 'textarea'},
				category1: {label: 'dialog.sketchfab_uploader.category', type: 'select', options: categories, value: ''},
				category2: {label: 'dialog.sketchfab_uploader.category2', type: 'select', options: categories, value: ''},
				tags: {label: 'dialog.sketchfab_uploader.tags', placeholder: 'Tag1 Tag2'},
				tag_suggestions: {label: 'dialog.sketchfab_uploader.suggested_tags', type: 'buttons', buttons: tag_suggestions, click(index) {
					let {tags} = dialog.getFormResult();
					let new_tag = tag_suggestions[index];
					if (!tags.split(/\s/g).includes(new_tag)) {
						tags += ' ' + new_tag;
						dialog.setFormValues({tags});
					}
				}},
				animations: {label: 'dialog.sketchfab_uploader.animations', value: true, type: 'checkbox', condition: (Format.animation_mode && Animator.animations.length)},
				draft: {label: 'dialog.sketchfab_uploader.draft', type: 'checkbox', value: true},
				divider: '_',
				private: {label: 'dialog.sketchfab_uploader.private', type: 'checkbox'},
				password: {label: 'dialog.sketchfab_uploader.password'},
			},
			onConfirm: function(formResult) {
	
				if (!formResult.token || !formResult.name) {
					Blockbench.showQuickMessage('message.sketchfab.name_or_token', 1800)
					return;
				}
				if (!formResult.tags.split(' ').includes('blockbench')) {
					formResult.tags += ' blockbench';
				}
				var data = new FormData()
				data.append('token', formResult.token)
				data.append('name', formResult.name)
				data.append('description', formResult.description)
				data.append('tags', formResult.tags)
				data.append('isPublished', !formResult.draft)
				//data.append('background', JSON.stringify({color: '#00ff00'}))
				data.append('private', formResult.private)
				data.append('password', formResult.password)
				data.append('source', 'blockbench')
	
				if (formResult.category1 || formResult.category2) {
					let selected_categories = [];
					if (formResult.category1) selected_categories.push(formResult.category1);
					if (formResult.category2) selected_categories.push(formResult.category2);
					data.append('categories', selected_categories);
				}
	
				settings.sketchfab_token.set(formResult.token);
	
				Codecs.gltf.compile({animations: formResult.animations}).then(content => {
	
					var blob = new Blob([content], {type: "text/plain;charset=utf-8"});
					var file = new File([blob], 'model.gltf')
	
					data.append('modelFile', file)
	
					$.ajax({
						url: 'https://api.sketchfab.com/v3/models',
						data: data,
						cache: false,
						contentType: false,
						processData: false,
						type: 'POST',
						success: function(response) {
							let url = `https://sketchfab.com/models/${response.uid}`
							new Dialog('sketchfab_link', {
								title: tl('message.sketchfab.success'),
								icon: 'icon-sketchfab',
								form: {
									message: {type: 'info', text: `[${formResult.name} on Sketchfab](${url})`},
									link: {type: 'text', value: url, readonly: true, share_text: true}
								}
							}).show();
						},
						error: function(response) {
							let response_types = {
								[400]: 'Bad Request',
								[401]: 'Unauthorized',
								[403]: 'Forbidden',
								[404]: 'Not Found',
								[405]: 'Method Not Allowed',
								[406]: 'Not Acceptable',
								[407]: 'Proxy Authentication Required',
								[408]: 'Request Timeout',
								[415]: 'Unsupported File Type',
							}
							Blockbench.showQuickMessage(tl('message.sketchfab.error') + `: Error ${response.status} - ${response_types[response.status]||''}`, 1500)
							console.error(response);
						}
					})
				})
	
				dialog.hide()
			}
		})
		dialog.show()
	}
	new Action('upload_sketchfab', {
		icon: 'icon-sketchfab',
		category: 'file',
		condition: () => Project && Outliner.elements.length,
		click() {
			uploadSketchfabModel()
		}
	})

	new Action('share_model', {
		icon: 'share',
		condition: () => Project && Outliner.elements.length,
		async click() {
			let thumbnail = await new Promise(resolve => {
				Preview.selected.screenshot({width: 640, height: 480}, resolve);
			});
			let image = new Image();
			image.src = thumbnail;
			image.width = 320;
			image.style.display = 'block';
			image.style.margin = 'auto';
			image.style.backgroundColor = 'var(--color-back)';

			var dialog = new Dialog({
				id: 'share_model',
				title: 'dialog.share_model.title',
				form: {
					name: {type: 'text', label: 'generic.name', value: Project.name},
					expire_time: {label: 'dialog.share_model.expire_time', type: 'select', default: '2d', options: {
						'10m': tl('dates.minutes', [10]),
						'1h': tl('dates.hour', [1]),
						'1d': tl('dates.day', [1]),
						'2d': tl('dates.days', [2]),
						'1w': tl('dates.week', [1]),
						'2w': tl('dates.weeks', [2]),
					}},
					info: {type: 'info', text: 'The model and thumbnail will be stored on the Blockbench servers for the duration specified above. [Learn more](https://blockbench.net/blockbench-model-sharing-service/)'},
					reference_images: {type: 'checkbox', label: 'dialog.share_model.reference_images', value: true, condition: () => ReferenceImage.current_project.length},
					thumbnail: {type: 'checkbox', label: 'dialog.share_model.thumbnail', value: true},
				},
				lines: [image],
				part_order: ['form', 'lines'],
				onFormChange(form) {
					image.style.display = form.thumbnail ? 'block' : 'none';
				},
				buttons: ['generic.share', 'dialog.cancel'],
				onConfirm: function(formResult) {
		
					let name = formResult.name;
					let expire_time = formResult.expire_time;
					let model = Codecs.project.compile({
						compressed: false,
						absolute_paths: false,
						reference_images: formResult.reference_images
					});
					let data = {name, expire_time, model}
					if (formResult.thumbnail) data.thumbnail = thumbnail;

					$.ajax({
						url: 'https://blckbn.ch/api/model',
						data: JSON.stringify(data),
						cache: false,
						contentType: 'application/json; charset=utf-8',
						dataType: 'json',
						type: 'POST',
						success: function(response) {
							let link = `https://blckbn.ch/${response.id}`

							new Dialog({
								id: 'share_model_link',
								title: 'dialog.share_model.title',
								singleButton: true,
								form: {
									link: {type: 'text', value: link, readonly: true, share_text: true}
								}
							}).show();

						},
						error: function(response) {
							let error_text = 'dialog.share_model.failed' + ' - ' + response.status;
							if (response.status == 413) {
								if (ReferenceImage.current_project.length && formResult.reference_images) {
									error_text = 'dialog.share_model.too_large_references';
								} else {
									error_text = 'dialog.share_model.too_large';
								}
							}
							Blockbench.showMessageBox({
								title: tl('generic.error'),
								message: error_text,
								icon: 'error'
							})
							console.error(response);
						}
					})
		
					dialog.hide()
				}
			})
			dialog.show()
		}
	})
})