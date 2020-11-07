const textures = [];
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
			var i = textures.length;
			while (true) {
				var c = 0
				var duplicates = false;
				while (c < textures.length) {
					if (textures[c].id == i) {
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
		var img = this.img = new Image()
		img.src = 'assets/missing.png'

		var tex = new THREE.Texture(img)
		img.tex = tex;
		img.tex.magFilter = THREE.NearestFilter
		img.tex.minFilter = THREE.NearestFilter
		img.tex.name = this.name;

		var mat = new THREE.MeshLambertMaterial({
			color: 0xffffff,
			side: Canvas.getRenderSide(),
			vertexColors: THREE.FaceColors,
			map: tex,
			transparent: true,
			alphaTest: 0.05
		});
		mat.name = this.name;
		Canvas.materials[this.uuid] = mat;

		var size_control = {};

		this.img.onload = function() {
			if (!this.src) return;
			this.tex.needsUpdate = true;
			scope.width = img.naturalWidth;
			scope.height = img.naturalHeight;

			if (scope.isDefault) {
				console.log('Successfully loaded '+scope.name+' from default pack')
			}

			//Width / Animation
			if (img.naturalWidth !== img.naturalHeight && Format.id == 'java_block') {
				BARS.updateConditions()
			}

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
									main_uv.loadData()
								}
							}
						})
					}
				}
				delete scope.keep_size;
				size_control.old_width = img.naturalWidth
				size_control.old_height = img.naturalHeight
			}

			TextureAnimator.updateButton()
			Canvas.updateAllFaces(scope)
			if (typeof scope.load_callback === 'function') {
				scope.load_callback(scope);
				delete scope.load_callback;
			}
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
			return 1/this.ratio
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
		}
		path_array.push('textures', link.replace(/\//g, osfs))
		var path = path_array.join(osfs)+'.png'
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
		this.saved = true
		if (path.includes('data:image')) {
			this.source = path
		} else {
			this.source = path.replace(/#/g, '%23') + '?' + tex_version
		}
		this.generateFolder(path)
		this.startWatcher()
		Painter.current = {}
		
		if (EditSession.active) {
			this.load(() => {
				var before = {textures: {}}
				before.textures[scope.uuid] = true;
				this.edit()
				var post = new Undo.save({textures: [this]})
				EditSession.sendEdit({
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
			if (Format.single_texture) {
				var path = BedrockEntityManager.findEntityTexture(Project.geometry_name, 'raw')
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
		if (this == main_uv.texture) {
			main_uv.img.src = dataUrl;
		};
		if (open_dialog == 'uv_dialog') {
			for (var key in uv_dialog.editors) {
				var editor = uv_dialog.editors[key];
				if (this == editor.texture) {
					editor.img.src = dataUrl;
				}
			}
		}
		return this;
	}
	updateMaterial() {
		var scope = this;
		
		Canvas.materials[scope.uuid].name = this.name;
		Canvas.materials[scope.uuid].map.name = scope.name;
		Canvas.materials[scope.uuid].map.image.src = scope.source;
		Canvas.materials[scope.uuid].map.needsUpdate = true;

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
			main_uv.loadData();
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
		TickUpdates.main_uv = true;
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
					scope.reloadTexture();
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
		var scope = this
		if (path.includes(osfs+'textures'+osfs)) {
			var arr = path.split(osfs+'textures'+osfs)

			var arr1 = arr[0].split(osfs)
			scope.namespace = arr1[arr1.length-1]

			var arr2 = arr[arr.length-1].split(osfs)
			arr2.pop()
			scope.folder = arr2.join('/')
		} else {
			var arr = path.split(osfs)
			scope.folder = arr[arr.length-2]
			if (Format.id === 'java_block' && isApp) {
				Blockbench.showMessageBox({
					translateKey: 'loose_texture',
					icon: 'folder_open',
					buttons: [tl('message.loose_texture.change'), tl('dialog.ok')],
					confirm: 0,
					cancel: 1
				}, function(result) {
					if (result === 0) {
						scope.reopen()
					}
				})
			}
		}
		return this;
	}
	getMaterial() {
		return Canvas.materials[this.uuid]
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
		if (Project.layered_textures) {
			Canvas.updatePaintingGrid()
		} else if (Format.single_texture && Texture.all.length > 1) {
			Canvas.updateAllFaces()
			TickUpdates.selection = true;
		}
		return this;
	}
	add(undo) {
		var scope = this;
		if (isApp && this.path && textures.length) {
			for (var tex of textures) {
				if (tex.path === scope.path) return tex;
			}
		}
		if (undo) {
			Undo.initEdit({textures: []})
		}
		if (!textures.includes(this)) {
			textures.push(this)
		}
		Blockbench.dispatchEvent( 'add_texture', {texture: this})
		loadTextureDraggable()

		if (Format.single_texture && Cube.all.length) {
			Canvas.updateAllFaces()
			if (selected.length) {
				main_uv.loadData()
			}
		}
		TickUpdates.selection = true;
		
		if (undo) {
			Undo.finishEdit('add_texture', {textures: [this]})
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
		textures.splice(textures.indexOf(this), 1)
		if (!no_update) {
			Canvas.updateAllFaces()
			TextureAnimator.updateButton()
			hideDialog()
			if (main_uv.texture == this) {
				main_uv.displayTexture();
			}
			BARS.updateConditions()
			Undo.finishEdit('remove_textures', {textures: []})
		}
	}
	toggleVisibility() {
		if (!Project.layered_textures) {
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
		textures.forEach(function(s) {
			s.particle = false;
		})
		if (Format.id == 'java_block') {
			this.particle = true
		}
		return this;
	}
	fillParticle() {
		var particle_tex = false
		textures.forEach(function(t) {
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
		if (Cube.selected.length === 0) return;
		var scope = this;
		Undo.initEdit({elements: Cube.selected})

		Cube.selected.forEach(function(obj) {
			for (var face in obj.faces) {
				if (all || Project.box_uv || face === main_uv.face) {
					var f = obj.faces[face]
					if (all !== 'blank' || (f.texture !== null && !f.getTexture())) {
						f.texture = scope.uuid
					}
				}
			}
		})
		Canvas.updateSelectedFaces()
		main_uv.loadData()
		Undo.finishEdit('applied_texture')
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
				var answer = ElecDialogs.showMessageBox(currentwindow, {
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
		this.menu.open(event, scope)
	}
	openMenu() {
		var scope = this
		scope.select()

		let title = `${scope.name} (${scope.width} x ${scope.height})`;
		var path = '';

		if (scope.path) {
			var arr = scope.path.split(osfs)
			arr.splice(-1)
			path = arr.join('<span class="slash">/</span>') + '<span class="slash">/</span><span class="accent_color">' + scope.name + '</span>'
		}

		var dialog = new Dialog({
			id: 'texture_edit',
			title,
			lines: [
				`<div style="height: 140px;">
					<div id="texture_menu_thumbnail">${scope.img.outerHTML}</div>
					<p class="multiline_text" id="te_path">${settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : path}</p>
				</div>`
			],
			form: {
				name: 		{label: 'generic.name', value: scope.name},
				variable: 	{label: 'dialog.texture.variable', value: scope.id, condition: () => Format.id === 'java_block'},
				folder: 	{label: 'dialog.texture.folder', value: scope.folder, condition: () => Format.id === 'java_block'},
				namespace: 	{label: 'dialog.texture.namespace', value: scope.namespace, condition: () => Format.id === 'java_block'},
			},
			onConfirm: function(results) {

				dialog.hide();
				if (
					(scope.name === results.name) &&
					(results.variable === undefined || scope.id === results.variable) &&
					(results.folder === undefined || scope.folder === results.folder) &&
					(results.namespace === undefined || scope.namespace === results.namespace)
				) {
					return;
				}

				Undo.initEdit({textures: [scope], selected_texture: true})

				scope.name = results.name;
				if (results.variable !== undefined) scope.id = results.variable;
				if (results.folder !== undefined) scope.folder = results.folder;
				if (results.namespace !== undefined) scope.namespace = results.namespace;
				

				Undo.finishEdit('texture_edit')
			}
		}).show()
	}
	resizeDialog() {
		let scope = this;
		let dialog = new Dialog({
			id: 'resize_texture',
			title: 'menu.texture.resize',
			form: {
				width: {
					label: 'dialog.project.width',
					type: 'number',
					value: this.width,
					min: 1
				},
				height: {
					label: 'dialog.project.height',
					type: 'number',
					value: this.height,
					min: 1
				},
				fill: {label: 'dialog.resize_texture.fill', type: 'select', default: 'transparent', options: {
					transparent: 'dialog.resize_texture.fill.transparent',
					color: 'dialog.resize_texture.fill.color',
					repeat: 'dialog.resize_texture.fill.repeat',
					stretch: 'dialog.resize_texture.fill.stretch'
				}}
				/*
				width
				height
				fill
					transparent
					color
					repeat
					stretch
				*/
			},
			onConfirm: function(formResult) {

				let old_width = scope.width;
				let old_height = scope.height;

				scope.edit((canvas) => {

					let new_canvas = document.createElement('canvas')
						new_canvas.width = formResult.width;
						new_canvas.height = formResult.height;
					let new_ctx = new_canvas.getContext('2d')
						new_ctx.imageSmoothingEnabled = false;

					switch (formResult.fill) {
						case 'transparent':
							new_ctx.drawImage(canvas, 0, 0, scope.width, scope.height);
							break;
						case 'color':
							new_ctx.fillStyle = ColorPanel.get();
							new_ctx.fillRect(0, 0, formResult.width, formResult.height)
							new_ctx.clearRect(0, 0, scope.width, scope.height)
							new_ctx.drawImage(canvas, 0, 0, scope.width, scope.height);
							break;
						case 'repeat':
							for (var x = 0; x < formResult.width; x += scope.width) {		
								for (var y = 0; y < formResult.height; y += scope.height) {
									new_ctx.drawImage(canvas, x, y, scope.width, scope.height);
								}
							}
							break;
						case 'stretch':
							new_ctx.drawImage(canvas, 0, 0, formResult.width, formResult.height);
							break;
					}

					if (Painter.current && Painter.current.canvas) {
						delete Painter.current.canvas;
					}
					scope.keep_size = true;
					if (formResult.fill !== 'stretch' && (Format.single_texture || Texture.all.length == 1)) {
						Undo.current_save.uv_mode = {
							box_uv: Project.box_uv,
							width:  Project.texture_width,
							height: Project.texture_height
						}
						Undo.current_save.aspects.uv_mode = true;

						Project.texture_width = Project.texture_width * (formResult.width / old_width);
						Project.texture_height = Project.texture_height * (formResult.height / old_height);
						Canvas.updateAllUVs()
					}
					return new_canvas

				})
				setTimeout(updateSelection, 100);

				dialog.hide()
			}
		})
		dialog.show()
		return this;
	}
	scrollTo() {
		var el = $(`#texture_list > li[texid=${this.uuid}]`)
		if (el.length === 0 || textures.length < 2) return;

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
			if (!as && this.path && fs.existsSync(this.path)) {
				fs.writeFile(this.path, image, function (err) {
					scope.fromPath(scope.path)
				})
			} else {
				var find_path;
				if (Format.bone_rig && Project.geometry_name) {
					find_path = BedrockEntityManager.findEntityTexture(Project.geometry_name, true)
				}
				if (!find_path && ModelMeta.export_path) {
					var arr = ModelMeta.export_path.split(osfs);
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
		return this;
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
				condition() {return !Project.single_texture && selected.length > 0},
				click: function(texture) {texture.apply()}
			},
			{
				icon: 'texture',
				name: 'menu.texture.blank', 
				condition() {return !Project.single_texture && selected.length > 0},
				click: function(texture) {texture.apply('blank')}
			},
			{
				icon: 'fa-cube',
				name: 'menu.texture.cube',
				condition() {return !Project.single_texture && selected.length > 0},
				click: function(texture) {texture.apply(true)}
			},
			{
				icon: 'bubble_chart',
				name: 'menu.texture.particle',
				condition: function() {return Format.id == 'java_block'},
				click: function(texture) {
					if (texture.particle) {
						texture.particle = false
					} else {
						texture.enableParticle()
					}
				}
			},
			'_',
			{
				icon: 'photo_size_select_large',
				name: 'menu.texture.resize',
				click(texture) {texture.resizeDialog()}
			},
			'_',
			{
				icon: 'edit',
				name: 'menu.texture.edit',
				condition: function(texture) {return texture.mode == 'link'},
				click: function(texture) { texture.openEditor()}
			},
			{
				icon: 'folder',
				name: 'menu.texture.folder',
				condition: function(texture) {return isApp && texture.path},
				click: function(texture) {texture.openFolder()}
			},
			{
				icon: 'save',
				name: 'menu.texture.save',
				condition: function(texture) {return !texture.saved && texture.path},
				click: function(texture) {texture.save()}
			},
			{
				icon: 'file_download',
				name: 'menu.texture.export',
				click: function(texture) {texture.save(true)}
			},
			'_',
			{
				icon: 'refresh',
				name: 'menu.texture.refresh',
				condition: function(texture) {return texture.mode == 'link'},
				click: function(texture) {texture.reloadTexture()}
			},
			{
				icon: 'file_upload',
				name: 'menu.texture.change',
				click: function(texture) { texture.reopen()}
			},
			{
				icon: 'delete',
				name: 'generic.delete',
				click: function(texture) {
					Undo.initEdit({textures: [texture], selected_texture: true, bitmap: true})
					texture.remove()
					Undo.finishEdit('delete texture', {textures: [], selected_texture: true, bitmap: true})
			}},
			'_',
			{
				icon: 'list',
				name: 'menu.texture.properties',
				click: function(texture) { texture.openMenu()}
			}
	])
	Texture.all = textures;
	Texture.getDefault = function() {
		if (Texture.selected && Texture.all.includes(Texture.selected)) {
			return Texture.selected;
		} else if (Texture.selected) {
			Texture.selected = undefined;
		}
		if (Project.layered_textures && Texture.all.length > 1) {
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


function saveTextures(lazy = false) {
	textures.forEach(function(tex) {
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
					
					$('.outliner_node[order]').attr('order', null)
					$('.texture[order]').attr('order', null)
					if ($('#cubes_list.drag_hover').length === 0 && $('#cubes_list li .drag_hover.outliner_node').length) {
						var tar = $('#cubes_list li .drag_hover.outliner_node').last()
						var element = Outliner.root.findRecursive('uuid', tar.attr('id'))
						if (element) {
							tar.attr('order', '0')
						}
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
						$('.texture[order]').attr('order', null)
						var tex = textures.findInArray('uuid', ui.helper.attr('texid'));
						if (!tex) return;
						if ($('.preview:hover').length > 0) {
							var data = Canvas.raycast(event)
							if (data.cube && data.face) {
								var cubes_list = data.cube.selected ? Cube.selected : [data.cube];
								if (tex && cubes_list) {
									Undo.initEdit({elements: cubes_list})
									cubes_list.forEach(cube => {
										if (cube instanceof Cube) {
											cube.applyTexture(tex, data.shiftKey || [data.face])
										}
									})
									Undo.finishEdit('apply texture')
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
							Undo.finishEdit('reorder textures')
						}
					}, 10)
				}
			})
		}, 42)
	})
}
function unselectTextures() {
	textures.forEach(function(s) {
		s.selected = false;
	})
	Texture.selected = undefined;
	Canvas.updateLayeredTextures()
}
function getTexturesById(id) {
	if (id === undefined) return;
	id = id.replace('#', '');
	return $.grep(textures, function(e) {return e.id == id});
}
Clipbench.setTexture = function(texture) {
	//Sets the raw image of the texture
	if (!isApp) return;

	if (texture.mode === 'bitmap') {
		var img = nativeImage.createFromDataURL(texture.source)
	} else {
		var img = nativeImage.createFromPath(texture.source.split('?')[0])
	}
	clipboard.writeImage(img)
}
Clipbench.pasteTextures = function() {
	if (!isApp) return;
	var img = clipboard.readImage()
	if (img) {
		var dataUrl = img.toDataURL()
		var texture = new Texture({name: 'pasted', folder: 'block' }).fromDataURL(dataUrl).fillParticle().add(true)
		setTimeout(function() {
			texture.openMenu()
		}, 40)
	}
}

Object.defineProperty(textures, selected, {
	get() {
		console.warn('textures.selected is deprecated. Please use Texture.selected instead.')
		return Texture.selected;
	},
	set(tex) {
		console.warn('textures.selected is deprecated. Please use Texture.selected instead.')
		Texture.selected = tex;
	}
})

TextureAnimator = {
	isPlaying: false,
	interval: false,
	start() {
		clearInterval(TextureAnimator.interval)
		TextureAnimator.isPlaying = true
		TextureAnimator.updateButton()
		TextureAnimator.interval = setInterval(TextureAnimator.nextFrame, 1000/settings.texture_fps.value)
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
		var animated_tex = []
		textures.forEach(function(tex, i) {
			if (tex.frameCount > 1) {
				if (tex.currentFrame >= tex.frameCount-1) {
					tex.currentFrame = 0
				} else {
					tex.currentFrame++;
				}
				$($('.texture').get(i)).find('img').css('margin-top', (tex.currentFrame*-48)+'px')
				animated_tex.push(tex)
			}
		})
		if (animated_tex.includes(main_uv.texture)) {
			main_uv.img.style.objectPosition = `0 -${main_uv.texture.currentFrame * main_uv.inner_height}px`;
		}
		Cube.all.forEach(function(cube) {
			var update = false
			for (var face in cube.faces) {
				update = update || animated_tex.includes(cube.faces[face].getTexture());
			}
			if (update) {
				Canvas.updateUV(cube, true)
			}
		})
	},
	reset() {
		TextureAnimator.stop();
		textures.forEach(function(tex, i) {
			if (tex.frameCount) {
				tex.currentFrame = 0
				$($('.texture').get(i)).find('img').css('margin-top', '0')
			} 
		})
		main_uv.img.style.objectPosition = '';
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
		keybind: new Keybind({key: 84, ctrl: true}),
		click: function () {
			var start_path;
			if (!isApp) {} else
			if (textures.length > 0) {
				var arr = textures[0].path.split(osfs)
				arr.splice(-1)
				start_path = arr.join(osfs)
			} else if (ModelMeta.export_path) {
				var arr = ModelMeta.export_path.split(osfs)
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
				Undo.finishEdit('add_texture')
			})
		}
	})
	new Action('create_texture', {
		icon: 'icon-create_bitmap',
		category: 'textures',
		keybind: new Keybind({key: 84, ctrl: true, shift: true}),
		click: function () {
			TextureGenerator.addBitmapDialog()
		}
	})
	new Action('save_textures', {
		icon: 'save',
		category: 'textures',
		click: function () {saveTextures()}
	})
	new Action('change_textures_folder', {
		icon: 'fas.fa-hdd',
		category: 'textures',
		condition: () => textures.length > 0,
		click: function () {
			var path = undefined;
			var i = 0;
			while (i < textures.length && path === undefined) {
				if (typeof textures[i].path == 'string' && textures[i].path.length > 8) {
					path = textures[i].path
				}
				i++;
			}
			if (!path) {return;}

			var path = path.split(osfs)
			path.splice(-1)
			path = path.join(osfs)

			ElecDialogs.showOpenDialog(currentwindow, {
				properties: ['openDirectory'],
				defaultPath: path
			}, function(filePaths) {
				if (filePaths && filePaths.length) {
					var new_path = filePaths[0]
					Undo.initEdit({textures})
					textures.forEach(function(t) {
						if (typeof t.path === 'string' && t.path.includes(path)) {
							t.fromPath(t.path.replace(path, new_path))
						} 
					})
					Undo.finishEdit('folder_changed')
				}
			})
		}
	})
	new Action('animated_textures', {
		icon: 'play_arrow',
		category: 'textures',
		condition: function() {
			if (!Format.animated_textures) return false;
			var i = 0;
			var show = false;
			while (i < textures.length) {
				if (textures[i].frameCount > 1) {
					show = true;
					break;
				}
				i++;
			}
			return show;
		},
		click: function () {
			TextureAnimator.toggle()
		}
	})
})

Interface.definePanels(function() {

	Interface.Panels.textures = new Panel({
		id: 'textures',
		icon: 'fas.fa-images',
		growable: true,
		condition: {modes: ['edit', 'paint']},
		toolbars: {
			head: Toolbars.texturelist
		},
		component: {
			name: 'panel-keyframe',
			components: {VuePrismEditor},
			data() { return {
				textures: Texture.all
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
				}
			},
			template: `
				<div>
					<div class="toolbar_wrapper texturelist"></div>
					<ul id="texture_list" class="list" @contextmenu.stop.prevent="openMenu($event)">
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
								<img v-bind:texid="texture.id" v-bind:src="texture.source" class="texture_icon" width="48px" alt="" v-if="texture.show_icon" />
								<i class="material-icons texture_error" v-bind:title="texture.getErrorMessage()" v-if="texture.error">error_outline</i>
								<i class="texture_movie fa fa_big fa-film" title="Animated Texture" v-if="texture.frameCount > 1"></i>
							</div>
							<div class="texture_description_wrapper">
								<div class="texture_name">{{ texture.name }}</div>
								<div class="texture_res">{{ getDescription(texture) }}</div>
							</div>
							<i class="material-icons texture_visibility_icon" v-if="texture.particle">bubble_chart</i>
							<i class="material-icons texture_particle_icon clickable"
								v-bind:class="{icon_off: !texture.visible}"
								v-if="Project.layered_textures"
								@click="texture.toggleVisibility()"
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
				</div>
			`
		},
		menu: new Menu([
			'import_texture',
			'create_texture',
			'reload_textures',
			'change_textures_folder',
			'save_textures'
		])
	})
})
