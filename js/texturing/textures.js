
//Textures
class Texture {
	constructor(data, uuid) {
		var scope = this;
		//Info
		for (var key in Texture.properties) {
			Texture.properties[key].reset(this);
		}
		//meta
		this.source = ''
		this.selected = false
		this.show_icon = true
		this.error = 0;
		this.visible = true;
		this.display_canvas = false;
		//Data
		this.img = 0;
		this.width = 0;
		this.height = 0;
		this.currentFrame = 0;
		this.saved = true;

		this.mode = isApp ? 'link' : 'bitmap';
		this.uuid = uuid || guid()

		if (typeof data === 'object') {
			this.extend(data)
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

		//Setup Img/Mat
		this.canvas = document.createElement('canvas');
		this.canvas.width = this.canvas.height = 16;
		var img = this.img = new Image()
		img.src = 'assets/missing.png'

		var tex = new THREE.Texture(img)
		img.tex = tex;
		img.tex.magFilter = THREE.NearestFilter
		img.tex.minFilter = THREE.NearestFilter
		img.tex.name = this.name;

		var vertShader = `
			attribute float highlight;

			uniform bool SHADE;
			uniform int LIGHTSIDE;

			varying vec2 vUv;
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

			varying vec2 vUv;
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
			side: Canvas.getRenderSide(),
			transparent: true,
		});
		mat.map = tex;
		mat.name = this.name;
		Project.materials[this.uuid] = mat;

		var size_control = {};

		this.img.onload = function() {
			this.tex.needsUpdate = true;
			let dimensions_changed = scope.width !== img.naturalWidth || scope.height !== img.naturalHeight;
			scope.width = img.naturalWidth;
			scope.height = img.naturalHeight;

			if (scope.isDefault) {
				console.log('Successfully loaded '+scope.name+' from default pack')
			}

			let project = Texture.all.includes(scope) ? Project : ModelProject.all.find(project => project.textures.includes(scope));
			if(!project) return;
			project.whenNextOpen(() => {

				if (Project.box_uv && Format.single_texture && !scope.error) {

					if (!scope.keep_size) {
						let pw = Project.texture_width;
						let ph = Project.texture_height;
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
					Canvas.updateAllFaces(scope)
				}
				if (typeof scope.load_callback === 'function') {
					scope.load_callback(scope);
					delete scope.load_callback;
				}
			})
		}
		this.img.onerror = function(error) {
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
	}
	get frameCount() {
		if (Format.animated_textures && this.ratio !== 1 && this.ratio !== (Project.texture_width / Project.texture_height) && 1/this.ratio % 1 === 0) {
			return (Project.texture_width / Project.texture_height) / this.ratio
		}
	}
	get display_height() {
		return this.height / (this.frameCount || 1);
	}
	get ratio() {
		return this.width / this.height;
	}
	getErrorMessage() {
		switch (this.error) {
			case 0: return ''; break;
			case 1: return tl('texture.error.file'); break;
			//case 1: return tl('texture.error.invalid'); break;
			//case 2: return tl('texture.error.ratio'); break;
			case 3: return tl('texture.error.parent'); break;
		}
	}
	getUndoCopy(bitmap) {
		var copy = {}
		if (this.display_canvas && bitmap) {
			this.updateSource(this.canvas.toDataURL());
		}
		for (var key in Texture.properties) {
			Texture.properties[key].copy(this, copy)
		}
		copy.visible = this.visible;
		copy.selected = this.selected;
		copy.mode = this.mode;
		copy.saved = this.saved;
		copy.uuid = this.uuid;
		copy.old_width = this.old_width;
		copy.old_height = this.old_height;
		if (bitmap || this.mode === 'bitmap') {
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
		Merge.boolean(this, data, 'keep_size')
		if (this.mode === 'bitmap') {
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
			if ((this.folder + this.name).match(/[^a-z0-9._/\\-]/) && !Dialog.open && settings.dialog_invalid_characters.value) {
				Blockbench.showMessageBox({
					translateKey: 'invalid_characters',
					message: tl('message.invalid_characters.message', ['a-z0-9._-']),
					icon: 'folder_open',
					buttons: [tl('dialog.ok'), tl('dialog.dontshowagain')],
					confirm: 0,
					cancel: 0
				}, result => {
					if (result === 1) {
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
		if (duplicate && isApp) {
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
	fromDataURL(data_url) {
		this.source = data_url
		this.mode = 'bitmap'
		this.saved = false;
		this.load()
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
		this.display_canvas = false;
		this.updateMaterial();
		if (open_dialog == 'UVEditor') {
			for (var key in UVEditor.editors) {
				var editor = UVEditor.editors[key];
				if (this == editor.texture) {
					editor.img.src = dataUrl;
				}
			}
		}
		return this;
	}
	updateMaterial() {
		if (Format.image_editor) return this;
		let mat = this.getMaterial();
		mat.name = this.name;
		mat.map.image = this.img;
		mat.map.name = this.name;
		mat.map.image.src = this.source;
		mat.map.needsUpdate = true;
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
		if (this.mode === 'bitmap') {
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
		this.watcher = fs.watch(scope.path, (eventType) => {
			if (eventType == 'change') {
				if (timeout) clearTimeout(timeout)
				timeout = setTimeout(() => {
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
		if (isApp && this.watcher) {
			this.watcher.close()
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
			this.namespace = arr1[arr1.length-1];

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
					buttons: [tl('message.loose_texture.change'), tl('dialog.ok'), tl('dialog.dontshowagain')],
					confirm: 0,
					cancel: 1
				}, result => {
					if (result === 0) {
						this.reopen()
					}
					if (result === 2) {
						settings.dialog_loose_texture.set(false);
					}
				})
			}
		}
		return this;
	}
	getMaterial() {
		return Project.materials[this.uuid]
	}
	//Management
	select(event) {
		Texture.all.forEach(s => {
			if (s.selected) s.selected = false;
		})
		if (event) {
			Prop.active_panel = 'textures'
		}
		this.selected = true
		Texture.selected = this;
		this.scrollTo();
		if (Format.image_editor) {
			Project.texture_height = this.display_height;
			Project.texture_width = this.width;
		}
		if (this.render_mode == 'layered') {
			Canvas.updatePaintingGrid()
			updateSelection()
		} else if (Format.single_texture && Texture.all.length > 1) {
			Canvas.updateAllFaces()
			TickUpdates.selection = true;
		}
		if ((Texture.all.length > 1 || !Format.edit_mode) && Modes.paint && !UVEditor.getReferenceFace()) {
			UVEditor.vue.updateTexture();
		}
		return this;
	}
	add(undo) {
		var scope = this;
		if (isApp && this.path && Project.textures.length) {
			for (var tex of Project.textures) {
				if (tex.path === scope.path) return tex;
			}
		}
		if (Texture.all.find(t => t.render_mode == 'layered')) {
			this.render_mode = 'layered';
		}
		if (undo) {
			Undo.initEdit({textures: []})
		}
		if (!Project.textures.includes(this)) {
			Project.textures.push(this)
		}
		Blockbench.dispatchEvent( 'add_texture', {texture: this})
		loadTextureDraggable()

		if (Format.single_texture && Cube.all.length) {
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
		delete Project.materials[this.uuid];
		if (!no_update) {
			Canvas.updateAllFaces()
			TextureAnimator.updateButton()
			hideDialog()
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
		let affected = Outliner.selected.filter(el => el.faces);
		if (!affected.length) return;
		var scope = this;
		Undo.initEdit({elements: affected})

		affected.forEach(function(obj) {
			for (var face in obj.faces) {
				if (all || obj.box_uv || UVEditor.vue.selected_faces.includes(face)) {
					var f = obj.faces[face]
					if (all !== 'blank' || (f.texture !== null && !f.getTexture())) {
						f.texture = scope.uuid
					}
				}
			}
		})
		Canvas.updateView({elements: affected, element_aspects: {faces: true}})
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
		shell.showItemInFolder(this.path)
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
				electron.dialog.showMessageBoxSync(currentwindow, {
					type: 'info',
					noLink: true,
					title: tl('message.image_editor_missing.title'),
					message: tl('message.image_editor_missing.message'),
					detail: tl('message.image_editor_missing.detail')
				})
				selectImageEditorFile(scope)
			}
		}
		return this;
	}
	showContextMenu(event) {
		var scope = this;
		scope.select()
		Prop.active_panel = 'textures'
		this.menu.open(event, scope)
	}
	openMenu() {
		var scope = this
		scope.select()

		let title = `${scope.name} (${scope.width} x ${scope.height})`;
		let path = [];

		if (scope.path) {
			var arr = scope.path.split(osfs)
			arr.splice(-1);
			arr.forEach(dir => {
				path.push(dir);
				path.push(Interface.createElement('span', {class: 'slash'}, '/'));
			})
			path.push(Interface.createElement('span', {class: 'accent_color'}, scope.name));
		}
		let form = {
			name: 		{label: 'generic.name', value: scope.name},
			variable: 	{label: 'dialog.texture.variable', value: scope.id, condition: {features: ['texture_folder']}},
			folder: 	{label: 'dialog.texture.folder', value: scope.folder, condition: () => Format.texture_folder},
			namespace: 	{label: 'dialog.texture.namespace', value: scope.namespace, condition: {features: ['texture_folder']}},
		};
		if (Format.texture_mcmeta) {
			Object.assign(form, {
				'texture_mcmeta': '_',
				frame_time: {label: 'dialog.texture.frame_time', type: 'number', value: scope.frame_time, min: 1, step: 1, description: 'dialog.texture.frame_time.desc'},
				frame_interpolate: {label: 'dialog.texture.frame_interpolate', type: 'checkbox', value: scope.frame_interpolate, description: 'dialog.texture.frame_interpolate.desc'},
				frame_order_type: {label: 'dialog.texture.frame_order_type', type: 'select', value: scope.frame_order_type, options: {
					loop: 'dialog.texture.frame_order_type.loop',
					backwards: 'dialog.texture.frame_order_type.backwards',
					back_and_forth: 'dialog.texture.frame_order_type.back_and_forth',
					custom: 'dialog.texture.frame_order_type.custom',
				}},
				frame_order: {label: 'dialog.texture.frame_order', type: 'text', value: scope.frame_order, condition: form => form.frame_order_type == 'custom', placeholder: '0 3 1 2', description: 'dialog.texture.frame_order.desc'},
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
			onConfirm: function(results) {

				dialog.hide();
				if (['name', 'variable', 'folder', 'namespace', 'frame_time', 'frame_interpolate', 'frame_order_type', 'frame_order'].find(key => {
					return results[key] !== undefined && results[key] !== scope[key];
				}) == undefined) {
					return;
				}

				Undo.initEdit({textures: [scope], selected_texture: true})

				scope.name = results.name;
				if (results.variable !== undefined) scope.id = results.variable;
				if (results.folder !== undefined) scope.folder = results.folder;
				if (results.namespace !== undefined) scope.namespace = results.namespace;

				if (Format.texture_mcmeta) {
					if (['frame_time', 'frame_interpolate', 'frame_order_type', 'frame_order'].find(key => scope[key] !== results[key])) {
						scope.saved = false;
					}
					scope.frame_time = results.frame_time;
					scope.frame_interpolate = results.frame_interpolate;
					scope.frame_order_type = results.frame_order_type;
					scope.frame_order = results.frame_order;
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
				size: {
					label: 'dialog.project.texture_size',
					type: 'vector',
					dimensions: 2,
					value: [this.width, this.height],
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
				fill: {label: 'dialog.resize_texture.fill', type: 'select', default: 'transparent', options: {
					transparent: 'dialog.resize_texture.fill.transparent',
					color: 'dialog.resize_texture.fill.color',
					repeat: 'dialog.resize_texture.fill.repeat',
					stretch: 'dialog.resize_texture.fill.stretch'
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
				if (formResult.fill !== 'stretch' && Texture.length >= 2 && !Format.single_texture) {
					let elements = [...Cube.all, ...Mesh.all].filter(el => {
						for (let fkey in el.faces) {
							if (el.faces[fkey].texture == scope.uuid) return true;
						}
					})
					if (elements.length) elements_to_change = elements;
				}
				if (Format.animated_textures && formResult.frames > 1) {
					formResult.size[1] *= formResult.frames / (scope.frameCount || 1);
				}

				Undo.initEdit({
					textures: [scope],
					bitmap: true,
					elements: elements_to_change,
					uv_only: true
				})

				scope.edit((canvas) => {

					let new_canvas = document.createElement('canvas')
						new_canvas.width = formResult.size[0];
						new_canvas.height = formResult.size[1];
					let new_ctx = new_canvas.getContext('2d');
						new_ctx.imageSmoothingEnabled = false;

					switch (formResult.fill) {
						case 'transparent':
							new_ctx.drawImage(canvas, 0, 0, scope.width, scope.height);
							break;
						case 'color':
							new_ctx.fillStyle = ColorPanel.get();
							new_ctx.fillRect(0, 0, formResult.size[0], formResult.size[1])
							new_ctx.clearRect(0, 0, scope.width, scope.height)
							new_ctx.drawImage(canvas, 0, 0, scope.width, scope.height);
							break;
						case 'repeat':
							for (var x = 0; x < formResult.size[0]; x += scope.width) {		
								for (var y = 0; y < formResult.size[1]; y += scope.height) {
									new_ctx.drawImage(canvas, x, y, scope.width, scope.height);
								}
							}
							break;
						case 'stretch':
							new_ctx.drawImage(canvas, 0, 0, formResult.size[0], formResult.size[1]);
							break;
					}

					if (Painter.current && Painter.current.canvas) {
						delete Painter.current.canvas;
					}
					scope.keep_size = true;
					if (formResult.fill === 'repeat' && Format.animated_textures && formResult.size[0] < formResult.size[1]) {
						// Animated
					} else if (formResult.fill !== 'stretch' && (Format.single_texture || Texture.all.length == 1)) {
						Undo.current_save.uv_mode = {
							box_uv: Project.box_uv,
							width:  Project.texture_width,
							height: Project.texture_height
						}
						Undo.current_save.aspects.uv_mode = true;

						Project.texture_width = Project.texture_width * (formResult.size[0] / old_width);
						Project.texture_height = Project.texture_height * (formResult.size[1] / old_height);
						Canvas.updateAllUVs()

					} else if (formResult.fill !== 'stretch' && Texture.length >= 2 && elements_to_change) {
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
					return new_canvas

				}, {no_undo: true})

				Undo.finishEdit('Resize texture');

				setTimeout(updateSelection, 100);
			}
		})
		dialog.show()
		return this;
	}
	scrollTo() {
		var el = $(`#texture_list > li[texid=${this.uuid}]`)
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

			if (Project.texture_width != Project.texture_height) {
				animation.width = Project.texture_width;
				animation.height = Project.texture_height;
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
			if (scope.mode === 'link') {
				var image = nativeImage.createFromPath(scope.source.replace(/\?\d+$/, '')).toPNG()
			} else {
				var image = nativeImage.createFromDataURL(scope.source).toPNG()
			}
			tex_version++;

			function postSave(path) {
				if (Format.texture_mcmeta && scope.frameCount > 1) {
					let mcmeta_content = scope.getMCMetaContent();
					Blockbench.writeFile(path + '.mcmeta', {content: compileJSON(mcmeta_content)})
				}
			}

			if (!as && this.path && fs.existsSync(this.path)) {
				fs.writeFileSync(this.path, image);
				postSave(this.path);
				this.mode = 'link'
				this.saved = true;
				this.source = this.path.replace(/#/g, '%23') + '?' + tex_version

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
		
				let dataUrl = canvas.toDataURL('image/png');
		
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
	getBase64() {
		var scope = this;
		if (isApp && scope.mode === 'link') {
			var canvas = document.createElement('canvas')
			canvas.width = scope.img.naturalWidth;
			canvas.height = scope.img.naturalHeight;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(scope.img, 0, 0)
			var dataUrl = canvas.toDataURL('image/png')
		} else {
			var dataUrl = scope.source
		}
		return dataUrl.replace('data:image/png;base64,', '')
	}
	edit(cb, options) {
		var scope = this;
		if (!options) options = false;

		if (cb) {
			Painter.edit(scope, cb, options);

		} else if (scope.mode === 'link') {
			scope.source = 'data:image/png;base64,' + scope.getBase64();
			scope.mode = 'bitmap';
		}
		scope.saved = false;
	}
}
	Texture.prototype.menu = new Menu([
			{
				icon: 'crop_original',
				name: 'menu.texture.face', 
				condition() {return !Project.single_texture && Outliner.selected.length > 0},
				click(texture) {texture.apply()}
			},
			{
				icon: 'texture',
				name: 'menu.texture.blank', 
				condition() {return !Project.single_texture && Outliner.selected.length > 0},
				click(texture) {texture.apply('blank')}
			},
			{
				icon: 'fa-cube',
				name: 'menu.texture.elements',
				condition() {return !Project.single_texture && Outliner.selected.length > 0},
				click(texture) {texture.apply(true)}
			},
			{
				icon: 'bubble_chart',
				name: 'menu.texture.particle',
				condition: {features: ['select_texture_for_particles']},
				click(texture) {
					if (texture.particle) {
						texture.particle = false
					} else {
						texture.enableParticle()
					}
				}
			},
			'_',
			{
				icon: 'list',
				name: 'menu.texture.render_mode',
				children(texture) {
					function setViewMode(mode) {
						let update_layered = (mode == 'layered' || texture.render_mode == 'layered');
						let update_emissive = (mode == 'emissive' || texture.render_mode == 'emissive');
						let changed_textures = update_layered ? Texture.all : [texture];

						Undo.initEdit({textures: changed_textures});
						changed_textures.forEach(t =>  {
							t.render_mode = mode;
						});
						if (update_layered) {
							Texture.all.forEach((tex, i) => {
								tex.visible = i < 3
							})
							Interface.Panels.textures.inside_vue.$forceUpdate()
							Canvas.updateLayeredTextures();
						}
						if (update_emissive) {
							texture.getMaterial().uniforms.EMISSIVE.value = mode == 'emissive';
						}
						Undo.finishEdit('change texture view mode');
					}
					return [
						{name: 'menu.texture.render_mode.default', icon: texture.render_mode == 'default' ? 'radio_button_checked' : 'radio_button_unchecked', click() {setViewMode('default')}},
						{name: 'menu.texture.render_mode.emissive', icon: texture.render_mode == 'emissive' ? 'radio_button_checked' : 'radio_button_unchecked', click() {setViewMode('emissive')}},
						{name: 'menu.texture.render_mode.layered', icon: texture.render_mode == 'layered' ? 'radio_button_checked' : 'radio_button_unchecked', click() {setViewMode('layered')}, condition: () => Format.single_texture},
					]
				}
			},
			'resize_texture',
			'append_to_template',
			{
				name: 'menu.texture.merge_onto_texture',
				icon: 'fa-caret-square-up',
				condition: (tex) => (tex && Texture.all.indexOf(tex) !== 0),
				click(texture) {
					let target = Texture.all[Texture.all.indexOf(texture)-1];
					Undo.initEdit({textures: [target], bitmap: true});

					target.edit(canvas => {
						let ctx = canvas.getContext('2d');
						ctx.drawImage(texture.img, 0, 0);
					}, {no_undo: true})

					Undo.finishEdit('Merged textures')
				}
			},
			'_',
			{
				icon: 'edit',
				name: 'menu.texture.edit_externally',
				condition: (texture) => texture.mode == 'link',
				click(texture) { texture.openEditor() }
			},
			{
				icon: 'draw',
				name: 'menu.texture.edit_in_blockbench',
				condition: (texture) => !Format.image_editor && texture.path,
				click(texture) {
					let existing_tab = ModelProject.all.find(project => project.format.image_editor && project.textures.find(t => t.path && t.path == texture.path));
					if (existing_tab) {
						let tex2 = existing_tab.textures.find(t => t.path && t.path == texture.path);
						existing_tab.select();
						tex2.select();
						return;
					}
					let copy = texture.getUndoCopy();
					Codecs.image.load(copy, texture.path, [texture.naturalWidth, texture.naturalHeight]);
				}
			},
			{
				icon: 'tune',
				name: 'menu.texture.edit',
				condition: {modes: ['paint']},
				children: [
					'adjust_brightness_contrast',
					'adjust_saturation_hue',
					'adjust_opacity',
					'invert_colors',
					'adjust_curves',
					'_',
					'flip_texture_x',
					'flip_texture_y',
					'rotate_texture_cw',
					'rotate_texture_ccw'
				]
			},
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
			'_',
			{
				icon: 'refresh',
				name: 'menu.texture.refresh',
				condition: function(texture) {return texture.mode == 'link'},
				click(texture) {texture.reloadTexture()}
			},
			{
				icon: 'file_upload',
				name: 'menu.texture.change',
				click(texture) { texture.reopen()}
			},
			'delete',
			'_',
			{
				icon: 'list',
				name: 'menu.texture.properties',
				click(texture) { texture.openMenu()}
			}
	])
	Texture.getDefault = function() {
		if (Texture.selected && Texture.all.includes(Texture.selected)) {
			return Texture.selected;
		} else if (Texture.selected) {
			Texture.selected = undefined;
		}
		if (Texture.all.length > 1 && Texture.all.find(t => t.render_mode == 'layered')) {
			var i = 0;
			for (var i = Texture.all.length-1; i >= 0; i--) {
				if (Texture.all[i].visible) {
					return Texture.all[i]
				}
			}
		}
		return Texture.all[0]
	}
	new Property(Texture, 'string', 'path')
	new Property(Texture, 'string', 'name')
	new Property(Texture, 'string', 'folder')
	new Property(Texture, 'string', 'namespace')
	new Property(Texture, 'string', 'id')
	new Property(Texture, 'boolean', 'particle')
	new Property(Texture, 'string', 'render_mode', {default: 'default'})
	
	new Property(Texture, 'number', 'frame_time', {default: 1})
	new Property(Texture, 'string', 'frame_order_type', {default: 'loop'})
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
	Vue.nextTick(function() {
		setTimeout(function() {
			$('li.texture:not(.ui-draggable)').draggable({
				revertDuration: 0,
				cursorAt: { left: 2, top: -5 },
				revert: 'invalid',
				appendTo: 'body',
				zIndex: 19,
				distance: 12,
				delay: 120,
				helper: function(e) {
					var t = $(e.target)
					if (!t.hasClass('texture')) t = t.parent()
					if (!t.hasClass('texture')) t = t.parent()
					return t.find('.texture_icon_wrapper').clone().addClass('texture_drag_helper').attr('texid', t.attr('texid'))
				},
				drag: function(event, ui) {
					
					$('.outliner_node[order]').attr('order', null);
					$('.drag_hover').removeClass('drag_hover');
					$('.texture[order]').attr('order', null)
					if ($('#cubes_list li.outliner_node:hover').length) {
						var tar = $('#cubes_list li.outliner_node:hover').last()
						tar.addClass('drag_hover').attr('order', '0');
						/*
						var element = Outliner.root.findRecursive('uuid', tar.attr('id'))
						if (element) {
							tar.attr('order', '0')
						}*/
					} else if ($('#texture_list li:hover').length) {
						let node = $('#texture_list > .texture:hover')
						if (node.length) {
							var target_tex = Texture.all.findInArray('uuid', node.attr('texid'));
							index = Texture.all.indexOf(target_tex);
							let offset = event.clientY - node[0].offsetTop;
							if (offset > 24) {
								node.attr('order', '1')
							} else {
								node.attr('order', '-1')
							}
						}
					}
				},
				stop: function(event, ui) {
					setTimeout(function() {
						$('.texture[order]').attr('order', null);
						$('.outliner_node[order]').attr('order', null);
						var tex = Texture.all.findInArray('uuid', ui.helper.attr('texid'));
						if (!tex) return;
						if ($('.preview:hover').length > 0) {
							var data = Canvas.raycast(event)
							if (data.element && data.face) {
								var elements = data.element.selected ? UVEditor.getMappableElements() : [data.element];
								if (tex && elements) {
									Undo.initEdit({elements})
									elements.forEach(element => {
										element.applyTexture(tex, event.shiftKey || Pressing.overrides.shift || [data.face])
									})
									Undo.finishEdit('Apply texture')
								}
							}
						} else if ($('#texture_list:hover').length > 0) {
							let index = Texture.all.length-1
							let node = $('#texture_list > .texture:hover')
							if (node.length) {
								var target_tex = Texture.all.findInArray('uuid', node.attr('texid'));
								index = Texture.all.indexOf(target_tex);
								let own_index = Texture.all.indexOf(tex)
								if (own_index == index) return;
								if (own_index < index) index--;
								if (event.clientY - node[0].offsetTop > 24) index++;
							}
							Undo.initEdit({texture_order: true})
							Texture.all.remove(tex)
							Texture.all.splice(index, 0, tex)
							Canvas.updateLayeredTextures()
							Undo.finishEdit('Reorder textures')
						} else if ($('#cubes_list:hover').length) {

							var target_node = $('#cubes_list li.outliner_node.drag_hover').last().get(0);
							$('.drag_hover').removeClass('drag_hover');
							if (!target_node) return;
							let uuid = target_node.id;
							var target = OutlinerNode.uuids[uuid];

							var array = [];
		
							if (target.type === 'group') {
								target.forEachChild(function(cube) {
									array.push(cube)
								}, [Cube, Mesh])
							} else {
								array = selected.includes(target) ? selected : [target];
							}
							Undo.initEdit({elements: array, uv_only: true})
							array.forEach(function(cube) {
								for (var face in cube.faces) {
									cube.faces[face].texture = tex.uuid;
								}
							})
							Undo.finishEdit('Drop texture')
		
							UVEditor.loadData()
							Canvas.updateAllFaces()
						} else if ($('#uv_viewport:hover').length) {
							UVEditor.applyTexture(tex);
						}
					}, 10)
				}
			})
		}, 42)
	})
}
function unselectTextures() {
	Texture.all.forEach(function(s) {
		s.selected = false;
	})
	Texture.selected = undefined;
	Canvas.updateLayeredTextures()
}
function getTexturesById(id) {
	if (id === undefined) return;
	id = id.replace('#', '');
	return $.grep(Texture.all, function(e) {return e.id == id});
}
Clipbench.setTexture = function(texture) {
	//Sets the raw image of the texture
	if (!isApp) return;

	Clipbench.texture = texture.getUndoCopy();
	delete Clipbench.texture.path;
	Clipbench.texture.mode = 'bitmap';
	Clipbench.texture.saved = false;
	Clipbench.texture.source = 'data:image/png;base64,'+texture.getBase64();

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
		var texture = new Texture({name: 'pasted', folder: 'block' }).fromDataURL(dataUrl).fillParticle().add(true);
		setTimeout(function() {
			texture.openMenu();
		}, 40)
	}

	if (Clipbench.texture) {
		var texture = new Texture(Clipbench.texture).fillParticle().load().add(true);
		setTimeout(function() {
			texture.openMenu();
		}, 40)
		Clipbench.texture = null;

	} else if (isApp) {
		var image = clipboard.readImage().toDataURL();
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

TextureAnimator = {
	isPlaying: false,
	interval: false,
	frame_total: 0,
	start() {
		clearInterval(TextureAnimator.interval)
		TextureAnimator.isPlaying = true
		TextureAnimator.frame_total = 0;
		TextureAnimator.updateButton()
		let frametime = 1000/settings.texture_fps.value;
		if (Format.texture_mcmeta && Texture.getDefault()) {
			let tex = Texture.getDefault();
			frametime = Math.max(tex.frame_time, 1) * 50;
		}
		TextureAnimator.interval = setInterval(TextureAnimator.nextFrame, frametime)
	},
	stop() {
		TextureAnimator.isPlaying = false
		clearInterval(TextureAnimator.interval)
		TextureAnimator.updateButton()
	},
	toggle() {
		if (TextureAnimator.isPlaying) {
			TextureAnimator.stop()
		} else {
			TextureAnimator.start()
		}
	},
	updateSpeed() {
		if (TextureAnimator.isPlaying) {
			TextureAnimator.stop()
			TextureAnimator.start()
		}
	},
	nextFrame() {
		var animated_textures = []
		TextureAnimator.frame_total++;
		Texture.all.forEach(tex => {
			if (tex.frameCount > 1) {
				let custom_indices = Format.texture_mcmeta && tex.getAnimationFrameIndices();
				if (custom_indices) {
					let index = custom_indices[TextureAnimator.frame_total % custom_indices.length];
					tex.currentFrame = index;

				} else {
					if (tex.currentFrame >= tex.frameCount-1) {
						tex.currentFrame = 0
					} else {
						tex.currentFrame++;
					}
				}
				animated_textures.push(tex)
			}
		})
		TextureAnimator.update(animated_textures);
	},
	update(animated_textures) {
		let maxFrame = 0;
		animated_textures.forEach(tex => {
			maxFrame = Math.max(maxFrame, tex.currentFrame);
		})
		Cube.all.forEach(cube => {
			var update = false
			for (var face in cube.faces) {
				update = update || animated_textures.includes(cube.faces[face].getTexture());
			}
			if (update) {
				Canvas.updateUV(cube, true)
			}
		})
		BarItems.animated_texture_frame.update();
		Interface.Panels.textures.inside_vue._data.currentFrame = maxFrame;
	},
	reset() {
		TextureAnimator.stop();
		Texture.all.forEach(function(tex, i) {
			if (tex.frameCount) {
				tex.currentFrame = 0;
			} 
		})
		UVEditor.img.style.objectPosition = '';
		while (i < elements.length) {
			Canvas.updateUV(elements[i], true)
			i++;
		}
	},
	updateButton() {
		BarItems.animated_textures.setIcon( TextureAnimator.isPlaying ? 'pause' : 'play_arrow' )
	}
}

BARS.defineActions(function() {
	new Action('import_texture', {
		icon: 'library_add',
		category: 'textures',
		keybind: new Keybind({key: 't', ctrl: true}),
		click() {
			var start_path;
			if (!isApp) {} else
			if (Texture.all.length > 0) {
				var arr = Texture.all[0].path.split(osfs)
				arr.splice(-1)
				start_path = arr.join(osfs)
			} else if (Project.export_path) {
				var arr = Project.export_path.split(osfs)
				arr.splice(-3)
				arr.push('textures')
				start_path = arr.join(osfs)
			}
			Blockbench.import({
				resource_id: 'texture',
				readtype: 'image',
				type: 'PNG Texture',
				extensions: ['png', 'tga'],
				multiple: true,
				startpath: start_path
			}, function(results) {
				var new_textures = []
				Undo.initEdit({textures: new_textures})
				results.forEach(function(f) {
					var t = new Texture({name: f.name}).fromFile(f).add(false).fillParticle()
					new_textures.push(t)
				})
				Undo.finishEdit('Add texture')
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

	function textureAnimationCondition() {
		return Format.animated_textures && Texture.all.find(tex => tex.frameCount > 1);
	}
	new Action('animated_textures', {
		icon: 'play_arrow',
		category: 'textures',
		condition: textureAnimationCondition,
		click() {
			TextureAnimator.toggle()
		}
	})
	function getSliderTexture() {
		return [Texture.getDefault(), ...Texture.all].find(tex => tex && tex.frameCount > 1);
	}
	new NumSlider('animated_texture_frame', {
		category: 'textures',
		condition: textureAnimationCondition,
		getInterval(event) {
			return 1;
		},
		get: function() {
			let tex = getSliderTexture()
			return tex ? tex.currentFrame+1 : 0;
		},
		change: function(modify) {
			let slider_tex = getSliderTexture()
			if (!slider_tex) return;
			slider_tex.currentFrame = (modify(slider_tex.currentFrame + slider_tex.frameCount) % slider_tex.frameCount) || 0;

			let textures = Texture.all.filter(tex => tex.frameCount > 1);
			Texture.all.forEach(tex => {
				tex.currentFrame = (slider_tex.currentFrame % tex.frameCount) || 0;
			})
			TextureAnimator.update(textures);
		}
	})
	new Action('animated_texture_fps', {
		name: 'settings.texture_fps',
		description: 'settings.texture_fps.desc',
		icon: 'speed',
		category: 'textures',
		condition: textureAnimationCondition,
		click() {
			if (Format.texture_mcmeta && Texture.all.length) {
				Texture.getDefault().openMenu()
				$('dialog div.form_bar_frame_time input').trigger('focus');
			} else {
				settings.texture_fps.trigger();
			}
		}
	})
})

Interface.definePanels(function() {

	new Panel('textures', {
		icon: 'fas.fa-images',
		growable: true,
		condition: {modes: ['edit', 'paint']},
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: {
			head: Toolbars.texturelist
		},
		onResize() {
			this.inside_vue._data.currentFrame += 1;
			this.inside_vue._data.currentFrame -= 1;
		},
		component: {
			name: 'panel-textures',
			data() { return {
				textures: Texture.all,
				currentFrame: 0,
			}},
			methods: {
				openMenu(event) {
					Interface.Panels.textures.menu.show(event)
				},
				getDescription(texture) {
					if (texture.error) {
						return texture.getErrorMessage()
					} else {
						let message = texture.width + ' x ' + texture.height + 'px';
						if (texture.frameCount > 1) {
							message += ` - ${texture.currentFrame+1}/${texture.frameCount}`
						}
						return message;
					}
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

						scope.currentFrame = Math.clamp(Math.round((pos / timeline_width) * maxFrameCount), 0, maxFrameCount-1);

						let textures = Texture.all.filter(tex => tex.frameCount > 1);
						Texture.all.forEach(tex => {
							tex.currentFrame = (scope.currentFrame % tex.frameCount) || 0;
						})
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
					return count;
				},
				getTextureIconOffset(texture) {
					if (!texture.currentFrame) return;
					let val = texture.currentFrame * -48 * (texture.display_height / texture.width);
					return `${val}px`;
				}
			},
			template: `
				<div>
					<ul id="texture_list" class="list mobile_scrollbar" @contextmenu.stop.prevent="openMenu($event)">
						<li
							v-for="texture in textures"
							v-bind:class="{ selected: texture.selected, particle: texture.particle}"
							v-bind:texid="texture.uuid"
							:key="texture.uuid"
							class="texture"
							v-on:click.stop="texture.select($event)"
							v-on:dblclick="texture.openMenu($event)"
							@contextmenu.prevent.stop="texture.showContextMenu($event)"
						>
							<div class="texture_icon_wrapper">
								<img v-bind:texid="texture.id" v-bind:src="texture.source" class="texture_icon" width="48px" alt="" v-if="texture.show_icon" :style="{marginTop: getTextureIconOffset(texture)}" />
								<i class="material-icons texture_error" v-bind:title="texture.getErrorMessage()" v-if="texture.error">error_outline</i>
								<i class="texture_movie fa fa_big fa-film" title="Animated Texture" v-if="texture.frameCount > 1"></i>
							</div>
							<div class="texture_description_wrapper">
								<div class="texture_name">{{ texture.name }}</div>
								<div class="texture_res">{{ getDescription(texture) }}</div>
							</div>
							<i class="material-icons texture_particle_icon" v-if="texture.particle">bubble_chart</i>
							<i class="material-icons texture_visibility_icon clickable"
								v-bind:class="{icon_off: !texture.visible}"
								v-if="texture.render_mode == 'layered'"
								@click.stop="texture.toggleVisibility()"
								@dblclick.stop
							>
								{{ texture.visible ? 'visibility' : 'visibility_off' }}
							</i>
							<i class="material-icons texture_save_icon" v-bind:class="{clickable: !texture.saved}" @click="texture.save()">
								<template v-if="texture.saved">check_circle</template>
								<template v-else>save</template>
							</i>
						</li>
					</ul>
					<div id="texture_animation_playback" class="bar" v-show="maxFrameCount()">
						<div class="tool_wrapper"></div>
						<div id="texture_animation_timeline" ref="timeline" @mousedown="slideTimelinePointer">
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
			'paste',
			'import_texture',
			'create_texture',
			'change_textures_folder',
			'save_textures'
		])
	})
})
