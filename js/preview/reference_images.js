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
		this.clear_mode = false;
		this.attached_side = 0;
		this.source = '';
		
		this.uuid = guid();
		this.condition = data.condition;

		for (let key in ReferenceImage.properties) {
			ReferenceImage.properties[key].reset(this);
		}
		this.position.V2_set(window.innerWidth/2, window.innerHeight/2);

		this.node = Interface.createElement('div', {class: 'reference_image'});
		addEventListeners(this.node, 'mousedown touchstart', event => this.select());
		this.node.addEventListener('contextmenu', event => {
			this.openContextMenu(event);
		})
		this.img = new Image();
		this.img.style.display = 'none';
		this.node.append(this.img);
		this._modify_nodes = [];
		this.defaults = data;

		this.dark_background = false;
		this.image_is_loaded = false;
		this.auto_aspect_ratio = true;
		this.img.onload = () => {
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
		if (this.img && this.img.naturalWidth && this.img.naturalHeight) {
			return this.img.naturalWidth / this.img.naturalHeight;
		} else {
			return 1;
		}
	}
	extend(data) {
		if (data.size instanceof Array) this.auto_aspect_ratio = false;

		for (let key in ReferenceImage.properties) {
			ReferenceImage.properties[key].merge(this, data)
		}
	}
	getSaveCopy() {
		/*let dataUrl;
		if (isApp && this.image && this.image.substr(0, 5) != 'data:') {
			let canvas = document.createElement('canvas');
			canvas.width = this.imgtag.naturalWidth;
			canvas.height = this.imgtag.naturalHeight;
			let ctx = canvas.getContext('2d');
			ctx.drawImage(this.imgtag, 0, 0);
			dataUrl = canvas.toDataURL('image/png');
		}*/
		let copy = {};
		for (let key in ReferenceImage.properties) {
			if (this[key] != ReferenceImage.properties[key].default) ReferenceImage.properties[key].copy(this, copy);
		}
		return copy;
	}
	resolveCondition() {
		if (!Condition(this.condition)) return false;
		if (this.layer == 'blueprint') {
			return Preview.all.find(p => p.isOrtho && p.angle == this.attached_side) !== undefined;
		}
		return true;
	}
	addAsReference(save) {
		Project.reference_images.push(this);
		this.scope = 'project';
		this.update();
		if (save) this.save();
		return this;
	}
	addAsGlobalReference(save) {
		ReferenceImage.global.push(this);
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
		if (!force && this.selected) return;
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
		switch (this.scope) {
			case 'project':
				Project.saved = false;
				break;
			case 'global':
				ReferenceImageMode.saveGlobalReferences();
				break;
			case 'built_in':
				// todo: save
				break;
		}
		return this;
	}
	update() {
		if (!Interface.preview) return this;
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

		this.img.style.display = (this.visibility && this.image_is_loaded) ? 'block' : 'none';
		this.img.style.opacity = this.opacity;

		let transforms = [];
		if (this.rotation) transforms.push(`rotate(${this.rotation}deg)`);
		if (this.flip_x) transforms.push('scaleX(-1)');
		if (this.flip_y) transforms.push('scaleY(-1)');
		this.img.style.transform = transforms.join(' ');

		if (this.img.src != this.source) this.img.src = this.source;

		this.img.style.imageRendering = (this.img.naturalWidth > this.size[0]) ? 'auto' : 'pixelated';

		if (!this.selected && this.clear_mode) {
			let light_mode = document.body.classList.contains('light_mode');
			this.node.style.filter = (light_mode != this.dark_background ? '' : 'invert(1) ') + 'contrast(1.2)';
			this.node.style.mixBlendMode = 'lighten';

		} else {
			this.node.style.filter = '';
			this.node.style.mixBlendMode = '';
		}

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
		let preview = this.layer == 'blueprint' && Preview.all.find(p => p.isOrtho && p.angle == this.attached_side);
		if (preview) {

			let zoom = this.getZoomLevel();;
			let pos_x = this.position[0];
			let pos_y = this.position[1];
			
			pos_x = preview.controls.target[preview.camOrtho.backgroundHandle[0].a] * zoom * 20;
			pos_y = preview.controls.target[preview.camOrtho.backgroundHandle[1].a] * zoom * 20;
			pos_x *= preview.camOrtho.backgroundHandle[0].n === true ? 1 : -1;
			pos_y *= preview.camOrtho.backgroundHandle[1].n === true ? 1 : -1;
			pos_x += preview.width/2;
			pos_y += preview.height/2;
				
			pos_x += (this.position[0] * zoom) - (this.size[0] * zoom) / 2;
			pos_y += (this.position[1] * zoom) - (this.size[1] * zoom) / 2;
	
			this.node.style.width = (this.size[0] * zoom) + 'px';
			this.node.style.height = (this.size[1] * zoom) + 'px';
			this.node.style.left = pos_x + 'px';
			this.node.style.top  = pos_y + 'px';

		} else {
			this.node.style.width = this.size[0] + 'px';
			this.node.style.height = this.size[1] + 'px';
			this.node.style.left = (Math.clamp(this.position[0], 0, this.node.parentNode.clientWidth) - this.size[0]/2) + 'px';
			this.node.style.top  = (Math.clamp(this.position[1], 0, this.node.parentNode.clientHeight) - this.size[1]/2) + 'px';
		}
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
			addEventListeners(corner, 'mousedown touchstart', e1 => {
				convertTouchEvent(e1);

				let original_position = this.position.slice();
				let original_size = this.size.slice();

				let move = (e2) => {
					convertTouchEvent(e2);
					let offset = [
						(e2.clientX - e1.clientX),
						(e2.clientY - e1.clientY),
					];
					this.size[0] = Math.max(original_size[0] + offset[0] * sign_x, 48);
					this.position[0] = original_position[0] + offset[0] / 2, 0;

					if (!e2.ctrlOrCmd && !Pressing.overrides.ctrl) {
						//offset[0] = offset[1] * this.aspect_ratio * Math.sign(offset[1]) * Math.sign(offset[0]);
						// todo: keep aspect ratio;
						offset[1] = sign_y * (this.size[0] / this.aspect_ratio - original_size[1]);
					}

					this.size[1] = Math.max(original_size[1] + offset[1] * sign_y, 32);
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
		function addButton(id, icon, click) {
			let node = Interface.createElement('div', {class: 'tool', tool_id: id}, Blockbench.getIconNode(icon));
			self.toolbar.append(node);
			node.onclick = click;
		}

		addButton('layer', 'flip_to_front', () => {
			// todo: layer menu
		});
		
		addButton('flip_x', 'icon-mirror_x', () => {
			self.flip_x = !self.flip_x;
			self.update().save();
		});
		
		addButton('flip_y', 'icon-mirror_y', () => {
			self.flip_y = !self.flip_y;
			self.update().save();
		});
		
		this.opacity_slider = new NumSlider({
			id: 'slider_reference_image_opacity',
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
		
		addButton('visibility', 'visibility', () => {
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
				this.propertiesDialog();
			})
			this._edit_events_initialized = true;
		}
		return this;
	}
	projectMouseCursor(x, y) {
		if (!this.resolveCondition() || !this.visibility) return false;

		let rect = this.img.getBoundingClientRect();
		if (x > rect.x && y > rect.y && x < rect.right && y < rect.bottom) {
			let lerp_x = Math.getLerp(rect.x, rect.right,  x);
			let lerp_y = Math.getLerp(rect.y, rect.bottom, y);
			if (this.flip_x) lerp_x = 1 - lerp_x;
			if (this.flip_y) lerp_y = 1 - lerp_y;
			return [
				Math.floor(Math.min(lerp_x, 0.9999) * this.img.naturalWidth),
				Math.floor(Math.min(lerp_y, 0.9999) * this.img.naturalHeight),
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
			let result = await new Promise(resolve => Blockbench.showMessageBox({
				title: 'Reference Image',
				message: 'Are you sure you want to delete this reference image? This cannot be undone.',
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
		this.node.remove();
	}
	changeLayer(layer) {
		if (layer == this.layer) return;
		if (layer == 'blueprint' && Preview.selected?.angle) {
			this.attached_side = Preview.selected.angle;
			this.position.V2_set(0, 0);
		}
		this.layer = layer;
	}
	changeScope() {
		// todo
	}
	propertiesDialog() {
		new Dialog('reference_image_properties', {
			title: 'Reference Image',
			form: {
				source: {type: 'file', label: 'Image', condition: () => isApp && PathModule.isAbsolute(this.source), value: this.source, extensions: ['png', 'jpg', 'jpeg']},
				layer: {type: 'select', label: 'Layer', value: this.layer, options: {
					background: 'Behind Model',
					viewport: 'Above Model',
					float: 'Above Interface',
					blueprint: 'Locked Blueprint',
				}},
				scope: {type: 'select', label: 'Scope', value: this.scope, options: {
					project: 'Save per project',
					global: 'Save in Blockbench',
				}},
				position: {type: 'vector', label: 'Position', dimensions: 2, value: this.position},
				size: {type: 'vector', label: 'Size', dimensions: 2, value: this.size},
				rotation: {type: 'number', label: 'Rotation', value: this.rotation},
				opacity: {type: 'range', label: 'Opacity', editable_range_label: true, value: this.opacity, min: 0, max: 1}
			},
			onConfirm: (result) => {
				let clear_mode_before = this.clear_mode;
				this.changeLayer(result.layer);
				this.changeScope(result.scope);
				this.extend(result);
				if (this.clear_mode != clear_mode_before) {
					this.updateClearMode();
				}
				this.update().save();
			}
		}).show();
		return this;
	}
}
ReferenceImage.prototype.menu = new Menu([
	/**
	Type
	Visibility
	 */
	{
		id: 'clear_mode',
		name: 'Clear Mode',
		icon: (ref) => ref.clear_mode,
		condition: ref => ref.layer == 'blueprint',
		click(ref) {
			ref.clear_mode = !ref.clear_mode;
			ref.updateClearMode();
			ref.update().save();
		}
	},
	{
		name: 'Layer',
		icon: 'list',
		children: (reference) => {
			let layers = {
				background: 'Behind Model',
				viewport: 'Above Model',
				float: 'Above Interface',
				blueprint: 'Locked Blueprint',
			}
			let children = [];
			for (let key in layers) {
				children.push({
					id: key,
					name: layers[key],
					icon: reference.layer == key ? 'radio_button_checked' : 'radio_button_unchecked',
					click() {
						reference.changeLayer(key);
						reference.update();
					}
				})
			}
			return children;
		}
	},
	'_',
	'delete',
	'_',
	{
		name: 'Properties...',
		icon: 'list',
		click(instance, b) {
			instance.propertiesDialog();
		}
	}
])

new Property(ReferenceImage, 'string', 'name', {default: 'Reference'});
new Property(ReferenceImage, 'string', 'layer', {default: 'float'}); // reference, blueprint
new Property(ReferenceImage, 'string', 'scope', {default: 'global'}); // reference, blueprint
new Property(ReferenceImage, 'vector2', 'position');
new Property(ReferenceImage, 'vector2', 'size', {default: [400, 300]});
new Property(ReferenceImage, 'boolean', 'flip_x');
new Property(ReferenceImage, 'boolean', 'flip_y');
new Property(ReferenceImage, 'number', 'rotation');
new Property(ReferenceImage, 'number', 'opacity', {default: 1});
new Property(ReferenceImage, 'boolean', 'visibility', {default: true});
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


const ReferenceImageMode = {
	/**
	TODO
	x display background images ( no vue :( ))
	x selected display mode with handles and stuff
	x save in project
	x convert old background images to reference images
	x Add buttons to join and exit editing mode
	x Implement toolbar
	  Implement blueprint mode (locked to camera)
	  Implement display mode references
	x Start editing references when double clicking preview back
	x Integrate color picker
	 */
	active: false,
	toolbar: null,
	activate() {
		ReferenceImageMode.active = true;
		Interface.work_screen.classList.add('reference_image_mode');
		Interface.work_screen.append(ReferenceImageMode.toolbar.node);
		ReferenceImage.updateAll();
		if (!ReferenceImage.selected && ReferenceImage.active[0]) {
			ReferenceImage.active[0].select();
		}
	},
	deactivate() {
		ReferenceImageMode.active = false;
		if (ReferenceImage.selected) ReferenceImage.selected.unselect();
		Interface.work_screen.classList.remove('reference_image_mode');
		ReferenceImageMode.toolbar.node.remove();
		ReferenceImage.updateAll();
	},
	async importReferences(files) {
		let save_mode = await new Promise(resolve => {
			let icon = new Image();
			icon.src = files[0].content;
			Blockbench.showMessageBox({
				title: 'action.add_reference_image',
				message: 'Select where to load the reference image',
				icon,
				commands: {
					project: 'Save in project',
					app: 'Save in Blockbench',
				}
			}, resolve)
		})
		files.forEach(file => {
			let ref = new ReferenceImage({source: file.content, name: file.name});
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
				extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'],
				type: 'Image',
				readtype: 'image'
			}, async function(files) {
				ReferenceImageMode.importReferences(files);
			}, 'image', false)
		}
	});
	new Action('reference_image_list', {
		icon: 'list',
		category: 'view',
		click(e) {
			new Menu('apply_display_preset', this.children(), {searchable: false}).open(e.target, 'wrong context');
		},
		children() {
			let list = [];
			function getSubMenu(reference) {
				return [
					/**
					 * Center
					 * Reset
					 */
					{
						name: 'Properties...',
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
					icon: 'settings',
					children: getSubMenu(reference)
				});
			});
			return list;
		}
	});
	new Action('search_reference_image', {
		icon: 'image_search',
		category: 'view',
		condition: isApp,
		click() {
			if (!ReferenceImageMode.active) {
				ReferenceImageMode.activate()
			}

			let window = new electron.BrowserWindow({
				icon: 'icon.ico',
				modal: true,
				parent: currentwindow,
				width: 1080,
				height: 720,
				menuBarVisible: false,
			})
			if (process.platform !== 'darwin') {
				window.setMenu(null);
			}
			window.loadURL('https://google.com/images');
			
			window.webContents.on('context-menu', (event, url, response, text) => {
				window.close();
				
				ReferenceImageMode.importReferences([{content: url.srcURL, name: url.altText.substring(0, 24)}]);
			})
		}
	});
})

Interface.definePanels(function() {
	ReferenceImageMode.toolbar = new Toolbar('reference_images', {
		children: [
			'add_reference_image',
			'search_reference_image',
			'reference_image_list',
		]
	})
})