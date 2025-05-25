
//Textures
class Texture {
	constructor(data, uuid) {
		let scope = this;
		//Info
		for (let key in Texture.properties) {
			Texture.properties[key].reset(this);
		}
		//meta
		this.source = ''
		this.selected = false
		this.multi_selected = false
		this.show_icon = true
		this.error = 0;
		this.visible = true;
		this.source_overwritten = false;
		//Data
		this.img = 0;
		this.width = 0;
		this.height = 0;
		this.uv_width = Project ? Project.texture_width : 16;
		this.uv_height = Project ? Project.texture_height : 16;
		this.currentFrame = 0;
		this.saved = true;
		this.layers = [];
		this.layers_enabled = false;
		this.selected_layer = null;
		this.internal = !isApp;
		this.uuid = uuid || guid()
		this.flags = new Set();

		this._static = Object.freeze({
			properties: {
				selection: new IntMatrix(0, 0)
			}
		});

		if (typeof data === 'object') {
			this.extend(data);
			if (this.layers_enabled) {
				setTimeout(() => {
					Project.whenNextOpen(() => {
						this.updateLayerChanges()
					})
				}, 40);
			}
		}

		//Setup Img/Mat
		this.canvas = document.createElement('canvas');
		this.canvas.width = this.canvas.height = 16;
		this.ctx = this.canvas.getContext('2d', {willReadFrequently: true});
		let img = this.img = new Image();
		img.setAttribute('pagespeed_no_transform', '');
		img.src = 'assets/missing.png'

		var tex = new THREE.Texture(this.canvas);
		tex.magFilter = THREE.NearestFilter
		tex.minFilter = THREE.NearestFilter
		tex.name = this.name;
		img.tex = tex;

		var vertShader = `
			attribute float highlight;

			uniform bool SHADE;
			uniform int LIGHTSIDE;

			${settings.antialiasing_bleed_fix.value ? 'centroid' : ''} varying vec2 vUv;
			varying float light;
			varying float lift;

			float AMBIENT = 0.5;
			float XFAC = -0.15;
			float ZFAC = 0.05;

			void main()
			{

				if (SHADE) {

					vec3 N = normalize( vec3( modelMatrix * vec4(normal, 0.0) ) );

					if (LIGHTSIDE == 1) {
						float temp = N.y;
						N.y = N.z * -1.0;
						N.z = temp;
					}
					if (LIGHTSIDE == 2) {
						float temp = N.y;
						N.y = N.x;
						N.x = temp;
					}
					if (LIGHTSIDE == 3) {
						N.y = N.y * -1.0;
					}
					if (LIGHTSIDE == 4) {
						float temp = N.y;
						N.y = N.z;
						N.z = temp;
					}
					if (LIGHTSIDE == 5) {
						float temp = N.y;
						N.y = N.x * -1.0;
						N.x = temp;
					}

					float yLight = (1.0+N.y) * 0.5;
					light = yLight * (1.0-AMBIENT) + N.x*N.x * XFAC + N.z*N.z * ZFAC + AMBIENT;

				} else {

					light = 1.0;

				}

				if (highlight == 2.0) {
					lift = 0.22;
				} else if (highlight == 1.0) {
					lift = 0.1;
				} else {
					lift = 0.0;
				}
				
				vUv = uv;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}`
		var fragShader = `
			#ifdef GL_ES
			precision ${isApp ? 'highp' : 'mediump'} float;
			#endif

			uniform sampler2D map;

			uniform bool SHADE;
			uniform bool EMISSIVE;
			uniform vec3 LIGHTCOLOR;

			${settings.antialiasing_bleed_fix.value ? 'centroid' : ''} varying vec2 vUv;
			varying float light;
			varying float lift;

			void main(void)
			{
				vec4 color = texture2D(map, vUv);
				
				if (color.a < 0.01) discard;

				if (EMISSIVE == false) {

					gl_FragColor = vec4(lift + color.rgb * light, color.a);
					gl_FragColor.r = gl_FragColor.r * LIGHTCOLOR.r;
					gl_FragColor.g = gl_FragColor.g * LIGHTCOLOR.g;
					gl_FragColor.b = gl_FragColor.b * LIGHTCOLOR.b;

				} else {

					float light_r = (light * LIGHTCOLOR.r) + (1.0 - light * LIGHTCOLOR.r) * (1.0 - color.a);
					float light_g = (light * LIGHTCOLOR.g) + (1.0 - light * LIGHTCOLOR.g) * (1.0 - color.a);
					float light_b = (light * LIGHTCOLOR.b) + (1.0 - light * LIGHTCOLOR.b) * (1.0 - color.a);
					gl_FragColor = vec4(lift + color.r * light_r, lift + color.g * light_g, lift + color.b * light_b, 1.0);

				}

				if (lift > 0.2) {
					gl_FragColor.r = gl_FragColor.r * 0.6;
					gl_FragColor.g = gl_FragColor.g * 0.7;
				}
			}`
		var mat = new THREE.ShaderMaterial({
			uniforms: {
				map: {type: 't', value: tex},
				SHADE: {type: 'bool', value: settings.shading.value},
				LIGHTCOLOR: {type: 'vec3', value: new THREE.Color().copy(Canvas.global_light_color).multiplyScalar(settings.brightness.value / 50)},
				LIGHTSIDE: {type: 'int', value: Canvas.global_light_side},
				EMISSIVE: {type: 'bool', value: this.render_mode == 'emissive'}
			},
			vertexShader: vertShader,
			fragmentShader: fragShader,
			blending: this.render_mode == 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
			side: Canvas.getRenderSide(this),
			transparent: true,
		});
		mat.map = tex;
		mat.name = this.name;
		this.material = mat;

		var size_control = {};

		this.img.onload = () => {
			tex.needsUpdate = true;
			let dimensions_changed = scope.width !== img.naturalWidth || scope.height !== img.naturalHeight;
			scope.width = img.naturalWidth;
			scope.height = img.naturalHeight;
			if (scope.selection) scope.selection.changeSize(scope.width, scope.height);
			if (img.naturalWidth > 16384 || img.naturalHeight > 16384) {
				scope.error = 2;
			}
			scope.currentFrame = Math.min(scope.currentFrame, (scope.frameCount||1)-1)

			if (img.update_from_canvas) {
				delete img.update_from_canvas;
			} else if (!scope.layers_enabled) {
				scope.canvas.width = scope.width;
				scope.canvas.height = scope.height;
				scope.ctx.drawImage(img, 0, 0);
				if (UVEditor.vue.texture == this) UVEditor.updateOverlayCanvas();
			}

			if (this.flags.has('update_uv_size_from_resolution')) {
				this.flags.delete('update_uv_size_from_resolution');
				let size = [scope.width, scope.display_height];
				this.uv_width = size[0];
				this.uv_height = size[1];
			}

			if (scope.isDefault) {
				console.log('Successfully loaded '+scope.name+' from default pack')
			}

			let project = Texture.all.includes(scope) ? Project : ModelProject.all.find(project => project.textures.includes(scope));
			if(!project) return;
			project.whenNextOpen(() => {

				if (Project.box_uv && Format.single_texture && !scope.error) {

					if (!scope.keep_size) {
						let pw = scope.getUVWidth();
						let ph = scope.getUVHeight();
						let nw = img.naturalWidth;
						let nh = img.naturalHeight;

						//texture is unlike project
						var unlike = (pw != nw || ph != nh);
						//Resolution of this texture has changed
						var changed = size_control.old_width && (size_control.old_width != nw || size_control.old_height != nh);
						//Resolution could be a multiple of project size
						var multi = (
							(pw%nw == 0 || nw%pw == 0) &&
							(ph%nh == 0 || nh%ph == 0)
						)

						if (unlike && changed && !multi) {
							Blockbench.showMessageBox({
								translateKey: 'update_res',
								icon: 'photo_size_select_small',
								buttons: [tl('message.update_res.update'), tl('dialog.cancel')],
								confirm: 0,
								cancel: 1
							}, function(result) {
								if (result === 0) {
									setProjectResolution(img.naturalWidth, img.naturalHeight)
									if (selected.length) {
										UVEditor.loadData()
									}
								}
							})
						}
					}
					delete scope.keep_size;
					size_control.old_width = img.naturalWidth
					size_control.old_height = img.naturalHeight
				}

				if (dimensions_changed) {
					TextureAnimator.updateButton()
					if (UVEditor.vue && UVEditor.vue.texture == this) UVEditor.vue.updateTexture()
					Canvas.updateAllFaces(scope)
				}
				if (typeof scope.load_callback === 'function') {
					scope.load_callback(scope);
					delete scope.load_callback;
				}
			})
		}
		this.img.onerror = (error) => {
			if (isApp &&
				!scope.isDefault &&
				scope.mode !== 'bitmap' &&
				scope.fromDefaultPack()
			) {
				return true;
			} else {
				scope.loadEmpty()
			}
		}

		if (!this.id) {
			var i = Texture.all.length;
			while (true) {
				var c = 0
				var duplicates = false;
				while (c < Texture.all.length) {
					if (Texture.all[c].id == i) {
						duplicates = true;
					}
					c++;
				}
				if (duplicates === true) {
					i++;
				} else {
					this.id = i.toString();
					break;
				}
			}
		}
	}
	get frameCount() {
		if (Format.animated_textures && this.ratio !== (this.getUVWidth() / this.getUVHeight())) {
			let frames = Math.ceil((this.getUVWidth() / this.getUVHeight()) / this.ratio - 0.05);
			if (frames > 1) return frames;
		}
	}
	get display_height() {
		return this.height / (this.frameCount || 1);
	}
	get ratio() {
		return this.width / this.height;
	}
	// Legacy support
	get mode() {
		return this.internal ? 'bitmap' : 'link';
	}
	set mode(mode) {
		this.internal = mode == 'bitmap';
	}
	get selection() {
		return this._static.properties.selection;
	}
	get material() {
		return this._static.properties.material;
	}
	set material(material) {
		this._static.properties.material = material;
	}
	getUVWidth() {
		return Format.per_texture_uv_size ? this.uv_width : Project.texture_width;
	}
	getUVHeight() {
		return Format.per_texture_uv_size ? this.uv_height : Project.texture_height;
	}
	getErrorMessage() {
		switch (this.error) {
			case 0: return ''; break;
			case 1: return tl('texture.error.file'); break;
			case 2: return tl('texture.error.too_large', ['16384']); break;
			//case 1: return tl('texture.error.invalid'); break;
			//case 2: return tl('texture.error.ratio'); break;
			case 3: return tl('texture.error.parent'); break;
		}
	}
	getGroup() {
		if (!this.group) return;
		let group = TextureGroup.all.find(group => group.uuid == this.group);
		if (group) {
			return group;
		}
	}
	getUndoCopy(bitmap) {
		var copy = {};
		for (var key in Texture.properties) {
			Texture.properties[key].copy(this, copy)
		}
		copy.visible = this.visible;
		copy.selected = this.selected;
		copy.internal = this.internal;
		copy.saved = this.saved;
		copy.uuid = this.uuid;
		copy.old_width = this.old_width;
		copy.old_height = this.old_height;

		if (this.layers_enabled) {
			copy.layers = this.layers.map(layer => {
				return layer.getUndoCopy(bitmap);
			})
			copy.selected_layer = this.selected_layer?.uuid;
		}
		if (bitmap || this.internal) {
			copy.source = this.source
			if (!this.layers_enabled) {
				copy.image_data = this.getDataURL();
			}
		}
		return copy
	}
	getSaveCopy(bitmap) {
		var copy = {};
		for (var key in Texture.properties) {
			Texture.properties[key].copy(this, copy)
		}
		copy.visible = this.visible;
		copy.internal = this.internal;
		copy.saved = this.saved;
		copy.uuid = this.uuid;
		delete copy.selected;

		if (this.layers_enabled) {
			copy.layers = this.layers.map(layer => {
				return layer.getSaveCopy();
			})
		}
		if (bitmap || this.internal) {
			copy.source = this.source
		}
		return copy
	}
	extend(data) {
		for (var key in Texture.properties) {
			Texture.properties[key].merge(this, data)
		}
		Merge.boolean(this, data, 'visible')
		Merge.string(this, data, 'mode', mode => (mode === 'bitmap' || mode === 'link'))
		Merge.boolean(this, data, 'saved')
		Merge.boolean(this, data, 'internal')
		Merge.boolean(this, data, 'keep_size')

		if (data.layers instanceof Array) {
			let old_layers = this.layers.slice();
			this.layers.empty();
			data.layers.forEach(layer_template => {
				let layer = old_layers.find(l => l.uuid == layer_template.uuid);
				if (layer)  {
					layer.extend(layer_template);
					old_layers.remove(layer);
				} else {
					layer = new TextureLayer(layer_template, this, layer_template.uuid);
				}
				this.layers.push(layer);
			})

		} else if (!data.layers_enabled) {
			this.layers.empty();
		}
		if (data.selected_layer) {
			let layer = this.layers.find(l => l.uuid == data.selected_layer);
			if (layer) layer.select();
		} else if (this.selected_layer && (this.layers_enabled == false || !this.layers.find(this.selected_layer))) {
			delete this.selected_layer;
		}

		if (this.mode === 'bitmap' || !isApp) {
			Merge.string(this, data, 'source')
		} else if (data.path) {
			this.source = this.path.replace(/#/g, '%23') + '?' + tex_version;
		}
		return this;
	}
	//Loading
	load(cb) {
		this.error = 0;
		this.show_icon = true;
		this.img.src = this.source;
		this.load_callback = cb;
		return this;
	}
	fromJavaLink(link, path_array) {
		if (typeof link !== 'string' || (link.substr(0, 1) === '#' && !link.includes('/'))) {
			this.load();
			return this;
		}
		// Backwards compatibility
		if (link.substr(0, 22) === 'data:image/png;base64,') {
			this.fromDataURL(link)
			return this;
		}
		if (isApp && (link.substr(1, 2) === ':\\' || link.substr(1, 2) === ':/')) {
			var path = link.replace(/\\|\//g, osfs).replace(/\?\d+$/, '')
			this.fromPath(path)
			return this;
		}
		var can_load = !!path_array.length
		var spaces = link.split(':')
		if (spaces.length > 1) {
			this.namespace = spaces[0]
			link = spaces[1]
			path_array[path_array.length-1] = this.namespace
		} else {
			path_array[path_array.length-1] = 'minecraft'
		}

		if (path_array.includes('cit')) {
			path_array.pop();
			path_array.push(link.replace(/^\.*\//, '').replace(/\//g, osfs)+'.png')
		} else {
			path_array.push('textures', link.replace(/\//g, osfs)+'.png');
		}
		var path = path_array.join(osfs);

		if (path && can_load) {
			this.fromPath(path)
		} else {
			this.path = path
			this.folder = link.replace(/\\/g, '/').split('/')
			this.folder = this.folder.splice(0, this.folder.length-1).join('/')
			this.name = pathToName(path, true)
			this.mode = 'link'
			this.saved = true
			this.load()
		}
		return this;
	}
	fromFile(file) {
		if (!file) return this;
		if (file.name) this.name = file.name
		if (typeof file.content === 'string' && file.content.substr(0, 4) === 'data') {
			this.fromDataURL(file.content)

			if (!file.path) {
			} else if (pathToExtension(file.path) === 'png') {
				this.path = file.path
			} else if (pathToExtension(file.path) === 'tga') {
				this.path = ''
			}

		} else if (isApp) {
			this.fromPath(file.path)
		}
		this.saved = true
		return this;
	}
	fromPath(path) {
		var scope = this;
		if (path && pathToExtension(path) === 'tga') {
			var targa_loader = new Targa()
			targa_loader.open(path, function() {
				scope.fromFile({
					name: pathToName(path, true),
					path: path,
					content: targa_loader.getDataURL()
				})
			})
			return this;
		}
		this.path = path
		this.name = pathToName(path, true)
		this.mode = 'link'
		this.saved = true;
		if (path.includes('data:image')) {
			this.source = path
		} else {
			this.source = path.replace(/#/g, '%23') + '?' + tex_version
		}
		if (Format.texture_folder) {
			this.generateFolder(path);
			let relevant_path = this.folder ? this.folder + '/' + this.name : this.name;
			if (relevant_path.match(/[^a-z0-9._/\\-]/) && settings.dialog_invalid_characters.value) {
				Blockbench.showMessageBox({
					translateKey: 'invalid_characters',
					message: tl('message.invalid_characters.message', ['`a-z0-9._-`']) + '\n\n' + tl('data.file_path') + ':  ```' + relevant_path + '```',
					icon: 'folder_open',
					width: 436,
					checkboxes: {
						dont_show_again: {value: false, text: 'dialog.dontshowagain'}
					}
				}, (button, checkboxes = {}) => {
					if (checkboxes.dont_show_again) {
						settings.dialog_invalid_characters.set(false);
					}
				})
			}
		}
		if (isApp && Format.texture_mcmeta) {
			let mcmeta_path = this.path + '.mcmeta';
			if (fs.existsSync(mcmeta_path)) {
				let mcmeta;
				try {
					let text = fs.readFileSync(mcmeta_path, 'utf8');
					mcmeta = autoParseJSON(text, true);
				} catch (err) {
					console.error(err);
				}
				if (mcmeta && mcmeta.animation) {
					let frame_order_type = 'loop';
					let {frames} = mcmeta.animation;
					let frame_string = '';
					if (frames instanceof Array) {
						frame_order_type = 'custom';
						if (!frames.find(v => typeof v !== 'number')) {
							
							if (frames.findIndex((val, index) => val != index) == -1) {
								frame_order_type = 'loop';

							} else if (frames.findIndex((val, index) => val != (frames.length-index-1)) == -1) {
								frame_order_type = 'backwards';
								
							} else if (frames.findIndex((val, index) => {
								return index < (frames.length/2 + 1)
									? val != index
									: val != (frames.length-index);
							}) == -1) {
								frame_order_type = 'back_and_forth';
							}
						}
						if (frame_order_type === 'custom') {
							frame_string = frames.map(frame => {
								if (typeof frame == 'object') {
									if (frame.index !== undefined && frame.time) {
										return `${frame.index}:${frame.time}`
									} else {
										return frame.index || 0;
									}
								} else {
									return frame;
								}
							}).join(' ');
						}
					}
					this.extend({
						frame_time: mcmeta.animation.frametime,
						frame_order_type,
						frame_order: frame_string
					})
				}
			}
		}

		let duplicate = Texture.all.find(tex => (tex !== this && tex.path === this.path && tex.saved));
		if (duplicate && isApp && this.path && PathModule.isAbsolute(this.path)) {
			if (!Format.single_texture) {
				let affected_elements = Outliner.elements.filter(el => {
					if (typeof el.faces !== 'object') return false;
					for (let fkey in el.faces) {
						if (el.faces[fkey].texture == duplicate.uuid) {
							return true;
						}
					}
				});
				if (affected_elements.length && Undo.current_save) {
					Undo.current_save.addElements(affected_elements);
					affected_elements.forEach(el => {
						for (let fkey in el.faces) {
							if (el.faces[fkey].texture == duplicate.uuid) {
								el.faces[fkey].texture = this.uuid;
							}
						}
					})
				}
			}
			duplicate.remove(false);
		}

		this.startWatcher()
		Painter.current = {}
		
		if (Project.EditSession) {
			this.load(() => {
				var before = {textures: {}}
				before.textures[scope.uuid] = true;
				this.edit()
				var post = new Undo.save({textures: [this]})
				Project.EditSession.sendEdit({
					before: before,
					post: post,
					action: 'loaded_texture',
					save_history: false
				})
			})
		} else {
			this.load()
		}
		return this;
	}
	// Used to load only file content, not generate metadata from path. Used when loading bbmodel files
	loadContentFromPath(path) {
		this.path = path
		this.mode = 'link'
		this.saved = true;
		if (path.includes('data:image')) {
			this.source = path
		} else {
			this.source = path.replace(/#/g, '%23') + '?' + tex_version
		}
		this.startWatcher()
		this.load()
		return this;
	}
	fromDataURL(data_url) {
		this.source = data_url
		this.internal = true;
		this.saved = false;
		this.load();
		return this;
	}
	fromDefaultPack() {
		if (isApp && settings.default_path && settings.default_path.value) {
			if (Project.BedrockEntityManager) {
				var path = Project.BedrockEntityManager.findEntityTexture(Project.geometry_name, 'raw')
				if (path) {
					this.isDefault = true;
					path = settings.default_path.value + osfs + path

					if (fs.existsSync(path + '.png')) {
						this.fromPath(path + '.png')
						delete this.isDefault
						return true;

					} else if (fs.existsSync(path + '.tga')) {
						this.fromPath(path + '.tga')
						delete this.isDefault
						return true;
					}
					delete this.isDefault
				}
			} else if (this.name && this.name.includes('.')) {
				var folder = this.folder.replace(/\//g, osfs);
				var path = settings.default_path.value + osfs + (folder ? (folder+osfs) : '') + this.name
				if (fs.existsSync(path)) {
					this.isDefault = true;
					this.fromPath(path)
					return true;
				}
			}
		}
	}
	loadEmpty(error_id) {
		this.img.src = 'assets/missing.png'
		this.error = error_id||1;
		this.show_icon = false;
		return this;
	}
	updateSource(dataUrl) {
		// Update the source, only used when source is secure + base64 
		if (!dataUrl) dataUrl = this.source;
		this.source = dataUrl;
		this.img.src = dataUrl;
		this.updateMaterial();
		return this;
	}
	updateMaterial() {
		if (Format.image_editor) return this;
		let mat = this.getOwnMaterial();

		mat.name = this.name;
		mat.uniforms.EMISSIVE.value = this.render_mode == 'emissive';
		mat.blending = this.render_mode == 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
		mat.side = this.render_sides == 'auto' ? Canvas.getRenderSide() : (this.render_sides == 'front' ? THREE.FrontSide : THREE.DoubleSide);

		// Map
		mat.map.needsUpdate = true;

		// PBR material
		if (this.group && (this.pbr_channel == 'mer' || this.pbr_channel == 'height') && this.getGroup()?.is_material && BarItems.view_mode.value == 'material') {
			setTimeout(() => {
				this.getGroup()?.updateMaterial();
			}, 40);
		}
		return this;
	}
	reopen(force) {
		var scope = this;
		this.stopWatcher()

		function _replace() {
			Blockbench.import({
				resource_id: 'texture',
				extensions: ['png', 'tga'],
				type: 'PNG Texture',
				readtype: 'image',
				startpath: scope.path
			}, function(files) {
				scope.fromFile(files[0])

			})
			Painter.current = {}
			UVEditor.loadData();
			Blockbench.dispatchEvent( 'change_texture_path', {texture: scope} )
		}
		if (scope.saved || force) {
			_replace()
		} else {
			Blockbench.showMessageBox({
				translateKey: 'unsaved_texture',
				icon: 'warning',
				buttons: [tl('dialog.continue'), tl('dialog.cancel')],
				confirm: 0,
				cancel: 1
			}, function(result) {
				if (result === 0) {
					_replace()
				}
			})
		}
	}
	refresh(single) {
		if (this.internal) {
			return false;
		}
		if (single) {
			tex_version++;
		}
		this.source = this.source.replace(/\?\d+$/, '?' + tex_version)
		this.load();
		this.updateMaterial()
		TickUpdates.UVEditor = true;
		TickUpdates.texture_list = true;
	}
	reloadTexture() {
		this.refresh(true)
	}
	startWatcher() {
		if (this.mode !== 'link' || !isApp || !this.path.match(/\.[a-zA-Z]+$/) || !fs.existsSync(this.path)) {
			return;
		}
		var scope = this;
		this.stopWatcher();

		let timeout;
		this._static.properties.watcher = fs.watch(scope.path, (eventType) => {
			if (this.flags.has('file_just_changed')) return;
			if (eventType == 'change') {
				if (timeout) clearTimeout(timeout)
				timeout = setTimeout(() => {
					if (scope.layers_enabled || scope.internal) return;
					if (Texture.all.includes(scope)) {
						scope.reloadTexture();
					} else {
						let project = ModelProject.all.find(project => project.textures.includes(scope));
						if (project) {
							project.whenNextOpen(() => {
								scope.reloadTexture();
							})
						}
					}
				}, 60)
			}
		})
	}
	stopWatcher() {
		if (isApp && this._static.properties.watcher) {
			this._static.properties.watcher.close()
		}
		return this;
	}
	generateFolder(path) {
		if (path.includes(osfs+'optifine'+osfs+'cit'+osfs)) {

			if (Project.export_path) {
				let model_arr = Project.export_path.split(osfs).slice(0, -1);
				let tex_arr = path.split(osfs).slice(0, -1);
				let index = 0;
				tex_arr.find((dir, i) => {
					if (dir != model_arr[i]) return true;
					index++;
				})
				this.folder = ['.', ...tex_arr.slice(index)].join('/');
			} else {
				this.folder = '.';
			}

		} else if (path.includes(osfs+'textures'+osfs)) {
			var arr = path.split(osfs+'textures'+osfs);

			var arr1 = arr[0].split(osfs);
			this.namespace = arr1.last();

			var arr2 = arr[arr.length-1].split(osfs);
			arr2.pop();
			this.folder = arr2.join('/');
			if (Format.id == 'optifine_entity') {
				this.folder = 'textures/' + this.folder;
			}
		} else {
			let model_arr = Project.export_path.split(osfs).slice(0, -1);
			let tex_arr = path.split(osfs).slice(0, -1);
			let index = 0;
			tex_arr.find((dir, i) => {
				if (Project.export_path && dir != model_arr[i]) return true;
				if (!Project.export_path && tex_arr[i-2] == 'optifine' && tex_arr[i-1] == 'cem') return true; 
				index++;
			})
			this.folder = tex_arr.slice(index).join('/');

			if (Format.texture_folder && isApp && settings.dialog_loose_texture.value) {
				Blockbench.showMessageBox({
					translateKey: 'loose_texture',
					icon: 'folder_open',
					buttons: [tl('dialog.ok'), tl('message.loose_texture.change')],
					checkboxes: {
						dont_show_again: {value: false, text: 'dialog.dontshowagain'}
					}
				}, (result, checkboxes = {}) => {
					if (result === 1) {
						this.reopen()
					}
					if (checkboxes.dont_show_again) {
						settings.dialog_loose_texture.set(false);
					}
				})
			}
		}
		return this;
	}
	getMaterial() {
		let group = this.getGroup();
		if (group?.is_material && BarItems.view_mode.value == 'material') {
			return group.getMaterial();
		}
		return this.material;
	}
	getOwnMaterial() {
		return this.material;
	}
	//Management
	select(event) {
		if (event instanceof Event) {
			Prop.active_panel = 'textures';
		}
		if (event && (event.shiftKey || event.ctrlOrCmd || Pressing.overrides.ctrl || Pressing.overrides.shift)) {
			if (event.shiftKey || Pressing.overrides.shift) {
				this.multi_selected = true;
				let start_i = Texture.last_selected;
				let end_i = Texture.all.indexOf(this);
				if (start_i > end_i) [start_i, end_i] = [end_i, start_i];
				for (let i = start_i+1; i < end_i; i++) {
					Texture.all[i].multi_selected = true;
				}
			} else {
				this.multi_selected = !this.multi_selected;
			}
			Texture.last_selected = Texture.all.indexOf(this);
			return;
		}
		Texture.all.forEach(s => {
			if (s.selected) s.selected = false;
			if (s.multi_selected) s.multi_selected = false;
		});
		this.selected = true;
		Texture.selected = this;
		Texture.last_selected = Texture.all.indexOf(this);
		if (this.layers_enabled && !this.selected_layer && this.layers[0]) {
			this.layers[0].select();
		}
		if (this.group) {
			let group = this.getGroup();
			if (group) group.folded = false;
		}
		this.scrollTo();
		if (this.render_mode == 'layered') {
			Canvas.updatePixelGrid()
		} else if ((Format.single_texture || Format.single_texture_default) && Texture.all.length > 1) {
			Canvas.updateAllFaces()
		}
		updateSelection()
		if (
			(Texture.all.length > 1 || !Format.edit_mode) &&
			Modes.paint &&
			(
				!UVEditor.getReferenceFace() ||
				(BarItems.view_mode.value == 'material' && UVEditor.getReferenceFace().getTexture()?.getGroup()?.getTextures()?.includes(this))
			)
		) {
			UVEditor.vue.updateTexture();
		}
		Panels.layers.inside_vue.layers = this.layers;
		updateInterfacePanels();
		Blockbench.dispatchEvent('select_texture', {texture: this});
		Blockbench.dispatchEvent('update_texture_selection');
		return this;
	}
	add(undo, uv_size_from_resolution) {
		if (isApp && this.path && Project.textures.length) {
			for (var tex of Project.textures) {
				if (tex.path === this.path) return tex;
			}
		}
		if (Texture.all.find(t => t.render_mode == 'layered')) {
			this.render_mode = 'layered';
		}
		if (Format.per_texture_uv_size && uv_size_from_resolution) {
			this.flags.add('update_uv_size_from_resolution');
		}
		if (undo) {
			Undo.initEdit({textures: []})
		}
		if (!Project.textures.includes(this)) {
			Project.textures.push(this)
		}
		Blockbench.dispatchEvent( 'add_texture', {texture: this})

		if ((Format.single_texture || Format.single_texture_default) && Cube.all.length) {
			Canvas.updateAllFaces()
			if (selected.length) {
				UVEditor.loadData()
			}
		}
		TickUpdates.selection = true;
		
		if (undo) {
			Undo.finishEdit('Add texture', {textures: [this]})
		}
		return this;
	}
	remove(no_update) {
		if (!no_update) {
			Undo.initEdit({textures: [this]})
		}
		this.stopWatcher()
		if (Texture.selected == this) {
			Texture.selected = undefined;
		}
		Project.textures.splice(Texture.all.indexOf(this), 1)
		Blockbench.dispatchEvent('update_texture_selection');
		if (!no_update) {
			Canvas.updateAllFaces()
			TextureAnimator.updateButton()
			if (UVEditor.texture == this) {
				UVEditor.vue.updateTexture();
			}
			BARS.updateConditions()
			Undo.finishEdit('Remove texture', {textures: []})
		}
	}
	toggleVisibility() {
		if (this.render_mode !== 'layered') {
			this.visible = true;
			return this;
		}
		this.visible = !this.visible;
		let c = 0;
		Texture.all.forEach(tex => {
			if (tex.visible) {
				c++;
				if (c >= 3 && tex !== this) {
					tex.visible = false;
				}
			}
		})
		Canvas.updateLayeredTextures();
	}
	//Use
	enableParticle() {
		if (Format.select_texture_for_particles) {
			Texture.all.forEach(function(s) {
				s.particle = false;
			})
			this.particle = true
		}
		return this;
	}
	setAsDefaultTexture() {
		if (Format.single_texture_default) {
			Texture.all.forEach(tex => tex.use_as_default = false);
			this.use_as_default = true;
			if (Texture.all.length > 1) {
				Canvas.updateAllFaces();
			}
		}
		return this;
	}
	fillParticle() {
		var particle_tex = false
		Texture.all.forEach(function(t) {
			if (t.particle) {
				particle_tex = t
			}
		})
		if (!particle_tex) {
			this.enableParticle()
		}
		return this;
	}
	apply(all) {
		let affected_elements;
		if (Format.per_group_texture) {
			let groups = Group.multi_selected;
			Outliner.selected.forEach(el => {
				if (el.faces) {
					groups.safePush(el.parent);
				}
			});
			groups = groups.filter(g => g instanceof Group);
			affected_elements = [];
			Undo.initEdit({outliner: true});
			groups.forEach(group => {
				group.texture = this.uuid;
				group.forEachChild(child => {
					if (child.faces) affected_elements.safePush(child);
				})
			})
		} else {
			affected_elements = Outliner.selected.filter(el => el.faces);
			if (!affected_elements.length) return;
			Undo.initEdit({elements: affected_elements})
	
			affected_elements.forEach((element) => {
				let selected_faces = UVEditor.getSelectedFaces(element);
				for (var face in element.faces) {
					if (all || element.box_uv || selected_faces.includes(face)) {
						var f = element.faces[face]
						if (all !== 'blank' || (f.texture !== null && !f.getTexture())) {
							f.texture = this.uuid
						}
					}
				}
			})
		}
		Canvas.updateView({elements: affected_elements, element_aspects: {faces: true, uv: true}})
		UVEditor.loadData()
		Undo.finishEdit('Apply texture')
		return this;
	}
	//Interface
	openFolder() {
		if (!isApp || !this.path) return this;
		if (!fs.existsSync(this.path)) {
			Blockbench.showQuickMessage('texture.error.file')
			return this;
		}
		showItemInFolder(this.path)
		return this;
	}
	openEditor() {
		var scope = this;
		if (!settings.image_editor.value) {
			changeImageEditor(scope)

		} else {
			if (fs.existsSync(settings.image_editor.value)) {
				if (Blockbench.platform == 'darwin') {
					require('child_process').exec(`open '${this.path}' -a '${settings.image_editor.value}'`)
				} else {
					require('child_process').spawn(settings.image_editor.value, [this.path])
				}
			} else {
				Blockbench.showMessageBox({
					icon: 'fas.fa-pen-square',
					title: tl('message.image_editor_missing.title'),
					message: tl('message.image_editor_missing.detail'),
					buttons: ['dialog.ok', 'dialog.cancel']
				}, (result) => {
					if (result == 1) return;
					changeImageEditor(scope);
				})
			}
		}
		return this;
	}
	showContextMenu(event) {
		if (this != Texture.selected) this.select()
		Prop.active_panel = 'textures'
		this.menu.open(event, this)
	}
	openMenu() {
		this.select();

		let title = `${this.name} (${this.width} x ${this.height})`;
		let path = [];

		if (this.path) {
			var arr = this.path.split(osfs)
			arr.splice(-1);
			arr.forEach(dir => {
				path.push(dir);
				path.push(Interface.createElement('span', {class: 'slash'}, '/'));
			})
			path.push(Interface.createElement('span', {class: 'accent_color'}, this.name));
		}
		let form = {
			name: 		{label: 'generic.name', value: this.name},
			variable: 	{label: 'dialog.texture.variable', value: this.id, condition: {features: ['texture_folder']}},
			folder: 	{label: 'dialog.texture.folder', value: this.folder, condition: () => Format.texture_folder},
			namespace: 	{label: 'dialog.texture.namespace', value: this.namespace, condition: {features: ['texture_folder']}},
			'render_options': '_',
			render_mode: {label: 'menu.texture.render_mode', type: 'select', value: this.render_mode, options: {
				default: 'menu.texture.render_mode.default',
				emissive: 'menu.texture.render_mode.emissive',
				additive: 'menu.texture.render_mode.additive',
				layered: Format.single_texture && 'menu.texture.render_mode.layered',
			}},
		};
		if (Format.id == 'free') {
			Object.assign(form, {
				render_sides: {label: 'settings.render_sides', type: 'select', value: this.render_sides, options: {
					auto: 'settings.render_sides.auto',
					front: 'settings.render_sides.front',
					double: 'settings.render_sides.double',
				}},
			});
		}
		if (Format.per_texture_uv_size) {
			form.uv_size = {type: 'vector', label: 'dialog.texture.uv_size', value: [this.uv_width, this.uv_height], dimensions: 2, step: 1, min: 1, linked_ratio: false};
		}
		if (Format.texture_mcmeta) {
			Object.assign(form, {
				'texture_mcmeta': '_',
				frame_time: {label: 'dialog.texture.frame_time', type: 'number', value: this.frame_time, min: 1, step: 1, description: 'dialog.texture.frame_time.desc'},
				frame_interpolate: {label: 'dialog.texture.frame_interpolate', type: 'checkbox', value: this.frame_interpolate, description: 'dialog.texture.frame_interpolate.desc'},
				frame_order_type: {label: 'dialog.texture.frame_order_type', type: 'select', value: this.frame_order_type, options: {
					loop: 'dialog.texture.frame_order_type.loop',
					backwards: 'dialog.texture.frame_order_type.backwards',
					back_and_forth: 'dialog.texture.frame_order_type.back_and_forth',
					custom: 'dialog.texture.frame_order_type.custom',
				}},
				frame_order: {label: 'dialog.texture.frame_order', type: 'text', value: this.frame_order, condition: form => form.frame_order_type == 'custom', placeholder: '0 3 1 2', description: 'dialog.texture.frame_order.desc'},
			});
		}
		let preview_img = new Image();
		preview_img.src = this.img.src;
		let header = Interface.createElement('div', {style: 'height: 140px;'}, [
			Interface.createElement('div', {id: 'texture_menu_thumbnail'}, preview_img),
			Interface.createElement('p', {class: 'multiline_text', id: 'te_path'}, settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : path),
		])
		var dialog = new Dialog({
			id: 'texture_edit',
			title,
			lines: [header],
			form,
			onConfirm: results => {

				dialog.hide();
				if (['name', 'variable', 'folder', 'namespace', 'frame_time', 'frame_interpolate', 'frame_order_type', 'frame_order'].find(key => {
					return results[key] !== undefined && results[key] !== this[key];
				}) == undefined) {
					return;
				}

				Undo.initEdit({textures: [this], selected_texture: true})

				let old_render_mode = this.render_mode;

				this.name = results.name;
				if (results.variable !== undefined) this.id = results.variable;
				if (results.folder !== undefined) this.folder = results.folder;
				if (results.namespace !== undefined) this.namespace = results.namespace;
				if (results.render_mode !== undefined) this.render_mode = results.render_mode;
				if (results.render_sides !== undefined) this.render_sides = results.render_sides;
				
				if (Format.per_texture_uv_size) {
					let changed = this.uv_width != results.uv_size[0] || this.uv_height != results.uv_size[1];
					this.uv_width = results.uv_size[0];
					this.uv_height = results.uv_size[1];
					if (changed) Canvas.updateAllUVs();
				}

				if (this.render_mode == 'layered' && old_render_mode !== this.render_mode) {
					Texture.all.forEach((tex, i) => {
						tex.visible = i < 3
					});
					Interface.Panels.textures.inside_vue.$forceUpdate()
					Canvas.updateLayeredTextures();
				}

				this.updateMaterial();
				UVEditor.loadData();

				if (Format.texture_mcmeta) {
					if (['frame_time', 'frame_interpolate', 'frame_order_type', 'frame_order'].find(key => this[key] !== results[key])) {
						this.saved = false;
					}
					this.frame_time = results.frame_time;
					this.frame_interpolate = results.frame_interpolate;
					this.frame_order_type = results.frame_order_type;
					this.frame_order = results.frame_order;
					TextureAnimator.updateSpeed();
				}

				Undo.finishEdit('Edit texture metadata')
			}
		}).show()
	}
	resizeDialog() {
		let scope = this;
		let updated_to_repeat = false;
		let dialog = new Dialog({
			id: 'resize_texture',
			title: 'action.resize_texture',
			form: {
				mode: {label: 'dialog.resize_texture.mode', type: 'inline_select', default: 'crop', options: {
					crop: 'dialog.resize_texture.mode.crop',
					scale: 'dialog.resize_texture.mode.scale',
				}},
				size: {
					label: 'dialog.project.texture_size',
					type: 'vector',
					dimensions: 2,
					linked_ratio: false,
					value: [this.width, this.display_height],
					step: 1, force_step: true,
					min: 1
				},
				frames: {
					label: 'dialog.resize_texture.animation_frames',
					type: 'number',
					condition: () => Format.animated_textures,
					value: this.frameCount || 1,
					min: 1,
					max: 2048,
					step: 1,
				},
				fill: {label: 'dialog.resize_texture.fill', type: 'select', condition: form => form.mode == 'crop', default: 'transparent', options: {
					transparent: 'dialog.resize_texture.fill.transparent',
					color: 'dialog.resize_texture.fill.color',
					repeat: 'dialog.resize_texture.fill.repeat',
				}}
			},
			onFormChange(formResult) {
				if (formResult.frames > (scope.frameCount || 1) && !updated_to_repeat) {
					updated_to_repeat = true;
					this.setFormValues({fill: 'repeat'});
				}
			},
			onConfirm: function(formResult) {

				let old_width = scope.width;
				let old_height = scope.height;
				let elements_to_change = null;
				if (formResult.mode === 'crop' && Texture.length >= 2 && !Format.single_texture) {
					let elements = [...Cube.all, ...Mesh.all].filter(el => {
						for (let fkey in el.faces) {
							if (el.faces[fkey].texture == scope.uuid) return true;
						}
					})
					if (elements.length) elements_to_change = elements;
				}
				if (Format.animated_textures && formResult.frames > 1) {
					formResult.size[1] *= formResult.frames;
				}

				Undo.initEdit({
					textures: [scope],
					bitmap: true,
					elements: elements_to_change,
					uv_only: true
				})

				scope.edit((canvas) => {
					let temp_canvas = document.createElement('canvas');
					let temp_ctx = temp_canvas.getContext('2d');
					let resizeCanvas = (ctx) => {
						temp_canvas.width = ctx.canvas.width;
						temp_canvas.height = ctx.canvas.height;
						temp_ctx.drawImage(ctx.canvas, 0, 0);

						if (ctx.canvas.width == scope.canvas.width && ctx.canvas.height == scope.canvas.height) {
							ctx.canvas.width = formResult.size[0];
							ctx.canvas.height = formResult.size[1];
						} else if (formResult.mode == 'scale') {
							ctx.canvas.width = Math.round(ctx.canvas.width * (formResult.size[0] / scope.canvas.width));
							ctx.canvas.height = Math.round(ctx.canvas.height * (formResult.size[1] / scope.canvas.height));
						}
						ctx.imageSmoothingEnabled = false;
	
						if (formResult.mode == 'crop') {
							switch (formResult.fill) {
								case 'transparent':
									ctx.drawImage(temp_canvas, 0, 0, temp_canvas.width, temp_canvas.height);
									break;
								case 'color':
									ctx.fillStyle = ColorPanel.get();
									ctx.fillRect(0, 0, formResult.size[0], formResult.size[1])
									ctx.clearRect(0, 0, temp_canvas.width, temp_canvas.height)
									ctx.drawImage(temp_canvas, 0, 0, temp_canvas.width, temp_canvas.height);
									break;
								case 'repeat':
									for (var x = 0; x < formResult.size[0]; x += temp_canvas.width) {		
										for (var y = 0; y < formResult.size[1]; y += temp_canvas.height) {
											ctx.drawImage(temp_canvas, x, y, temp_canvas.width, temp_canvas.height);
										}
									}
									break;
							}
						} else {
							ctx.drawImage(temp_canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
						}
					}

					if (scope.layers_enabled && scope.layers.length) {
						for (let layer of scope.layers) {
							resizeCanvas(layer.ctx);
							if (formResult.mode == 'scale') {
								layer.offset[0] = Math.round(layer.offset[0] * (formResult.size[0] / scope.width));
								layer.offset[1] = Math.round(layer.offset[1] * (formResult.size[1] / scope.height));
							}
						}
					} else {
						resizeCanvas(scope.ctx);
					}

					scope.width = formResult.size[0];
					scope.height = formResult.size[1];

					scope.keep_size = true;
					if (formResult.mode == 'scale') {
						// Nothing
					} else if (formResult.fill === 'repeat' && Format.animated_textures && formResult.size[0] < formResult.size[1]) {
						// Animated
					} else if (Format.single_texture || Texture.all.length == 1 || Format.per_texture_uv_size) {

						if (Format.per_texture_uv_size) {
							scope.uv_width = scope.uv_width * (formResult.size[0] / old_width);
							scope.uv_height = scope.uv_height * (formResult.size[1] / old_height);
							Project.texture_width = scope.uv_width;
							Project.texture_height = scope.uv_height;
						} else {
							Undo.current_save.uv_mode = {
								box_uv: Project.box_uv,
								width:  Project.texture_width,
								height: Project.texture_height
							}
							Undo.current_save.aspects.uv_mode = true;
							Project.texture_width = Project.texture_width * (formResult.size[0] / old_width);
							Project.texture_height = Project.texture_height * (formResult.size[1] / old_height);
						}
						Canvas.updateAllUVs()

					} else if (Texture.length >= 2 && elements_to_change) {
						elements_to_change.forEach(element => {
							if (element instanceof Cube) {
								for (var key in element.faces) {
									if (element.faces[key].texture !== scope.uuid) continue;
									var uv = element.faces[key].uv;
									uv[0] /= formResult.size[0] / old_width;
									uv[2] /= formResult.size[0] / old_width;
									uv[1] /= formResult.size[1] / old_height;
									uv[3] /= formResult.size[1] / old_height;
								}
							} else if (element instanceof Mesh) {
								for (var key in element.faces) {
									if (element.faces[key].texture !== scope.uuid) continue;
									var uv = element.faces[key].uv;
									for (let vkey in uv) {
										uv[vkey][0] /= formResult.size[0] / old_width;
										uv[vkey][1] /= formResult.size[1] / old_height;
									}
								}
							}
						})
						Canvas.updateView({elements: elements_to_change, element_aspects: {uv: true}})
					}

				}, {no_undo: true})

				Undo.finishEdit('Resize texture');

				UVEditor.vue.updateTexture();
				setTimeout(updateSelection, 100);
			}
		})
		dialog.show()
		return this;
	}
	scrollTo() {
		var el = $(`#texture_list li.texture[texid=${this.uuid}]`)
		if (el.length === 0 || Texture.all.length < 2) return;

		var outliner_pos = $('#texture_list').offset().top
		var el_pos = el.offset().top
		if (el_pos > outliner_pos && el_pos + 48 < $('#texture_list').height() + outliner_pos) return;

		var multiple = el_pos > outliner_pos ? 0.5 : 0.2
		var scroll_amount = el_pos  + $('#texture_list').scrollTop() - outliner_pos - 20
		scroll_amount -= $('#texture_list').height()*multiple - 15

		$('#texture_list').animate({
			scrollTop: scroll_amount
		}, 200);
	}
	//Layers
	getActiveLayer() {
		if (this.layers_enabled) {
			return this.selected_layer || this.layers[0];
		}
	}
	activateLayers(undo) {
		if (undo) Undo.initEdit({textures: [this], bitmap: true});
		this.layers_enabled = true;
		if (!this.layers.length) {
			let layer = new TextureLayer({
			}, this);
			let image_data = this.ctx.getImageData(0, 0, this.width, this.height);
			layer.setSize(this.width, this.height);
			layer.ctx.putImageData(image_data, 0, 0);
			layer.addForEditing();
		}
		if (undo) Undo.finishEdit('Enable layers on texture');
		updateInterfacePanels();
		BARS.updateConditions();
	}
	selectionToLayer(undo, clone) {
		let texture = this;
		let selection = texture.selection;

		if (undo) Undo.initEdit({textures: [texture], bitmap: true});
		if (!texture.layers_enabled) {
			texture.flags.add('temporary_layers');
			texture.activateLayers(false);
		}

		let {canvas, ctx, offset} = texture.getActiveCanvas();
		let new_offset = [0, 0];
		let copy_canvas = canvas;

		if (selection.is_custom)  {
			let rect = selection.getBoundingRect();
			copy_canvas = document.createElement('canvas');
			let copy_ctx = copy_canvas.getContext('2d');
			copy_canvas.width = rect.width;
			copy_canvas.height = rect.height;
			new_offset = [rect.start_x, rect.start_y];
			selection.maskCanvas(copy_ctx, new_offset);
			copy_ctx.drawImage(canvas, -rect.start_x + offset[0], -rect.start_y + offset[1]);
		}

		if (!texture.internal) {
			texture.convertToInternal();
		}
		if (!clone) {
			let boxes = selection.toBoxes();
			boxes.forEach(box => {
				ctx.clearRect(box[0] - offset[0], box[1] - offset[1], box[2], box[3]);
			})
		}

		let new_layer = new TextureLayer({name: 'selection', offset: new_offset}, texture);
		new_layer.setSize(copy_canvas.width, copy_canvas.height);
		new_layer.ctx.drawImage(copy_canvas, 0, 0);
		texture.layers.splice(texture.layers.indexOf(texture.selected_layer)+1, 0, new_layer);
		new_layer.select();
		new_layer.setLimbo();

		texture.updateLayerChanges(true);
		if (undo) Undo.finishEdit('Texture selection to layer');
		updateInterfacePanels();
		BARS.updateConditions();
	}
	//Export
	javaTextureLink() {
		var link = this.name.replace(/\.png$/, '')
		if (this.folder) {
			link = this.folder + '/' + link
		}
		if (this.namespace && this.namespace !== 'minecraft') {
			link = this.namespace + ':' + link
		}
		return link;
	}
	getMCMetaContent() {
		let mcmeta = {};
		if (this.frameCount > 1) {
			let animation = mcmeta.animation = {
				frametime: this.frame_time
			}

			if (this.getUVWidth() != this.getUVHeight()) {
				animation.width = this.getUVWidth();
				animation.height = this.getUVHeight();
			}

			if (this.frame_interpolate) animation.interpolate = true;

			let indices = this.getAnimationFrameIndices();
			if (indices) animation.frames = indices;

		}
		Blockbench.dispatchEvent('compile_texture_mcmeta', {mcmeta})
		return mcmeta;
	}
	getAnimationFrameIndices() {
		let frame_count = this.frameCount;
		if (this.frame_order_type == 'backwards') {
			return Array(frame_count).fill(1).map((v, i) => frame_count - 1 - i);

		} else if (this.frame_order_type == 'back_and_forth') {
			return Array(frame_count * 2 - 2).fill(1).map((v, i) => {
				return i >= frame_count-1
					? (frame_count*2 - 2 - i)
					: i;
			});

		} else if (this.frame_order_type == 'custom' && this.frame_order.trim()) {
			return this.frame_order.split(/\s+/).map(v => {
				if (v.includes(':')) {
					let [index, time] = v.split(':').map(v2 => parseInt(v2));
					return {index, time};
				} else {
					return parseInt(v)
				}
			});
		}
	}
	save(as) {
		var scope = this;
		if (scope.saved && !as) {
			return this;
		}

		if (isApp) {
			//overwrite path
			let image;
			if (scope.mode === 'link') {
				image = nativeImage.createFromPath(scope.path).toPNG()
			} else {
				image = nativeImage.createFromDataURL(scope.source).toPNG()
			}
			tex_version++;

			function postSave(path) {
				if (Format.texture_mcmeta && scope.frameCount > 1) {
					let mcmeta_content = scope.getMCMetaContent();
					Blockbench.writeFile(path + '.mcmeta', {content: compileJSON(mcmeta_content)})
				}
			}

			if (!as && this.path && fs.existsSync(this.path)) {
				this.flags.add('file_just_changed');
				setTimeout(() => {this.flags.delete('file_just_changed')}, 100);
				fs.writeFileSync(this.path, image);
				postSave(this.path);
				this.mode = 'link';
				this.saved = true;
				this.source = this.path.replace(/#/g, '%23') + '?' + tex_version;
				this.source_overwritten = true;

			} else {
				var find_path;
				if (Texture.all.find(t => t => t != this && t.saved)) {
					let ref_tex = Texture.all.find(t => t => t != this && t.saved);
					find_path = PathModule.join(PathModule.dirname(ref_tex.path), this.name);
				}
				if (!find_path && Format.bone_rig && Project.geometry_name && Project.BedrockEntityManager) {
					find_path = Project.BedrockEntityManager.findEntityTexture(Project.geometry_name, true)
				}
				if (!find_path && Project.export_path) {
					var arr = Project.export_path.split(osfs);
					var index = arr.lastIndexOf('models');
					if (index > 1) arr.splice(index, 256, 'textures')
					if (scope.folder) arr = arr.concat(scope.folder.split('/'));
					arr.push(scope.name)
					find_path = arr.join(osfs)
				}
				Blockbench.export({
					resource_id: 'texture',
					type: 'PNG Texture',
					extensions: ['png'],
					name: scope.name,
					content: image,
					startpath: find_path,
					savetype: 'image'
				}, function(path) {
					postSave(path);
					scope.fromPath(path)
				})
			}
		} else {
			//Download
			Blockbench.export({
				type: 'PNG Texture',
				extensions: ['png'],
				name: scope.name,
				content: scope.source,
				savetype: 'image'
			}, function() {
				scope.saved = true;
			})
		}
		if (Format.image_editor && !Texture.all.find(t => !t.saved)) {
			if (isApp) {
				Format.codec.afterSave();
			} else {
				Project.saved = true;
			}
		}
		return this;
	}
	exportEmissionMap() {
		new Dialog({
			id: 'export_emission_map',
			title: 'dialog.export_emission_map.title',
			form: {
				format: {label: 'dialog.export_emission_map.format', type: 'select', options: {
					luminance: 'dialog.export_emission_map.format.luminance',
					luminance_inverted: 'dialog.export_emission_map.format.luminance_inverted',
					colors: 'dialog.export_emission_map.format.colors'
				}},
				threshold: {label: 'dialog.export_emission_map.threshold', type: 'number', min: 0, max: 254},
				round_up: {
					label: tl('dialog.export_emission_map.round_up', [Math.getNextPower(this.width), Math.getNextPower(this.height)]),
					type: 'checkbox',
					condition: () => !Math.isPowerOfTwo(this.width) || !Math.isPowerOfTwo(this.height)},
				flip_y: {label: 'dialog.export_emission_map.flip_y', type: 'checkbox'},
			},
			onConfirm: form => {

				let canvas = document.createElement('canvas')
				let ctx = canvas.getContext('2d');
				if (form.round_up) {
					canvas.width = Math.getNextPower(this.img.naturalWidth);
					canvas.height = Math.getNextPower(this.img.naturalHeight);
				} else {
					canvas.width = this.img.naturalWidth;
					canvas.height = this.img.naturalHeight;
				}
				if (form.flip_y) {
					ctx.translate( 0, canvas.height );
					ctx.scale( 1, - 1 );
				}
				ctx.drawImage(this.img, 0, 0, this.img.naturalWidth, this.img.naturalHeight);
		
				let data = ctx.getImageData(0, 0, canvas.width, canvas.height);

				for (let i = 0; i < data.data.length; i += 4) {

					if (form.format == 'colors') {
						if (data.data[i+3] <= form.threshold) {
							data.data[i+0] = data.data[i+1] = data.data[i+2] = data.data[i+3] = 0;
						} else {
							data.data[i+3] = 255 - data.data[i+3];
						}
					} else {
						if (data.data[i+3] < 254 && data.data[i+3] > form.threshold) {
							let v = form.format == 'luminance_inverted' ? data.data[i+3] : (255 - data.data[i+3]);
							data.data[i+0] = data.data[i+1] = data.data[i+2] = v;
						} else {
							data.data[i+0] = data.data[i+1] = data.data[i+2] = form.format == 'luminance_inverted' ? 255 : 0;
						}
						data.data[i+3] = 255;
					}
				}
				ctx.putImageData(data, 0, 0);
		
				let dataUrl = canvas.toDataURL('image/png', 1);
		
				Blockbench.export({
					resource_id: 'texture',
					type: 'PNG Texture',
					extensions: ['png'],
					name: this.name.replace(/\.png$/i, '') + '-emission_map',
					content: dataUrl,
					startpath: this.path.replace(/\.png$/i, '') + '-emission_map',
					savetype: 'image'
				})
			}
		}).show();
	}
	// Editing
	getDataURL() {
		var scope = this;
		if (isApp && !scope.internal) {
			var dataUrl = this.canvas.toDataURL('image/png', 1);
		} else {
			var dataUrl = scope.source;
		}
		return dataUrl;
	}
	getBase64() {
		return this.getDataURL().replace('data:image/png;base64,', '');
	}
	convertToInternal(data_url = this.getDataURL()) {
		this.internal = true;
		this.source = data_url;
		this.saved = false;
		return this;
	}
	updateLayerChanges(update_data_url) {
		if (!this.layers_enabled || this.width == 0) return this;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		for (let layer of this.layers) {
			if (layer.visible == false || layer.opacity == 0) continue;
			this.ctx.filter = `opacity(${layer.opacity / 100})`;
			this.ctx.globalCompositeOperation = Painter.getBlendModeCompositeOperation(layer.blend_mode);
			this.ctx.imageSmoothingEnabled = false;
			this.ctx.drawImage(layer.canvas, layer.offset[0], layer.offset[1], layer.scaled_width, layer.scaled_height);
		}
		this.ctx.filter = '';
		this.ctx.globalCompositeOperation = 'source-over';

		if (!Format.image_editor && this.getMaterial()) {
			this.getOwnMaterial().map.needsUpdate = true;
		}
		if (update_data_url) {
			this.internal = true;
			this.source = this.canvas.toDataURL('image/png', 1);
			this.updateImageFromCanvas();
		}
		if (UVEditor.vue.texture == this) UVEditor.updateOverlayCanvas();
	}
	updateChangesAfterEdit() {
		if (this.layers_enabled) {
			this.updateLayerChanges(true);
		} else {
			if (!this.internal) this.convertToInternal();
			if (!Format.image_editor) {
				this.getOwnMaterial().map.needsUpdate = true;
			}
			this.source = this.canvas.toDataURL('image/png', 1);
			this.updateImageFromCanvas();
		}
		if ((this.pbr_channel == 'mer' || this.pbr_channel == 'height') && this.getGroup()?.is_material && BarItems.view_mode.value == 'material') {
			this.getGroup().updateMaterial();
		}
		this.saved = false;
		this.syncToOtherProject();
	}
	updateImageFromCanvas() {
		this.img.update_from_canvas = true;
		this.img.src = this.source;
	}
	getActiveCanvas() {
		let layer = this.layers_enabled && this.getActiveLayer();
		return layer ? layer : this;
	}
	syncToOtherProject() {
		if (!this.sync_to_project) return this;
		let project = ModelProject.all.find(p => p.uuid == this.sync_to_project);
		if (!project) return this;
		let other_texture = project.textures.find(tex => tex.uuid == this.uuid && tex != this);
		if (!other_texture) return this;

		let copy = this.getUndoCopy(true);
		delete copy.sync_to_project;
		other_texture.extend(copy);
		if (other_texture.layers_enabled) {
			other_texture.updateLayerChanges(true);
		} else {
			other_texture.updateSource(other_texture.source);
		}
		return this;
	}
	edit(cb, options = 0) {
		if (cb) {
			Painter.edit(this, cb, options);

		} else if (this.mode === 'link') {
			this.convertToInternal();
		}
		this.saved = false;
	}
}
	Texture.prototype.menu = new Menu([
			new MenuSeparator('apply'),
			tex => ({
				icon: 'star',
				name: tex.use_as_default ? 'menu.texture.use_as_default.clear' : 'menu.texture.use_as_default',
				condition: {features: ['single_texture_default']},
				click(texture) {
					if (texture.use_as_default) {
						texture.use_as_default = false;
					} else {
						texture.setAsDefaultTexture();
					}
				}
			}),
			{
				icon: 'crop_original',
				name: 'menu.texture.face', 
				condition() {return !Format.single_texture && Outliner.selected.length > 0 && !Format.per_group_texture},
				click(texture) {texture.apply()}
			},
			{
				icon: 'texture',
				name: 'menu.texture.blank', 
				condition() {return !Format.single_texture && Outliner.selected.length > 0 && !Format.per_group_texture},
				click(texture) {texture.apply('blank')}
			},
			{
				icon: 'fa-cube',
				name: 'menu.texture.elements',
				condition() {return !Format.single_texture && Outliner.selected.length > 0},
				click(texture) {texture.apply(true)}
			},
			tex => ({
				icon: 'bubble_chart',
				name: tex.particle ? 'menu.texture.particle.clear' : 'menu.texture.particle',
				condition: {features: ['select_texture_for_particles']},
				click(texture) {
					if (texture.particle) {
						texture.particle = false
					} else {
						texture.enableParticle()
					}
				}
			}),
			new MenuSeparator('settings'),
			{
				icon: 'list',
				name: 'menu.texture.pbr_channel',
				condition: (texture) => texture.getGroup()?.is_material,
				children(texture) {
					function applyChannel(channel) {
						let group = texture.getGroup();
						let changed_textures = group.getTextures();

						Undo.initEdit({textures: changed_textures});
						texture.pbr_channel = channel;
						changed_textures.forEach(t =>  {
							t.updateMaterial();
						});
						if (group) group.updateMaterial();
						Undo.finishEdit('Change texture PBR channel');
					}
					return [
						{name: 'menu.texture.pbr_channel.color', icon: texture.pbr_channel == 'color' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {applyChannel('color')}},
						{name: 'menu.texture.pbr_channel.normal', icon: texture.pbr_channel == 'normal' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {applyChannel('normal')}},
						{name: 'menu.texture.pbr_channel.height', icon: texture.pbr_channel == 'height' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {applyChannel('height')}},
						{name: 'menu.texture.pbr_channel.mer', icon: texture.pbr_channel == 'mer' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {applyChannel('mer')}},
					]
				}
			},
			{
				icon: 'list',
				name: 'menu.texture.render_mode',
				condition: (texture) => (!texture.getGroup()?.is_material),
				children(texture) {
					function setViewMode(mode) {
						let update_layered = (mode == 'layered' || texture.render_mode == 'layered');
						let changed_textures = update_layered ? Texture.all : [texture];

						Undo.initEdit({textures: changed_textures});
						changed_textures.forEach(t =>  {
							t.render_mode = mode;
							t.updateMaterial();
						});
						if (update_layered) {
							Texture.all.forEach((tex, i) => {
								tex.visible = i < 3
							})
							Interface.Panels.textures.inside_vue.$forceUpdate()
							Canvas.updateLayeredTextures();
						}
						Undo.finishEdit('Change texture view mode');
					}
					return [
						{name: 'menu.texture.render_mode.default', icon: texture.render_mode == 'default' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {setViewMode('default')}},
						{name: 'menu.texture.render_mode.emissive', icon: texture.render_mode == 'emissive' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {setViewMode('emissive')}},
						{name: 'menu.texture.render_mode.additive', icon: texture.render_mode == 'additive' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {setViewMode('additive')}},
						{name: 'menu.texture.render_mode.layered', icon: texture.render_mode == 'layered' ? 'far.fa-dot-circle' : 'far.fa-circle', click() {setViewMode('layered')}, condition: () => Format.single_texture},
					]
				}
			},
			'resize_texture',
			'animated_texture_editor',
			'create_material',
			'append_to_template',
			{
				name: 'menu.texture.merge_onto_texture',
				icon: 'fa-caret-square-up',
				condition: (tex) => (tex && Texture.all.indexOf(tex) !== 0),
				click(texture) {
					let target = Texture.all[Texture.all.indexOf(texture)-1];
					Undo.initEdit({textures: [target], bitmap: true});

					target.edit((canvas, {ctx}) => {
						ctx.drawImage(texture.img, 0, 0);
					}, {no_undo: true})

					Undo.finishEdit('Merged textures')
				}
			},
			new MenuSeparator('copypaste'),
			'copy',
			'duplicate',
			new MenuSeparator('edit'),
			{
				icon: 'edit',
				name: 'menu.texture.edit_externally',
				condition: (texture) => texture.mode == 'link',
				click(texture) { texture.openEditor() }
			},
			{
				icon: 'draw',
				name: 'menu.texture.edit_in_blockbench',
				condition: (texture) => !Format.image_editor,
				click(texture) {
					let existing_tab, tex2;
					for (let project of ModelProject.all) {
						if (!project.format.image_editor) continue;
						tex2 = project.textures.find(t => t.uuid == texture.uuid || (t.path && t.path == texture.path));
						if (tex2) {
							existing_tab = project;
							break;
						}
					}
					if (existing_tab) {
						existing_tab.select();
						tex2.select();
					} else {
						let original_uuid = Project.uuid;
						let copy = texture.getUndoCopy(true);
						Codecs.image.load(copy, texture.path, [texture.uv_width, texture.uv_height]);
						// Sync
						texture.sync_to_project = Project.uuid;
						if (Texture.all[0]) Texture.all[0].sync_to_project = original_uuid;
					}
				}
			},
			{
				icon: 'tune',
				name: 'menu.texture.edit',
				condition: {modes: ['paint']},
				children: [
					new MenuSeparator('adjustment'),
					'adjust_brightness_contrast',
					'adjust_saturation_hue',
					'adjust_opacity',
					'invert_colors',
					'adjust_curves',
					new MenuSeparator('filters'),
					'limit_to_palette',
					'split_rgb_into_layers',
					'clear_unused_texture_space',
					new MenuSeparator('transform'),
					'flip_texture_x',
					'flip_texture_y',
					'rotate_texture_cw',
					'rotate_texture_ccw',
					'crop_texture_to_selection'
				]
			},
			'enable_texture_layers',
			'disable_texture_layers',
			new MenuSeparator('file'),
			{
				icon: 'folder',
				name: 'menu.texture.folder',
				condition: function(texture) {return isApp && texture.path},
				click(texture) {texture.openFolder()}
			},
			{
				icon: 'save',
				name: 'menu.texture.save',
				condition: function(texture) {return !texture.saved && texture.path},
				click(texture) {texture.save()}
			},
			{
				icon: 'file_download',
				name: 'menu.texture.export',
				click(texture) {texture.save(true)}
			},
			{
				icon: 'flourescent',
				name: 'dialog.export_emission_map.title',
				condition: tex => tex.render_mode == 'emissive',
				click(texture) {texture.exportEmissionMap()}
			},
			new MenuSeparator('manage'),
			{
				icon: 'refresh',
				name: 'menu.texture.refresh',
				condition: function(texture) {return texture.mode == 'link'},
				click(texture) {
					if (texture.layers_enabled) {
						Blockbench.showMessageBox({
							translateKey: 'texture_refresh_conflict',
							icon: 'priority_high',
							commands: {
								keep_ours: tl('message.texture_refresh_conflict.keep_ours'),
								keep_theirs: tl('message.texture_refresh_conflict.keep_theirs')
							},
							buttons: ['dialog.cancel'],
						}, (choice) => {
							if (choice == 'keep_theirs') {
								Undo.initEdit({textures: [texture], bitmap: true});
								UVEditor.vue.layer = null;
								texture.layers_enabled = false;
								texture.selected_layer = null;
								texture.layers.empty();
								texture.refresh(true)
								Undo.finishEdit('Disable layers on texture');
								updateInterfacePanels();
								BARS.updateConditions();
							}
						})
					} else {
						texture.reloadTexture()
					}
				}
			},
			{
				name: 'menu.texture.discard_changes',
				description: 'menu.texture.discard_changes.desc',
				icon: 'delete_sweep',
				condition: (texture) => texture.internal && texture.path && isApp,
				click(texture) {
					Undo.initEdit({textures: [texture], bitmap: true});
					UVEditor.vue.layer = null;
					texture.layers_enabled = false;
					texture.selected_layer = null;
					texture.layers.empty();
					texture.internal = false;
					texture.saved = true;
					texture.source = texture.path.replace(/#/g, '%23') + '?' + tex_version;
					Texture.selected.reloadTexture();
					Undo.finishEdit('Discard texture changes');
					updateInterfacePanels();
					BARS.updateConditions();
				}
			},
			{
				icon: 'file_upload',
				name: 'menu.texture.change',
				click(texture) { texture.reopen()}
			},
			'delete',
			new MenuSeparator('properties'),
			{
				icon: 'list',
				name: 'menu.texture.properties',
				click(texture) { texture.openMenu()}
			}
	])
	Texture.prototype.offset = [0, 0];
	Texture.getDefault = function() {
		if (Format.single_texture_default) {
			let default_enabled = Texture.all.find(tex => tex.use_as_default);
			if (default_enabled) return default_enabled;
		}
		if (Texture.selected && Texture.all.includes(Texture.selected)) {
			if (Texture.selected.visible || Texture.selected.render_mode !== 'layered') {
				return Texture.selected;
			} else {
				return Texture.all.findLast(tex => tex.visible);
			}
		} else if (Texture.selected) {
			Texture.selected = undefined;
		}
		if (Texture.all.length > 1 && Texture.all.find(t => t.render_mode == 'layered')) {
			return Texture.all.findLast(tex => tex.visible);
		}
		return Texture.all[0]
	}
	new Property(Texture, 'string', 'path')
	new Property(Texture, 'string', 'name')
	new Property(Texture, 'string', 'folder')
	new Property(Texture, 'string', 'namespace')
	new Property(Texture, 'string', 'id')
	new Property(Texture, 'string', 'group')
	new Property(Texture, 'number', 'width')
	new Property(Texture, 'number', 'height')
	new Property(Texture, 'number', 'uv_width')
	new Property(Texture, 'number', 'uv_height')
	new Property(Texture, 'boolean', 'particle')
	new Property(Texture, 'boolean', 'use_as_default')
	new Property(Texture, 'boolean', 'layers_enabled')
	new Property(Texture, 'string', 'sync_to_project')
	new Property(Texture, 'enum', 'render_mode', {default: 'default'})
	new Property(Texture, 'enum', 'render_sides', {default: 'auto'})
	new Property(Texture, 'enum', 'pbr_channel', {default: 'color'})
	
	new Property(Texture, 'number', 'frame_time', {default: 1})
	new Property(Texture, 'enum', 'frame_order_type', {default: 'loop', values: ['custom', 'loop', 'backwards', 'back_and_forth']})
	new Property(Texture, 'string', 'frame_order')
	new Property(Texture, 'boolean', 'frame_interpolate')

	Object.defineProperty(Texture, 'all', {
		get() {
			return Project.textures || [];
		},
		set(arr) {
			Project.textures.replace(arr);
		}
	})
	Object.defineProperty(Texture, 'selected', {
		get() {
			return Project.selected_texture
		},
		set(texture) {
			Project.selected_texture = texture;
		}
	})

function saveTextures(lazy = false) {
	Texture.all.forEach(function(tex) {
		if (!tex.saved) {
			if (lazy && isApp && (!tex.path || !fs.existsSync(tex.path))) return;
			tex.save()
		}
	})
}
function loadTextureDraggable() {
	console.warn('loadTextureDraggable no longer exists');
}
function unselectTextures() {
	Texture.all.forEach(function(s) {
		s.selected = false;
		s.multi_selected = false;
	})
	Texture.selected = undefined;
	Canvas.updateLayeredTextures();
	updateInterfacePanels();
	Panels.layers.inside_vue.layers = [];
	Blockbench.dispatchEvent('update_texture_selection');
}
function getTexturesById(id) {
	if (id === undefined) return;
	id = id.replace('#', '');
	return $.grep(Texture.all, function(e) {return e.id == id});
}

SharedActions.add('delete', {
	condition: () => Prop.active_panel == 'textures' && Texture.selected,
	run() {
		let textures = Texture.all.filter(texture => {
			return texture.selected || texture.multi_selected;
		})
		Undo.initEdit({textures});
		textures.forEach(texture => {
			texture.remove(true);
		})
		Canvas.updateAllFaces();
		TextureAnimator.updateButton();
		UVEditor.vue.updateTexture();
		BARS.updateConditions();
		Undo.finishEdit('Remove texture', {textures: []})
	}
})
SharedActions.add('duplicate', {
	condition: () => Prop.active_panel == 'textures' && Texture.selected,
	run() {
		let copy = Texture.selected.getSaveCopy();
		delete copy.path;
		let new_tex = new Texture(copy).fillParticle();
		new_tex.convertToInternal(Texture.selected.getDataURL());
		new_tex.load().add(true);
	}
})
Clipbench.setTexture = function(texture) {
	//Sets the raw image of the texture
	if (!isApp) return;

	Clipbench.texture = texture.getSaveCopy();
	delete Clipbench.texture.path;
	Clipbench.texture.internal = true;
	Clipbench.texture.saved = false;
	Clipbench.texture.source = texture.getDataURL();

	if (isApp) {
		if (texture.mode === 'bitmap') {
			var img = nativeImage.createFromDataURL(texture.source);
		} else {
			var img = nativeImage.createFromPath(texture.source.split('?')[0]);
		}
		clipboard.writeImage(img);
	}
}
Clipbench.pasteTextures = function() {
	function loadFromDataUrl(dataUrl) {
		if (!dataUrl || dataUrl.length < 32) return;
		var texture = new Texture({name: 'pasted', folder: 'block' }).fillParticle().convertToInternal(dataUrl)
		texture.load().add(true);
		setTimeout(function() {
			texture.openMenu();
		}, 40)
	}

	if (Clipbench.texture) {
		var texture = new Texture(Clipbench.texture).convertToInternal(Clipbench.texture.source).fillParticle().load().add(true);
		setTimeout(function() {
			texture.openMenu();
		}, 40)
		Clipbench.texture = null;

	} else if (isApp) {
		var image = clipboard.readImage().toDataURL('image/png', 1);
		loadFromDataUrl(image);
	} else {
		navigator.clipboard.read().then(content => {
			if (content && content[0] && content[0].types.includes('image/png')) {
				content[0].getType('image/png').then(blob => {
					let url = URL.createObjectURL(blob);
					loadFromDataUrl(url);
				})
			}
		}).catch(() => {})
	}
}

BARS.defineActions(function() {
	new Action('import_texture', {
		icon: 'library_add',
		category: 'textures',
		keybind: new Keybind({key: 't', ctrl: true}),
		click(event, context) {
			let start_path;
			if (!isApp) {} else
			if (Texture.all.length > 0) {
				let arr = Texture.all[0].path.split(osfs)
				arr.splice(-1)
				start_path = arr.join(osfs)
			} else if (Project.export_path) {
				let arr = Project.export_path.split(osfs)
				arr.splice(-3)
				arr.push('textures')
				start_path = arr.join(osfs)
			}
			let extensions = ['png', 'tga'];
			if (isApp) {
				extensions.push('texture_set.json');
			}
			Blockbench.import({
				resource_id: 'texture',
				readtype: 'image',
				type: 'PNG Texture',
				extensions,
				multiple: true,
				startpath: start_path
			}, function(files) {
				if (files[0].name.endsWith('texture_set.json')) {
					importTextureSet(files[0]);
					return;
				}
				let new_textures = [], new_texture_groups = [];
				let texture_group = context instanceof TextureGroup ? context : Texture.selected?.getGroup();
				Undo.initEdit({textures: new_textures, texture_groups: new_texture_groups});
				files.forEach((f) => {
					let t = new Texture({name: f.name}).fromFile(f).add(false, true).fillParticle();
					new_textures.push(t);
					if (texture_group) {
						t.group = texture_group.uuid;
					}
				})
				Undo.finishEdit('Add texture');
			})
		}
	})
	new Action('create_texture', {
		icon: 'icon-create_bitmap',
		category: 'textures',
		keybind: new Keybind({key: 't', ctrl: true, shift: true}),
		click() {
			TextureGenerator.addBitmapDialog()
		}
	})
	new Action('append_to_template', {
		icon: 'dashboard_customize',
		category: 'textures',
		condition: () => Texture.all.length && (Cube.selected.length || Mesh.selected.length),
		click() {
			TextureGenerator.appendToTemplateDialog()
		}
	})
	new Action('save_textures', {
		icon: 'save',
		category: 'textures',
		click() {saveTextures()}
	})
	new Action('change_textures_folder', {
		icon: 'fas.fa-hdd',
		category: 'textures',
		condition: () => Texture.all.length > 0,
		click() {
			var path = undefined;
			var i = 0;
			while (i < Texture.all.length && path === undefined) {
				if (typeof Texture.all[i].path == 'string' && Texture.all[i].path.length > 8) {
					path = Texture.all[i].path
				}
				i++;
			}
			if (!path) {return;}

			var path = path.split(osfs)
			path.splice(-1)
			path = path.join(osfs)

			let dirPath = Blockbench.pickDirectory({
				resource_id: 'texture',
				startpath: path,
			})
			if (dirPath && dirPath.length) {
				var new_path = dirPath[0]
				Undo.initEdit({textures: Texture.all})
				Texture.all.forEach(function(t) {
					if (typeof t.path === 'string' && t.path.includes(path)) {
						t.fromPath(t.path.replace(path, new_path))
					} 
				})
				Undo.finishEdit('Change textures folder')
			}
		}
	})
})

Interface.definePanels(function() {

	let texture_component = Vue.extend({
		props: {
			texture: Texture
		},
		data() {return {
			pbr_channels: {
				color: {icon: 'palette'},
				normal: {icon: 'area_chart'},
				height: {icon: 'landscape'},
				mer: {icon: 'brightness_5'},
				mer_subsurface: {icon: 'brightness_6'},
			},
			temp_color: null
		}},
		methods: {
			getDescription(texture) {
				if (texture.error) {
					return texture.getErrorMessage()
				} else {
					let message = texture.width + ' x ' + texture.height + 'px';
					if (!Format.image_editor) {
						let uv_size = texture.width / texture.getUVWidth() * 16;
						message += ` (${trimFloatNumber(uv_size, 2)}x)`;
					}
					if (texture.frameCount > 1) {
						message += ` - ${texture.currentFrame+1}/${texture.frameCount}`
					}
					return message;
				}
			},
			getTextureIconOffset(texture) {
				if (!texture.currentFrame) return;
				let val = texture.currentFrame * -48 * (texture.display_height / texture.width);
				return `${val}px`;
			},
			highlightTexture(event) {
				if (!Format.single_texture && this.texture.error) {
					let material = this.texture.getMaterial();
					let color = material.uniforms.LIGHTCOLOR.value;
					this.temp_color = new THREE.Color().copy(color);
					color.r += 0.3;
					color.g += 0.3;
					color.b += 0.3;
					setTimeout(() => {
					}, 150);
				}
			},
			unhighlightTexture(event) {
				if (!Format.single_texture && this.temp_color) {
					let material = this.texture.getMaterial();
					let color = material.uniforms.LIGHTCOLOR.value;
					color.copy(this.temp_color);
				}
			},
			dragTexture(e1) {
				if (e1.button == 1) return;
				if (getFocusedTextInput()) return;
				convertTouchEvent(e1);
				
				let texture = this.texture;
				let active = false;
				let helper;
				let timeout;
				let last_event = e1;
				let vue_scope = this;

				// scrolling
				let list = document.getElementById('texture_list');
				let list_offset = $(list).offset();
				let scrollInterval = function() {
					if (!active) return;
					if (mouse_pos.y < list_offset.top) {
						list.scrollTop += (mouse_pos.y - list_offset.top) / 7 - 3;
					} else if (mouse_pos.y > list_offset.top + list.clientHeight) {
						list.scrollTop += (mouse_pos.y - (list_offset.top + list.clientHeight)) / 6 + 3;
					}
				}
				let scrollIntervalID;

				function move(e2) {
					convertTouchEvent(e2);
					let offset = [
						e2.clientX - e1.clientX,
						e2.clientY - e1.clientY,
					]
					if (!active) {
						let distance = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2))
						if (Blockbench.isTouch) {
							if (distance > 20 && timeout) {
								clearTimeout(timeout);
								timeout = null;
							} else {
								document.getElementById('texture_list').scrollTop += last_event.clientY - e2.clientY;
							}
						} else if (distance > 6) {
							active = true;
						}
					}
					if (!active) return;

					if (e2) e2.preventDefault();

					if (open_menu) open_menu.hide();

					if (!helper) {
						helper = vue_scope.$el.cloneNode();
						helper.classList.add('texture_drag_helper');
						helper.setAttribute('texid', texture.uuid);

						document.body.append(helper);

						scrollIntervalID = setInterval(scrollInterval, 1000/60)
						
						Blockbench.addFlag('dragging_textures');
					}
					helper.style.left = `${e2.clientX}px`;
					helper.style.top = `${e2.clientY}px`;

					// drag
					$('.outliner_node[order]').attr('order', null);
					$('.drag_hover').removeClass('drag_hover');
					$('.texture[order]').attr('order', null)

					if (isNodeUnderCursor(document.getElementById('cubes_list'), e2)) {
						for (let node of document.querySelectorAll('.outliner_object')) {
							if (isNodeUnderCursor(node, e2)) {
								let parent = node.parentNode;
								parent.classList.add('drag_hover');
								parent.setAttribute('order', '0');
								return;
							}
						}
					}
					if (isNodeUnderCursor(document.querySelector('#texture_list'), e2)) {

						let texture_target = findNodeUnderCursor('#texture_list li.texture', e2);
						if (texture_target) {
							let offset = e2.clientY - $(texture_target).offset().top;
							texture_target.setAttribute('order', offset > 24 ? '1' : '-1');
							return;
						}
						let group_target = findNodeUnderCursor('#texture_list .texture_group_head', e2);
						if (group_target) {
							group_target.classList.add('drag_hover');
							group_target.setAttribute('order', '0');
							return;
						}

						let nodes = document.querySelectorAll('#texture_list > li');
						if (nodes.length) {
							let target = nodes[nodes.length-1];
							target.setAttribute('order', '1');
							target.classList.add('drag_hover');
						}
					}
					last_event = e2;
				}
				async function off(e2) {
					convertTouchEvent(e2);
					if (helper) helper.remove();
					clearInterval(scrollIntervalID);
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', off);
					e2.stopPropagation();

					let outliner_target_node = document.querySelector('#cubes_list li.outliner_node.drag_hover');

					$('.outliner_node[order]').attr('order', null);
					$('.drag_hover').removeClass('drag_hover');
					$('.texture[order]').attr('order', null)
					if (Blockbench.isTouch) clearTimeout(timeout);

					if (!active || Menu.open) return;

					//await new Promise(r => setTimeout(r, 10));

					Blockbench.removeFlag('dragging_textures');


					if (isNodeUnderCursor(Interface.preview, e2)) {
						var data = Canvas.raycast(e2)
						if (data.element && data.face) {
							var elements = data.element.selected ? UVEditor.getMappableElements() : [data.element];

							if (Format.per_group_texture) {
								elements = [];
								let groups = Group.multi_selected;
								Outliner.selected.forEach(el => {
									if (el.faces && el.parent instanceof Group) groups.safePush(el.parent);
								});
								Undo.initEdit({outliner: true});
								groups.forEach(group => {
									group.texture = texture.uuid;
									group.forEachChild(child => {
										if (child.preview_controller?.updateFaces) child.preview_controller.updateFaces(child);
									})
								})
							} else {
								Undo.initEdit({elements});
								elements.forEach(element => {
									element.applyTexture(texture, e2.shiftKey || Pressing.overrides.shift || [data.face])
								})
							}
							Undo.finishEdit('Apply texture')
						}
					} else if (isNodeUnderCursor(document.getElementById('texture_list'), e2)) {

						let index = Texture.all.length-1;
						let texture_node = findNodeUnderCursor('#texture_list li.texture', e2);
						let target_group_head = findNodeUnderCursor('#texture_list .texture_group_head', e2);
						let new_group = '';
						if (target_group_head) {
							new_group = target_group_head.parentNode.id;

						} else if (texture_node) {
							let target_tex = Texture.all.findInArray('uuid', texture_node.getAttribute('texid'));
							index = Texture.all.indexOf(target_tex);
							let own_index = Texture.all.indexOf(texture)
							if (own_index == index) return;
							let offset = e2.clientY - $(texture_node).offset().top;
							if (own_index < index) index--;
							if (offset > 24) index++;
							new_group = target_tex.group;
						}
						Undo.initEdit({texture_order: true, textures: texture.group != new_group ? [texture] : null});
						Texture.all.remove(texture);
						Texture.all.splice(index, 0, texture);
						texture.group = new_group;
						Canvas.updateLayeredTextures();
						Undo.finishEdit('Rearrange textures');

					} else if (outliner_target_node) {
						let uuid = outliner_target_node.id;
						let target = OutlinerNode.uuids[uuid];
						
						let array = [];
						if (target.type === 'group') {
							target.forEachChild((element) => {
								array.push(element);
							})
						} else {
							array = selected.includes(target) ? selected.slice() : [target];
						}
						array = array.filter(element => element.applyTexture);

						if (Format.per_group_texture) {
							let group = target.type === 'group' ? target : null;
							if (!group) group = target.parent;

							array = [];
							Undo.initEdit({group});
							group.texture = texture.uuid;
							group.forEachChild(child => {
								if (child.preview_controller?.updateFaces) child.preview_controller.updateFaces(child);
							})
						} else {
							Undo.initEdit({elements: array, uv_only: true})
							array.forEach(element => {
								element.applyTexture(texture, true);
							});
						}
						Undo.finishEdit('Apply texture');
						UVEditor.loadData();

					} else if (isNodeUnderCursor(document.getElementById('uv_viewport'), e2)) {
						UVEditor.applyTexture(texture);
					}
				}

				if (Blockbench.isTouch) {
					timeout = setTimeout(() => {
						active = true;
						move(e1);
					}, 320)
				}

				addEventListeners(document, 'mousemove touchmove', move, {passive: false});
				addEventListeners(document, 'mouseup touchend', off, {passive: false});
			},
			closeContextMenu() {
				if (Menu.open) Menu.open.hide();
			}
		},
		template: `
			<li
				v-bind:class="{ selected: texture.selected, multi_selected: texture.multi_selected, particle: texture.particle, use_as_default: texture.use_as_default}"
				v-bind:texid="texture.uuid"
				class="texture"
				@click.stop="closeContextMenu();texture.select($event)"
				@mousedown="highlightTexture($event)"
				@mouseup="unhighlightTexture($event)"
				@dblclick="texture.openMenu($event)"
				@mousedown.stop="dragTexture($event)" @touchstart.stop="dragTexture($event)"
				@contextmenu.prevent.stop="texture.showContextMenu($event)"
			>
				<i v-if="texture.getGroup()?.is_material" class="material-icons icon pbr_channel_icon">{{ pbr_channels[texture.pbr_channel].icon }}</i>
				<div class="texture_icon_wrapper">
					<img v-bind:texid="texture.id" v-bind:src="texture.source" class="texture_icon" width="48px" alt="" v-if="texture.show_icon" :style="{marginTop: getTextureIconOffset(texture)}" />
					<i class="material-icons texture_error" v-bind:title="texture.getErrorMessage()" v-if="texture.error">priority_high</i>
					<i class="texture_movie fa fa_big fa-film" title="Animated Texture" v-if="texture.frameCount > 1"></i>
				</div>
				<div class="texture_description_wrapper">
					<div class="texture_name">{{ texture.name }}</div>
					<div class="texture_res">{{ getDescription(texture) }}</div>
				</div>
				<i class="material-icons texture_multi_select_icon" v-if="texture.multi_selected">check</i>
				<template v-else>
					<i class="material-icons texture_particle_icon" v-if="texture.particle">bubble_chart</i>
					<i class="material-icons texture_particle_icon" v-if="texture.use_as_default">star</i>
					<i class="material-icons texture_visibility_icon clickable"
						v-bind:class="{icon_off: !texture.visible}"
						v-if="texture.render_mode == 'layered'"
						@click.stop="texture.toggleVisibility()"
						@dblclick.stop
					>
						{{ texture.visible ? 'visibility' : 'visibility_off' }}
					</i>
					<i class="material-icons texture_save_icon" v-bind:class="{clickable: !texture.saved}" @click.stop="texture.save()">
						<template v-if="texture.saved">check_circle</template>
						<template v-else>save</template>
					</i>
				</template>
			</li>
		`
	})

	new Panel('textures', {
		icon: 'fas.fa-images',
		growable: true,
		resizable: true,
		condition: {modes: ['edit', 'paint']},
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: [
			new Toolbar('texturelist', {
				children: [
					'import_texture',
					'create_texture',
					'create_texture_group',
					'append_to_template',
				]
			})
		],
		onResize() {
			this.inside_vue._data.currentFrame += 1;
			this.inside_vue._data.currentFrame -= 1;
		},
		component: {
			name: 'panel-textures',
			data() { return {
				textures: Texture.all,
				texture_groups: TextureGroup.all,
				currentFrame: 0,
			}},
			components: {'Texture': texture_component},
			methods: {
				openMenu(event) {
					Interface.Panels.textures.menu.show(event)
				},
				addTextureToGroup(texture_group) {
					BarItems.import_texture.click(0, texture_group);
				},
				slideTimelinePointer(e1) {
					let scope = this;
					if (!this.$refs.timeline) return;

					let timeline_offset = $(this.$refs.timeline).offset().left + 8;
					let timeline_width = this.$refs.timeline.clientWidth - 8;
					let maxFrameCount = this.maxFrameCount();

					function slide(e2) {
						convertTouchEvent(e2);
						let pos = e2.clientX - timeline_offset;

						let previous_frame = scope.currentFrame;
						scope.currentFrame = Math.clamp(Math.round((pos / timeline_width) * maxFrameCount), 0, maxFrameCount-1);
						if (previous_frame == scope.currentFrame) return;

						let textures = Texture.all.filter(tex => tex.frameCount > 1);
						Texture.all.forEach(tex => {
							tex.currentFrame = (scope.currentFrame % tex.frameCount) || 0;
						})
						UVEditor.previous_animation_frame = previous_frame;
						TextureAnimator.update(textures);
					}
					function off(e3) {
						removeEventListeners(document, 'mousemove touchmove', slide);
						removeEventListeners(document, 'mouseup touchend', off);
					}
					addEventListeners(document, 'mousemove touchmove', slide);
					addEventListeners(document, 'mouseup touchend', off);
					slide(e1);
				},
				scrollTimeline(event) {
					
					let slider_tex = [Texture.getDefault(), ...Texture.all].find(tex => tex && tex.frameCount > 1);
					if (!slider_tex) return;
					UVEditor.previous_animation_frame = slider_tex.currentFrame;
					let offset = Math.sign(event.deltaY);
					slider_tex.currentFrame = (slider_tex.currentFrame + slider_tex.frameCount + offset) % slider_tex.frameCount;

					let textures = Texture.all.filter(tex => tex.frameCount > 1);
					textures.forEach(tex => {
						tex.currentFrame = (slider_tex.currentFrame % tex.frameCount) || 0;
					})
					TextureAnimator.update(textures);
				},
				getPlayheadPos() {
					if (!this.$refs.timeline) return 0;
					let width = this.$refs.timeline.clientWidth - 8;
					return Math.clamp((this.currentFrame / this.maxFrameCount()) * width, 0, width);
				},
				maxFrameCount() {
					let count = 0;
					this.textures.forEach(tex => {
						if (tex.frameCount > count) count = tex.frameCount;
					});
					if (count == 1) return 0;
					return count;
				},
				unselect(event) {
					if (Blockbench.hasFlag('dragging_textures')) return;
					unselectTextures();
				},
				getUngroupedTextures() {
					return this.textures.filter(tex => !(tex.group && TextureGroup.all.find(g => g.uuid == tex.group)));
				},
				dragTextureGroup(texture_group, e1) {
					if (e1.button == 1) return;
					convertTouchEvent(e1);

					let active = false;
					let helper;
					let timeout;
					let last_event = e1;
					let texture_group_target_node;
					let order = 0;
	
					// scrolling
					let list = document.getElementById('texture_list');
					let list_offset = $(list).offset();
					let scrollInterval = function() {
						if (!active) return;
						if (mouse_pos.y < list_offset.top) {
							list.scrollTop += (mouse_pos.y - list_offset.top) / 7 - 3;
						} else if (mouse_pos.y > list_offset.top + list.clientHeight) {
							list.scrollTop += (mouse_pos.y - (list_offset.top + list.clientHeight)) / 6 + 3;
						}
					}
					let scrollIntervalID;
	
					function move(e2) {
						convertTouchEvent(e2);
						let offset = [
							e2.clientX - e1.clientX,
							e2.clientY - e1.clientY,
						]
						if (!active) {
							let distance = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2))
							if (Blockbench.isTouch) {
								if (distance > 20 && timeout) {
									clearTimeout(timeout);
									timeout = null;
								} else {
									document.getElementById('texture_list').scrollTop += last_event.clientY - e2.clientY;
								}
							} else if (distance > 6) {
								active = true;
							}
						}
						if (!active) return;
	
						if (e2) e2.preventDefault();
	
						if (open_menu) open_menu.hide();
	
						if (!helper) {
							helper = Interface.createElement('div', {class: 'texture_group_drag_helper'}, texture_group.name);
							document.body.append(helper);
							scrollIntervalID = setInterval(scrollInterval, 1000/60)
						}
						helper.style.left = `${e2.clientX}px`;
						helper.style.top = `${e2.clientY}px`;
	
						// drag
						$('.drag_hover').removeClass('drag_hover');
						$('.texture_group[order]').attr('order', null);
	
						let target = findNodeUnderCursor('#texture_list .texture_group', e2);
						if (target) {
							target.classList.add('drag_hover');
							let offset = e2.clientY - $(target).offset().top;
							order = offset > (target.clientHeight/2) ? 1 : -1;
							target.setAttribute('order', order.toString());
							texture_group_target_node = target;

						} else if (isNodeUnderCursor(document.querySelector('#texture_list'), e2)) {
							let nodes = document.querySelectorAll('#texture_list > li.texture_group');
							if (nodes.length) {
								let target = nodes[nodes.length-1];
								order = 1;
								target.setAttribute('order', '1');
								target.classList.add('drag_hover');
								texture_group_target_node = target;
							}
						}
						last_event = e2;
					}
					async function off(e2) {
						if (helper) helper.remove();
						clearInterval(scrollIntervalID);
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
						e2.stopPropagation();
	
						$('.drag_hover').removeClass('drag_hover');
						$('.texture_group[order]').attr('order', null);
						if (Blockbench.isTouch) clearTimeout(timeout);
	
						if (!active || Menu.open) return;
	
						if (texture_group_target_node) {
							let index = TextureGroup.all.length-1;
							let texture_group_target = TextureGroup.all.find(tg => tg.uuid == texture_group_target_node.id);
							if (texture_group_target) {
								index = TextureGroup.all.indexOf(texture_group_target)
								let own_index = TextureGroup.all.indexOf(texture_group)
								if (own_index == index) return;
								if (own_index < index) index--;
								if (order == 1) index++;
							}
							Undo.initEdit({texture_groups: [texture_group]});
							TextureGroup.all.remove(texture_group);
							TextureGroup.all.splice(index, 0, texture_group);
							Undo.finishEdit('Rearrange texture groups');
	
						}
					}
	
					if (Blockbench.isTouch) {
						timeout = setTimeout(() => {
							active = true;
							move(e1);
						}, 320)
					}
	
					addEventListeners(document, 'mousemove touchmove', move, {passive: false});
					addEventListeners(document, 'mouseup touchend', off, {passive: false});
				}
			},
			template: `
				<div>
					<ul id="texture_list" class="list mobile_scrollbar" @contextmenu.stop.prevent="openMenu($event)" @click.stop="unselect($event)">
						<li
							v-for="texture_group in texture_groups" :key="texture_group.uuid" :id="texture_group.uuid"
							class="texture_group"
						>
							<div class="texture_group_head" :class="{folded: texture_group.folded}"
								@dblclick.stop="texture_group.select()"
								@click.stop="texture_group.folded = !texture_group.folded"
								@contextmenu.prevent.stop="texture_group.showContextMenu($event)"
								@mousedown.stop="dragTextureGroup(texture_group, $event)" @touchstart.stop="dragTextureGroup(texture_group, $event)"
							>
								<i
									@click.stop="texture_group.folded = !texture_group.folded"
									class="icon-open-state fa"
									:class=\'{"fa-angle-right": texture_group.folded, "fa-angle-down": !texture_group.folded}\'
								></i>
								<div class="texture_group_material_icon" v-if="texture_group.is_material"></div>
								<label :title="texture_group.name">{{ texture_group.name }}</label>
								<ul class="texture_group_mini_icon_list" v-if="texture_group.folded">
									<li
										v-for="texture in texture_group.getTextures()"
										:key="texture.uuid"
										class="texture_mini_icon"
										:title="texture.name"
									>
										<img :src="texture.source" class="texture_icon" width="24px" height="24px" alt="" v-if="texture.show_icon" />
									</li>
								</ul>
								<div class="in_list_button" @click.stop="addTextureToGroup(texture_group)" v-if="!texture_group.folded">
									<i class="material-icons">add</i>
								</div>
							</div>
							<ul class="texture_group_list" v-if="!texture_group.folded">
								<li v-if="texture_group.is_material" class="texture_group_material_config"
									@dblclick="texture_group.material_config.propertiesDialog()"
									@contextmenu.prevent.stop="texture_group.material_config.showContextMenu($event)"
								>
									<i class="material-icons icon">tune</i>
									<label>{{ texture_group.material_config.getFileName() }}</label>
									<i class="material-icons texture_save_icon" v-bind:class="{clickable: !texture_group.material_config.saved}" @click.stop="texture_group.material_config.save()">
										<template v-if="texture_group.material_config.saved">check_circle</template>
										<template v-else>save</template>
									</i>
								</li>
								<Texture
									v-for="texture in texture_group.getTextures()"
									:key="texture.uuid"
									:texture="texture"
								></Texture>
							</ul>
						</li>
						<Texture
							v-for="texture in getUngroupedTextures()"
							:key="texture.uuid"
							:texture="texture"
						></Texture>
					</ul>
					<div id="texture_animation_playback" class="bar" v-show="maxFrameCount()">
						<div class="tool_wrapper"></div>
						<div id="texture_animation_timeline" ref="timeline" @mousedown="slideTimelinePointer" @wheel="scrollTimeline($event)">
							<div class="texture_animation_frame" v-for="i in maxFrameCount()"></div>
							<div id="animated_texture_playhead" :style="{left: getPlayheadPos() + 'px'}"></div>
						</div>
						<div class="tool_wrapper_2"></div>
					</div>
				</div>
			`,
			mounted() {
				BarItems.animated_textures.toElement('#texture_animation_playback .tool_wrapper')
				BarItems.animated_texture_frame.setWidth(52).toElement('#texture_animation_playback .tool_wrapper')
				BarItems.animated_texture_fps.toElement('#texture_animation_playback .tool_wrapper_2')
			}
		},
		menu: new Menu([
			new MenuSeparator('copypaste'),
			'paste',
			new MenuSeparator('file'),
			'import_texture',
			'create_texture',
			'change_textures_folder',
			'save_textures'
		])
	})
})
