class ReferenceImage {
	constructor(data = {}) {

		this.name = '';
		this.layer = '';
		this.scope = '';
		this.position = [0, 0];
		this.size = [0, 0];
		this.flip_x = false;
		this.flip_y = false;
		this.rotation = 0;
		this.opacity = 0;
		this.visibility = true;
		this.sync_to_timeline = true;
		this.clear_mode = false;
		this.attached_side = 0;
		this.source = '';
		this.modes = [];
		
		this.uuid = guid();
		this.cache_version = 0;
		this.condition = data.condition;

		for (let key in ReferenceImage.properties) {
			ReferenceImage.properties[key].reset(this);
		}
		this.position.V2_set(window.innerWidth/2, window.innerHeight/2);

		this._modify_nodes = [];
		this.defaults = data;

		this.dark_background = false;
		this.image_is_loaded = false;
		this.auto_aspect_ratio = true;

		this.is_video = false;
		if (data.source && ['mp4', 'wmv', 'mov'].includes(pathToExtension(data.source))) {
			this.is_video = true;
		}
		this.node = Interface.createElement('div', {class: 'reference_image'});
		addEventListeners(this.node, 'mousedown touchstart', event => this.select());
		this.node.addEventListener('contextmenu', event => {
			this.openContextMenu(event);
		})
		this.img = new Image();
		this.img.style.display = 'none';
		this.img.className = 'image_content';
		if (this.is_video) {
			this.video = Interface.createElement('video', {
				autoplay: true,
				loop: true,
				class: 'image_content'
			});
			this.video.muted = 'muted';
			this.video.append(Interface.createElement('source', {type: `video/mp4`}))
			this.node.append(this.video);
			this.image_is_loaded = true;
		} else {
			this.node.append(this.img);
		}


		(this.is_video ? this.video : this.img).onload = () => {
			let was_image_loaded = this.image_is_loaded;
			this.image_is_loaded = true;

			if (this.auto_aspect_ratio) {
				let original_size = this.size[1];
				this.size[1] = this.size[0] / this.aspect_ratio;
				if (original_size != this.size[1]) this.update();

			} else if (!was_image_loaded) {
				this.update();
			}
			this.updateClearMode();
		}
		this.img.onerror = () => {
			this.image_is_loaded = false;
		}

		this.extend(data);
	}
	get aspect_ratio() {
		return this.source_width / this.source_height;
	}
	get source_width() {
		return (this.is_video ? this.video.videoWidth : this.img.naturalWidth) || 16;
	}
	get source_height() {
		return (this.is_video ? this.video.videoHeight : this.img.naturalHeight) || 16;
	}
	extend(data) {
		if (data.size instanceof Array) this.auto_aspect_ratio = false;

		if (data.modes instanceof Array) {
			this.modes.replace(data.modes);
		}

		for (let key in ReferenceImage.properties) {
			ReferenceImage.properties[key].merge(this, data)
		}
	}
	getSaveCopy() {
		let copy = {};
		for (let key in ReferenceImage.properties) {
			if (this[key] != ReferenceImage.properties[key].default) ReferenceImage.properties[key].copy(this, copy);
		}
		if (isApp && copy.source && !copy.source.startsWith('data:') && copy.source.match(/\.(png|jpg|jpeg)$/i)) {
			let frame = new CanvasFrame(this.img);
			copy.source = frame.canvas.toDataURL('image/png');

		}
		if (this.modes.length) copy.modes = this.modes.slice();
		return copy;
	}
	resolveCondition() {
		if (!Condition(this.condition)) return false;
		if (this.modes.length && !this.modes.includes(Modes.selected.id)) return false;
		if (this.layer == 'blueprint') {
			return Preview.all.find(p => p.isOrtho && p.angle == this.attached_side) !== undefined;
		}
		return true;
	}
	addAsReference(save) {
		Project.reference_images.push(this);
		if (Preview.selected && Preview.selected.angle) this.changeLayer('blueprint');
		this.scope = 'project';
		this.update();
		if (save) this.save();
		return this;
	}
	addAsGlobalReference(save) {
		ReferenceImage.global.push(this);
		if (Preview.selected && Preview.selected.angle) this.changeLayer('blueprint');
		this.scope = 'global';
		this.update();
		if (save) this.save();
		return this;
	}
	addAsBuiltIn(save) {
		ReferenceImage.built_in.push(this);
		this.scope = 'built_in';
		this.update();
		if (save) this.save();
		return this;
	}
	select(force) {
		if (!force && this.selected) return this;
		if (this.scope == 'built_in') return this;
		if (ReferenceImage.selected && ReferenceImage.selected != this) {
			ReferenceImage.selected.unselect();
		}
		if (!ReferenceImageMode.active) {
			ReferenceImageMode.activate()
		}
		ReferenceImage.selected = this;
		this.update();
		return this;
	}
	unselect() {
		if (ReferenceImage.selected == this) ReferenceImage.selected = null;
		this.update();
		return this;
	}
	get selected() {
		return ReferenceImage.selected == this;
	}
	save() {
		if (this.removed) return this;
		this.position[0] = Math.round(this.position[0]);
		this.position[1] = Math.round(this.position[1]);
		this.size[0] = Math.round(this.size[0]);
		this.size[1] = Math.round(this.size[1]);
		this.rotation = Math.roundTo(this.rotation, 2);

		switch (this.scope) {
			case 'project':
				Project.saved = false;
				break;
			case 'global':
				ReferenceImageMode.saveGlobalReferences();
				break;
			case 'built_in':
				// built in references are not saved
				break;
		}
		return this;
	}
	update() {
		if (!Interface.preview || this.removed) return this;
		let shown = this.resolveCondition();
		if (!shown) {
			this.node.remove();
			return this;
		}

		this.node.setAttribute('reference_layer', this.layer);
		switch (this.layer) {
			case 'background': {
				Interface.preview.querySelector('.clamped_reference_images').append(this.node);
				break;
			}
			case 'viewport': {
				Interface.preview.querySelector('.clamped_reference_images').append(this.node);
				break;
			}
			case 'blueprint': {
				Interface.preview.querySelector('.clamped_reference_images').append(this.node);
				break;
			}
			case 'float': default: {
				Interface.work_screen.append(this.node);
				break;
			}
		}
		
		this.updateTransform();

		let image_content = this.is_video ? this.video : this.img;

		image_content.style.display = (this.visibility && this.image_is_loaded) ? 'block' : 'none';
		image_content.style.opacity = this.opacity;

		let transforms = [];
		if (this.rotation) transforms.push(`rotate(${this.rotation}deg)`);
		if (this.flip_x) transforms.push('scaleX(-1)');
		if (this.flip_y) transforms.push('scaleY(-1)');
		image_content.style.transform = transforms.join(' ');

		let source = this.source + (this.cache_version ? ('?'+this.cache_version) : '');
		if (this.is_video) {
			if (this.video.ref_source != source) {
				this.video.ref_source = source;
				this.video.firstElementChild.src = source;
				this.video.load();
			}
		} else {
			if (this.img.src != source) {
				this.img.src = source;
			}
		}

		this.img.style.imageRendering = (this.img.naturalWidth > this.size[0]) ? 'auto' : 'pixelated';

		if (!this.selected && this.clear_mode) {
			let light_mode = document.body.classList.contains('light_mode');
			this.node.style.filter = (light_mode != this.dark_background ? '' : 'invert(1) ') + 'contrast(1.2)';
			this.node.style.mixBlendMode = 'lighten';

		} else {
			this.node.style.filter = '';
			this.node.style.mixBlendMode = '';
		}
		this.node.classList.toggle('invisible', this.visibility == false || this.opacity < 0.1);

		// Select
		if (this.selected && !this._modify_nodes.length) {
			this.setupEditHandles()
		}
		// Unselect
		if (!this.selected && this._modify_nodes.length) {
			this.node.classList.remove('selected');
			this._modify_nodes.forEach(node => node.remove());
			this._modify_nodes.empty();
		}
		if (this.selected) {
			this.node.querySelector('div.reference_image_toolbar .tool[tool_id=flip_x]').classList.toggle('enabled', this.flip_x);
			this.node.querySelector('div.reference_image_toolbar .tool[tool_id=flip_y]').classList.toggle('enabled', this.flip_y);
			this.node.querySelector('div.reference_image_toolbar .tool[tool_id=visibility]').classList.toggle('enabled', this.visibility);
		}
		return this;
	}
	getZoomLevel() {
		let preview = this.layer == 'blueprint' && Preview.all.find(p => p.isOrtho && p.angle == this.attached_side);
		return preview ? preview.camOrtho.zoom * 2 : 1;
	}
	updateTransform() {
		if (!this.node.isConnected) return this;
		let preview = this.layer == 'blueprint' && Preview.all.find(p => p.isOrtho && p.angle == this.attached_side);
		if (preview && preview.node.isConnected) {

			let zoom = this.getZoomLevel();;
			let pos_x = this.position[0];
			let pos_y = this.position[1];
			
			pos_x = preview.controls.target[preview.camOrtho.backgroundHandle[0].a] * zoom * 20;
			pos_y = preview.controls.target[preview.camOrtho.backgroundHandle[1].a] * zoom * 20;
			pos_x *= preview.camOrtho.backgroundHandle[0].n === true ? 1 : -1;
			pos_y *= preview.camOrtho.backgroundHandle[1].n === true ? 1 : -1;
			pos_x += preview.width/2;
			pos_y += preview.height/2;

			if (Preview.split_screen.enabled) {
				pos_x += preview.node.parentElement.offsetLeft;
				pos_y += preview.node.parentElement.offsetTop;
			}
				
			pos_x += (this.position[0] * zoom) - (this.size[0] * zoom) / 2;
			pos_y += (this.position[1] * zoom) - (this.size[1] * zoom) / 2;
	
			this.node.style.width = (this.size[0] * zoom) + 'px';
			this.node.style.height = (this.size[1] * zoom) + 'px';
			this.node.style.left = pos_x + 'px';
			this.node.style.top  = pos_y + 'px';

			let offset_top = preview.node.offsetTop - this.node.offsetTop;
			let offset_right = preview.node.clientWidth + preview.node.offsetLeft - this.node.offsetLeft;
			let offset_bottom = preview.node.clientHeight + preview.node.offsetTop - this.node.offsetTop;
			let offset_left = preview.node.offsetLeft - this.node.offsetLeft;
			this.node.style.clipPath = `rect(${offset_top}px ${offset_right}px ${offset_bottom}px ${offset_left}px) view-box`;

		} else {
			this.node.style.width = this.size[0] + 'px';
			this.node.style.height = this.size[1] + 'px';
			this.node.style.left = (Math.clamp(this.position[0], 0, this.node.parentNode.clientWidth) - this.size[0]/2) + 'px';
			this.node.style.top  = (Math.clamp(this.position[1], 0, this.node.parentNode.clientHeight) - this.size[1]/2) + 'px';
			this.node.style.clipPath = '';
		}
		return this;
	}
	updateClearMode() {
		if (this.clear_mode && this.image_is_loaded) {
			let average_color = getAverageRGB(this.img);
			this.dark_background = (average_color.r + average_color.g + average_color.b) < 380;
		} else {
			this.dark_background = false;
		}
	}
	detach() {
		this.node.remove();
	}
	setupEditHandles() {
		let self = this;
		this.node.classList.add('selected');
		let resize_corners = ['nw', 'ne', 'sw', 'se'].map(direction => {
			let corner = Interface.createElement('div', {class: 'reference_image_resize_corner '+direction});
			let sign_x = direction[1] == 'e' ? 1 : -1;
			let sign_y = direction[0] == 's' ? 1 : -1;
			let multiplier = 1 / this.getZoomLevel();
			addEventListeners(corner, 'mousedown touchstart', e1 => {
				convertTouchEvent(e1);

				let original_position = this.position.slice();
				let original_size = this.size.slice();

				let move = (e2) => {
					convertTouchEvent(e2);
					let offset = [
						(e2.clientX - e1.clientX) * multiplier,
						(e2.clientY - e1.clientY) * multiplier,
					];
					let zoom_level = this.getZoomLevel();
					let max_size = [
						32 / zoom_level,
						24 / zoom_level
					];
					this.size[0] = Math.max(original_size[0] + offset[0] * sign_x, max_size[0]);
					this.position[0] = original_position[0] + offset[0] / 2, 0;

					if (!e2.ctrlOrCmd && !Pressing.overrides.ctrl) {
						offset[1] = sign_y * (this.size[0] / this.aspect_ratio - original_size[1]);
					}

					this.size[1] = Math.max(original_size[1] + offset[1] * sign_y, max_size[1]);
					this.position[1] = original_position[1] + offset[1] / 2, 0;

					if (this.layer !== 'blueprint') {
						this.position[0] = Math.clamp(this.position[0], 0, this.node.parentNode.clientWidth);
						this.position[1] = Math.clamp(this.position[1], 0, this.node.parentNode.clientHeight);
					}

					this.update();
				}
				let stop = (e2) => {
					convertTouchEvent(e2);
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
					this.save();
				}
				addEventListeners(document, 'mousemove touchmove', move);
				addEventListeners(document, 'mouseup touchend', stop);
			})
			this.node.append(corner);
			return corner;
		});
		this._modify_nodes.push(...resize_corners);

		let rotate_handle = Interface.createElement('div', {class: 'reference_image_rotate_handle'}, Blockbench.getIconNode('rotate_right'));
		addEventListeners(rotate_handle, 'mousedown touchstart', e1 => {
			convertTouchEvent(e1);

			let original_rotation = this.rotation;
			let offset = $(this.node).offset();
			let center = [
				offset.left + this.size[0]/2,
				offset.top  + this.size[1]/2,
			]
			let initial_angle = null;

			let move = (e2) => {
				convertTouchEvent(e2);
				let angle = Math.radToDeg(Math.atan2(
					e2.clientY - center[1],
					e2.clientX - center[0],
				))
				if (initial_angle === null) initial_angle = angle;

				if (angle != initial_angle) {
					let target_rotation = Math.trimDeg(original_rotation + angle - initial_angle);
					this.rotation = Math.snapToValues(target_rotation, [-180, -90, 0, 90, 180], 3);
					this.update();
				}
			}
			let stop = (e2) => {
				convertTouchEvent(e2);
				removeEventListeners(document, 'mousemove touchmove', move);
				removeEventListeners(document, 'mouseup touchend', stop);
				this.save();
			}
			addEventListeners(document, 'mousemove touchmove', move);
			addEventListeners(document, 'mouseup touchend', stop);
		})
		this.node.append(rotate_handle);
		this._modify_nodes.push(rotate_handle);

		this.toolbar = Interface.createElement('div', {class: 'reference_image_toolbar'});
		this.node.append(this.toolbar);
		this._modify_nodes.push(this.toolbar);
		
		// Controls
		function addButton(id, name, icon, click) {
			let node = Interface.createElement('div', {class: 'tool', tool_id: id}, Blockbench.getIconNode(icon));
			self.toolbar.append(node);
			node.onclick = click;
			BarItem.prototype.addLabel(false, {
				name: tl(name),
				node: node
			})
			return node;
		}
		
		if (this.is_video) {
			let toggle = addButton('toggle_playback', 'reference_image.toggle_playback', this.video.paused ? 'play_arrow' : 'pause', () => {
				if (this.video.paused) {
					this.video._loading = false;
					this.video.play();
				} else {
					this.video.pause();
				}
				toggle.querySelector('.icon').replaceWith(Blockbench.getIconNode(this.video.paused ? 'play_arrow' : 'pause'))
			});
		}

		addButton('layer', 'reference_image.layer', 'flip_to_front', (event) => {
			let layers = {
				background: 'reference_image.layer.background',
				viewport: 'reference_image.layer.viewport',
				float: 'reference_image.layer.float',
			}
			if (Preview.selected.angle) {
				layers.blueprint = 'reference_image.layer.blueprint';
			}
			let options = Object.keys(layers).map(key => {
				return {
					name: layers[key],
					icon: this.layer == key ? 'far.fa-dot-circle' : 'far.fa-circle',
					click: () => {
						this.changeLayer(key);
						this.update().save();
					}
				}
			})
			new Menu(options).open(event.target);
		});
		
		addButton('flip_x', tl('action.flip', 'X'), 'icon-mirror_x', () => {
			self.flip_x = !self.flip_x;
			self.update().save();
		});
		
		addButton('flip_y', tl('action.flip', 'Y'), 'icon-mirror_y', () => {
			self.flip_y = !self.flip_y;
			self.update().save();
		});
		
		this.opacity_slider = new NumSlider({
			id: 'slider_reference_image_opacity',
			name: 'reference_image.opacity',
			private: true,
			condition: () => true,
			get() {
				return self.opacity * 100;
			},
			change(modify) {
				self.opacity = Math.clamp(modify(self.opacity*100) / 100, 0, 1);
				self.update();
			},
			onAfter() {
				self.save();
			},
			sensitivity: 5,
			settings: {
				min: 0, max: 100, step: 1, show_bar: true
			}
		}).toElement(this.toolbar).update();
		
		addButton('visibility', 'reference_image.visibility', 'visibility', () => {
			self.visibility = !self.visibility;
			self.update().save();
		});

		if (!this._edit_events_initialized) {
			addEventListeners(this.node, 'mousedown touchstart', e1 => {
				if (!e1.target.classList.contains('reference_image')) return;
				convertTouchEvent(e1);

				let original_position = this.position.slice();
				let zoom = this.getZoomLevel();

				let move = (e2) => {
					convertTouchEvent(e2);
					let offset = [
						(e2.clientX - e1.clientX),
						(e2.clientY - e1.clientY),
					];
					this.position[0] = original_position[0] + offset[0] / zoom;
					this.position[1] = original_position[1] + offset[1] / zoom;

					if (this.layer !== 'blueprint') {
						this.position[0] = Math.clamp(this.position[0], 0, this.node.parentNode.clientWidth);
						this.position[1] = Math.clamp(this.position[1], 0, this.node.parentNode.clientHeight);
					}

					this.update();
				}
				let stop = (e2) => {
					convertTouchEvent(e2);
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
					this.save();
				}
				addEventListeners(document, 'mousemove touchmove', move);
				addEventListeners(document, 'mouseup touchend', stop);
			})
			this.node.addEventListener('dblclick', event => {
				if (event.target !== this.node) return;
				this.propertiesDialog();
			})
			this._edit_events_initialized = true;
		}
		return this;
	}
	projectMouseCursor(x, y) {
		if (!this.resolveCondition() || !this.visibility) return false;

		let rect = this.node.getBoundingClientRect();
		let center = [rect.x + rect.width/2, rect.y + rect.height/2];
		let local_offset = [x - center[0], y - center[1]];

		let s = Math.sin(Math.degToRad(this.rotation));
		let c = Math.cos(Math.degToRad(this.rotation));
		let local_x = center[0] + local_offset[0] * c + local_offset[1] * s;
		let local_y = center[1] - local_offset[0] * s + local_offset[1] * c;

		if (local_x > rect.x && local_y > rect.y && local_x < rect.right && local_y < rect.bottom) {
			// Check if not clipped behind UI
			if (this.layer != 'float') {
				let parent = this.node.parentElement;
				if (!parent) return false;
				let parent_rect = parent.getBoundingClientRect();
				if (!(local_x > parent_rect.x && local_y > parent_rect.y && local_x < parent_rect.right && local_y < parent_rect.bottom)) return false;
			}

			let lerp_x = Math.getLerp(rect.x, rect.right,  local_x);
			let lerp_y = Math.getLerp(rect.y, rect.bottom, local_y);
			if (this.flip_x) lerp_x = 1 - lerp_x;
			if (this.flip_y) lerp_y = 1 - lerp_y;
			return [
				Math.floor(Math.min(lerp_x, 0.9999) * this.source_width),
				Math.floor(Math.min(lerp_y, 0.9999) * this.source_height),
			]
		}
		return false;
	}
	openContextMenu(event) {
		this.menu.open(event, this);
		return this;
	}
	reset() {
		return this;
	}
	async delete(force) {
		if (!force) {
			let icon;
			if (this.is_video) {
				icon = 'theaters';
			} else {
				icon = new Image();
				icon.src = this.source;
			}
			let result = await new Promise(resolve => Blockbench.showMessageBox({
				title: 'data.reference_image',
				message: 'message.delete_reference_image',
				icon: icon,
				buttons: ['dialog.confirm', 'dialog.cancel']
			}, resolve));
			if (result == 1) return;
		}
		if (ReferenceImage.selected == this) ReferenceImage.selected = null;
		this.update();
		switch (this.scope) {
			case 'project': Project.reference_images.remove(this); break;
			case 'global': ReferenceImage.global.remove(this); break;
			case 'built_in': ReferenceImage.built_in.remove(this); break;
		}
		this.save();
		this.removed = true;
		this.node.remove();
	}
	changeLayer(layer) {
		if (layer == this.layer) return;

		if (layer == 'float' || this.layer == 'float') {
			let preview_offset = $(Interface.preview).offset();
			let workscreen_offset = $(Interface.work_screen).offset();
			let sign = layer == 'float' ? 1 : -1;
			
			this.position[0] += (preview_offset.left - workscreen_offset.left) * sign;
			this.position[1] += (preview_offset.top - workscreen_offset.top) * sign;
		}
		if (layer == 'blueprint' && Preview.selected?.angle) {
			this.attached_side = Preview.selected.angle;
			this.position.V2_set(0, 0);
		}
		this.layer = layer;
		return this;
	}
	changeScope(new_scope) {
		if (new_scope == this.scope) return this;

		switch (this.scope) {
			case 'project': Project.reference_images.remove(this); break;
			case 'global': ReferenceImage.global.remove(this); break;
			//case 'built_in': ReferenceImage.built_in.remove(this); break;
		}
		this.scope = new_scope;
		switch (this.scope) {
			case 'project': Project.reference_images.push(this); break;
			case 'global': ReferenceImage.global.push(this); break;
			//case 'built_in': ReferenceImage.built_in.push(this); break;
		}
		return this;
	}
	propertiesDialog() {
		new Dialog('reference_image_properties', {
			title: 'data.reference_image',
			form: {
				source: {type: 'file', label: 'reference_image.image',
					condition: () => isApp && this.source && PathModule.isAbsolute(this.source),
					value: this.source,
					extensions: this.is_video ? ReferenceImage.video_extensions : ReferenceImage.supported_extensions
				},
				layer: {type: 'select', label: 'reference_image.layer', value: this.layer, options: {
					background: 'reference_image.layer.background',
					viewport: 'reference_image.layer.viewport',
					float: 'reference_image.layer.float',
					blueprint:  Preview.selected.angle ? 'reference_image.layer.blueprint' : undefined,
				}},
				scope: {type: 'select', label: 'reference_image.scope', value: this.scope, options: {
					project: 'reference_image.scope.project',
					global: 'reference_image.scope.global',
				}},
				position: {type: 'vector', label: 'reference_image.position', dimensions: 2, value: this.position},
				size: {type: 'vector', label: 'reference_image.size', dimensions: 2, linked_ratio: true, value: this.size},
				rotation: {type: 'number', label: 'reference_image.rotation', value: this.rotation},
				opacity: {type: 'range', label: 'reference_image.opacity', editable_range_label: true, value: this.opacity * 100, min: 0, max: 100, step: 1},
				visibility: {type: 'checkbox', label: 'reference_image.visibility', value: this.visibility},
				sync_to_timeline: {type: 'checkbox', label: 'reference_image.sync_to_timeline', value: this.sync_to_timeline, condition: this.is_video && Format.animation_mode},
				clear_mode: {type: 'checkbox', label: 'reference_image.clear_mode', value: this.clear_mode},
			},
			onConfirm: (result) => {
				if (this.removed) return;
				let clear_mode_before = this.clear_mode;
				this.extend({
					source: result.source,
					position: result.position,
					size: result.size,
					rotation: result.rotation,
					opacity: result.opacity / 100,
					visibility: result.visibility,
					sync_to_timeline: result.sync_to_timeline,
					clear_mode: result.clear_mode,
				});
				this.changeLayer(result.layer);
				this.changeScope(result.scope);
				if (this.clear_mode != clear_mode_before) {
					this.updateClearMode();
				}
				this.update().save();
			}
		}).show();
		return this;
	}

	static supported_extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif', 'mp4', 'wmv', 'mov'];
	static image_extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'];
	static video_extensions = ['mp4', 'wmv', 'mov'];
}
ReferenceImage.prototype.menu = new Menu([
	new MenuSeparator('media_controls'),
	{
		id: 'toggle_playback',
		name: 'reference_image.toggle_playback',
		condition: (ref) => ref.is_video,
		icon: (ref) => ref.video.paused ? 'play_arrow' : 'pause',
		click(ref) {
			if (ref.video.paused) {
				ref.video._loading = false;
				ref.video.play();
			} else {
				ref.video.pause();
			}
		}
	},
	new MenuSeparator('settings'),
	{
		id: 'visibility',
		name: 'reference_image.visibility',
		icon: (ref) => ref.visibility,
		click(ref) {
			ref.visibility = !ref.visibility;
			ref.update().save();
		}
	},
	{
		id: 'sync_to_timeline',
		name: 'reference_image.sync_to_timeline',
		condition: () => Format.animation_mode,
		icon: (ref) => ref.sync_to_timeline,
		click(ref) {
			ref.sync_to_timeline = !ref.sync_to_timeline;
			ref.update().save();
		}
	},
	{
		id: 'clear_mode',
		name: 'reference_image.clear_mode',
		icon: (ref) => ref.clear_mode,
		//condition: ref => ref.layer == 'blueprint',
		click(ref) {
			ref.clear_mode = !ref.clear_mode;
			ref.updateClearMode();
			ref.update().save();

			// Preview
			if (ref.clear_mode) {
				ref.unselect();
				setTimeout(() => ref.select(), 400);
			}
		}
	},
	{
		name: 'reference_image.layer',
		icon: 'list',
		children: (reference) => {
			let layers = {
				background: 'reference_image.layer.background',
				viewport: 'reference_image.layer.viewport',
				float: 'reference_image.layer.float',
			}
			if (Preview.selected.angle) {
				layers.blueprint = 'reference_image.layer.blueprint';
			}
			let children = [];
			for (let key in layers) {
				children.push({
					id: key,
					name: layers[key],
					icon: reference.layer == key ? 'far.fa-dot-circle' : 'far.fa-circle',
					click() {
						reference.changeLayer(key);
						reference.update().save();
					}
				})
			}
			return children;
		}
	},
	{
		name: 'reference_image.enabled_modes',
		icon: 'fact_check',
		children: (reference) => {
			let children = [];
			let all_modes = [];
			for (let key in Modes.options) {
				let mode = Modes.options[key];
				all_modes.push(key);
				children.push({
					id: key,
					name: mode.name,
					icon: (reference.modes.length == 0 || reference.modes.includes(key)),
					click() {
						if (reference.modes.length == 0) {
							reference.modes.replace(all_modes);
						}
						reference.modes.toggle(key);
						// Clear invalid modes (uninstalled plugins etc.)
						reference.modes.forEachReverse((mode) => {
							if (!Modes.options[mode]) reference.modes.remove(mode);
						})
						reference.update().save();
					}
				})
			}
			return children;
		}
	},
	new MenuSeparator('manage'),
	{
		name: 'menu.texture.refresh',
		icon: 'refresh',
		condition: (reference) => (isApp && reference.source && PathModule.isAbsolute(reference.source)),
		click(reference) {
			reference.cache_version++;
			reference.update();
		}
	},
	'delete',
	new MenuSeparator('properties'),
	{
		name: 'menu.texture.properties',
		icon: 'list',
		click(instance, b) {
			instance.propertiesDialog();
		}
	}
])

new Property(ReferenceImage, 'string', 'name', {default: 'Reference'});
new Property(ReferenceImage, 'string', 'layer', {default: 'background'});
new Property(ReferenceImage, 'string', 'scope', {default: 'global'});
new Property(ReferenceImage, 'vector2', 'position');
new Property(ReferenceImage, 'vector2', 'size', {default: [400, 300]});
new Property(ReferenceImage, 'boolean', 'flip_x');
new Property(ReferenceImage, 'boolean', 'flip_y');
new Property(ReferenceImage, 'number', 'rotation');
new Property(ReferenceImage, 'number', 'opacity', {default: 1});
new Property(ReferenceImage, 'boolean', 'visibility', {default: true});
new Property(ReferenceImage, 'boolean', 'sync_to_timeline', {default: true});
new Property(ReferenceImage, 'boolean', 'clear_mode');
new Property(ReferenceImage, 'string', 'attached_side', {default: 'north'});
new Property(ReferenceImage, 'string', 'source');

ReferenceImage.selected = null;
ReferenceImage.built_in = [];
ReferenceImage.global = [];
Object.defineProperty(ReferenceImage, 'current_project', {
	get() {
		return Project.reference_images || [];
	}
})
Object.defineProperty(ReferenceImage, 'all', {
	get() {
		return ReferenceImage.built_in.concat(ReferenceImage.global, ReferenceImage.current_project);
	}
})
Object.defineProperty(ReferenceImage, 'active', {
	get() {
		return ReferenceImage.all.filter(ref => ref.resolveCondition());
	}
})

ReferenceImage.updateAll = function() {
	ReferenceImage.all.forEach(ref => {
		ref.update();
	})
}

StateMemory.init('global_reference_images', 'array');
StateMemory.global_reference_images.forEach(template => {
	new ReferenceImage(template).addAsGlobalReference();
});

SharedActions.add('delete', {
	condition: () => ReferenceImageMode.active && ReferenceImage.selected,
	priority: 1,
	run() {
		ReferenceImage.selected.delete();
	}
})

Blockbench.on('display_animation_frame', () => {
	ReferenceImage.active.forEach(ref => {
		if (ref.is_video && ref.visibility && ref.sync_to_timeline && !ref.video._loading) {
			ref.video._loading = true;
			ref.video.ontimeupdate = () => {
				ref.video._loading = false;
			}

			let video_time = Math.max(0, Timeline.time - 0.02) % ref.video.duration;
			if (Timeline.playing) {
				ref.video.playbackRate = Timeline.playback_speed/100;
				if (Math.abs(ref.video.currentTime - video_time + 0.02) > 0.05) {
					ref.video.currentTime = video_time;
				}
				if (ref.video.paused) ref.video.play();

			} else {
				ref.video.currentTime = video_time;
				if (!ref.video.paused) ref.video.pause();
			}
		}
	})
})
Blockbench.on('timeline_pause', () => {
	ReferenceImage.active.forEach(ref => {
		if (ref.is_video && ref.visibility && ref.sync_to_timeline && !ref.video.paused) {
			ref.video.pause();
		}
	})
})

const ReferenceImageMode = {
	active: false,
	toolbar: null,
	activate() {
		ReferenceImageMode.active = true;
		Interface.work_screen.classList.add('reference_image_mode');
		Interface.work_screen.append(ReferenceImageMode.toolbar.node);
		ReferenceImage.updateAll();
		BARS.updateConditions();
		setTimeout(_ => {
			if (!ReferenceImage.selected && ReferenceImage.active[0]) {
				ReferenceImage.active[0].select();
			}
		}, 1);
	},
	deactivate() {
		ReferenceImageMode.active = false;
		if (ReferenceImage.selected) ReferenceImage.selected.unselect();
		Interface.work_screen.classList.remove('reference_image_mode');
		ReferenceImageMode.toolbar.node.remove();
		ReferenceImage.updateAll();
		BARS.updateConditions();
	},
	async importReferences(files) {
		let save_mode = await new Promise(resolve => {
			let icon = new Image();
			icon.src = files[0].content;
			Blockbench.showMessageBox({
				title: 'action.add_reference_image',
				message: 'message.add_reference_image.message',
				icon,
				commands: {
					project: 'message.add_reference_image.project',
					app: 'message.add_reference_image.app',
				}
			}, resolve)
		})
		files.forEach(file => {
			let ref = new ReferenceImage({source: file.content, name: file.name});
			if (Format.image_editor) {
				ref.layer = 'viewport';
			}
			if (save_mode == 'project') {
				ref.addAsReference(true);
			} else {
				ref.addAsGlobalReference(true);
			}
			ref.select();
		})
	},
	saveGlobalReferences() {
		StateMemory.global_reference_images = ReferenceImage.global.map(ref => ref.getSaveCopy());
		StateMemory.save('global_reference_images');
	}
}


BARS.defineActions(function() {
	new Action('edit_reference_images', {
		icon: 'wallpaper',
		category: 'view',
		click() {
			if (ReferenceImageMode.active) {
				ReferenceImageMode.deactivate()
			} else {
				ReferenceImageMode.activate()
			}
		}
	});
	new Action('add_reference_image', {
		icon: 'add_photo_alternate',
		category: 'view',
		click() {
			if (!ReferenceImageMode.active) {
				ReferenceImageMode.activate()
			}
			Blockbench.import({
				resource_id: 'reference_image',
				extensions: ReferenceImage.supported_extensions,
				type: 'Image',
				readtype: 'image'
			}, async function(files) {
				ReferenceImageMode.importReferences(files);
			}, 'image', false)
		}
	});
	new Action('reference_image_from_clipboard', {
		icon: 'fa-clipboard',
		category: 'view',
		click() {
			if (!ReferenceImageMode.active) {
				ReferenceImageMode.activate()
			}
			if (isApp) {
				var image = clipboard.readImage().toDataURL();
				if (image.length > 32) {
					ReferenceImageMode.importReferences([{content: image, name: 'Pasted'}]);
				}
			} else {
				navigator.clipboard.read().then(content => {
					if (content && content[0] && content[0].types.includes('image/png')) {
						content[0].getType('image/png').then(blob => {
							let url = URL.createObjectURL(blob);
							if (image.length > 32) {
								ReferenceImageMode.importReferences([{content: url, name: 'Pasted'}]);
							}
						})
					}
				})
			}
		}
	});
	new Action('toggle_all_reference_images', {
		icon: 'hide_image',
		category: 'view',
		condition: () => ReferenceImage.active.length > 0,
		click() {
			let references = ReferenceImage.active;
			let most_are_hidden = references.filter(r => r.visibility == true).length < references.length/2;
			references.forEach(ref => {
				ref.visibility = most_are_hidden;
				ref.update().save();
			})
		}
	});
	new Action('reference_image_list', {
		icon: 'list',
		category: 'view',
		condition: () => ReferenceImageMode.active,
		click(e) {
			new Menu('apply_display_preset', this.children(), {searchable: false}).open(e.target, 'wrong context');
		},
		children() {
			let list = [];
			function getSubMenu(reference) {
				return [
					{
						id: 'visibility',
						name: 'reference_image.visibility',
						icon: () => reference.visibility,
						click() {
							reference.visibility = !reference.visibility;
							reference.update().save();
						}
					},
					{
						name: 'reference_image.enabled_modes',
						icon: 'fact_check',
						children: () => {
							let children = [];
							let all_modes = [];
							for (let key in Modes.options) {
								let mode = Modes.options[key];
								all_modes.push(key);
								children.push({
									id: key,
									name: mode.name,
									icon: (reference.modes.length == 0 || reference.modes.includes(key)),
									click() {
										if (reference.modes.length == 0) {
											reference.modes.replace(all_modes);
										}
										reference.modes.toggle(key);
										// Clear invalid modes (uninstalled plugins etc.)
										reference.modes.forEachReverse((mode) => {
											if (!Modes.options[mode]) reference.modes.remove(mode);
										})
										reference.update().save();
									}
								})
							}
							return children;
						}
					},
					'_',
					{
						name: 'menu.texture.refresh',
						icon: 'refresh',
						condition: () => (isApp && reference.source && PathModule.isAbsolute(reference.source)),
						click() {
							reference.cache_version++;
							reference.update();
						}
					},
					{
						name: 'generic.delete',
						icon: 'delete',
						click() {
							reference.select();
							if (reference.selected) BarItems.delete.trigger();
						}
					},
					new MenuSeparator('properties'),
					/** Todo: add options
					 * Center
					 */
					{
						name: 'menu.texture.properties',
						icon: 'list',
						click() {
							reference.propertiesDialog();
						}
					}
				]
			}
			ReferenceImage.current_project.forEach(reference => {
				list.push({
					name: (reference.name || 'Unknown').substring(0, 24), id: reference.uuid,
					icon: 'icon-blockbench_file',
					children: getSubMenu(reference)
				});
			});
			list.push('_');
			ReferenceImage.global.forEach(reference => {
				list.push({
					name: (reference.name || 'Unknown').substring(0, 24), id: reference.uuid,
					icon: 'icon-blockbench_inverted',
					children: getSubMenu(reference)
				});
			});
			list.push('_');
			ReferenceImage.built_in.forEach(reference => {
				if (!Condition(reference.condition)) return;
				list.push({
					name: (reference.name || 'Unknown').substring(0, 24), id: reference.uuid,
					icon: 'settings'
				});
			});
			return list;
		}
	});
})

Interface.definePanels(function() {
	ReferenceImageMode.toolbar = new Toolbar('reference_images', {
		children: [
			'add_reference_image',
			'reference_image_from_clipboard',
			'reference_image_list',
			'toggle_all_reference_images',
		]
	})
})