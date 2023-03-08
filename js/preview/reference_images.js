class ReferenceImage {
	constructor(data = {}) {

		this.name = '';
		this.type = '';
		this.scope = '';
		this.position = [0, 0];
		this.size = [0, 0];
		this.flip_x = false;
		this.flip_y = false;
		this.rotation = 0;
		this.z_layer = 0;
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

		this.image_is_loaded = false;
		this.auto_aspect_ratio = true;
		this.img.onload = () => {
			this.image_is_loaded = true;
			if (this.auto_aspect_ratio) {
				let original_size = this.size[1];
				this.size[1] = this.size[0] / this.aspect_ratio;
				if (original_size != this.size[1]) this.update();
			}
		}
		this.img.onerror = () => {
			this.image_is_loaded = false;
		}

		this.extend(data);
	}
	/*get image() {
		return this._image;
	}
	set image(path) {
		this._image = path;
		if (typeof this._image == 'string') {
			this.img.src = this._image.replace(/#/g, '%23');
		}
	}*/
	get aspect_ratio() {
		if (this.img && this.img.naturalWidth && this.img.naturalHeight) {
			return this.img.naturalWidth / this.img.naturalHeight;
		} else {
			return 1;
		}
	}
	extend(data) {
		console.log(data)
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
	addAsReference() {
		Project.reference_images.push(this);
		this.scope = 'project';
		this.update();
		return this;
	}
	addAsGlobalReference() {
		ReferenceImage.global.push(this);
		this.scope = 'global';
		this.update();
		return this;
	}
	addAsBuiltIn() {
		ReferenceImage.built_in.push(this);
		this.scope = 'built_in';
		this.update();
		return this;
	}
	select(force) {
		if (!force && this.selected) return;
		if (ReferenceImage.selected && ReferenceImage.selected != this) {
			ReferenceImage.selected.unselect();
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
				ReferenceImage.global.remove(this);
				break;
			case 'built_in':
				ReferenceImage.built_in.remove(this);
				break;
		}
		return this;
	}
	update() {
		if (!Interface.preview) return;
		let shown = Condition(this.condition);// && this.visibility;
		// update position
		if (!shown) {
			this.node.remove();
			return;
		}

		if (this.type == 'reference') {
			Interface.preview.append(this.node);
		}

		this.node.style.width = this.size[0] + 'px';
		this.node.style.height = this.size[1] + 'px';
		this.node.style.left = (this.position[0] - this.size[0]/2) + 'px';
		this.node.style.top = (this.position[1] - this.size[1]/2) + 'px';
		this.img.style.display = (this.visibility && this.image_is_loaded) ? 'block' : 'none';
		this.img.style.opacity = this.opacity;

		let transforms = [];
		if (this.rotation) transforms.push(`rotate(${this.rotation}deg)`);
		if (this.flip_x) transforms.push('scaleX(-1)');
		if (this.flip_y) transforms.push('scaleY(-1)');
		this.img.style.transform = transforms.join(' ');

		if (this.img.src != this.source) this.img.src = this.source;


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
		return this;
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
					//console.log(...offset)
					this.size[0] = Math.max(original_size[0] + offset[0] * sign_x, 48);
					this.position[0] = original_position[0] + offset[0] / 2;


					if (!e2.ctrlOrCmd && !Pressing.overrides.ctrl) {
						//offset[0] = offset[1] * this.aspect_ratio * Math.sign(offset[1]) * Math.sign(offset[0]);
						// todo: keep aspect ratio;
						offset[1] = sign_y * (this.size[0] / this.aspect_ratio - original_size[1]);
					}

					this.size[1] = Math.max(original_size[1] + offset[1] * sign_y, 32);
					this.position[1] = original_position[1] + offset[1] / 2;

					this.update();
				}
				let stop = (e2) => {
					convertTouchEvent(e2);
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
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
		function addButton(icon, click) {
			let node = Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode(icon));
			self.toolbar.append(node);
			node.onclick = click;
		}
		addButton('wallpaper', () => {

		});
		
		addButton('lock', () => {

		});
		
		addButton('icon-mirror_x', () => {
			console.log('flip')
			self.flip_x = !self.flip_x;
			self.update().save();
		});
		
		addButton('icon-mirror_y', () => {
			self.flip_y = !self.flip_y;
			self.update().save();
		});
		
		addButton('flip_to_front', () => {

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
		
		addButton('visibility', () => {
			self.visibility = !self.visibility;
			self.update();
		});

		if (!this._edit_events_initialized) {
			addEventListeners(this.node, 'mousedown touchstart', e1 => {
				if (!e1.target.classList.contains('reference_image')) return;
				convertTouchEvent(e1);

				let original_position = this.position.slice();

				let move = (e2) => {
					convertTouchEvent(e2);
					let offset = [
						(e2.clientX - e1.clientX),
						(e2.clientY - e1.clientY),
					];
					this.position[0] = original_position[0] + offset[0];
					this.position[1] = original_position[1] + offset[1];

					this.update();
				}
				let stop = (e2) => {
					convertTouchEvent(e2);
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(document, 'mousemove touchmove', move);
				addEventListeners(document, 'mouseup touchend', stop);
			})
			this._edit_events_initialized = true;
		}
		/*
		Resize handles
		Buttons
			Switch Z layer
			Flip X and Y?
			visibility
			opacity

		*/
		return this;
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
	propertiesDialog() {
		new Dialog('reference_image_properties', {
			title: 'Reference Image',
			form: {
				path: {type: 'file', label: 'Image',  extensions: ['png', 'jpg', 'jpeg']},
				type: {type: 'select', label: 'Type', options: {
					reference: 'Reference Image',
					blueprint: 'Blueprint',
				}},
				scope: {type: 'select', label: 'Scope', options: {
					project: 'Save per project',
					global: 'Save in Blockbench',
				}},
				position: {type: 'vector', label: 'Position', dimensions: 2, value: this.position},
				size: {type: 'vector', label: 'Size', dimensions: 2, value: this.size},
				rotation: {type: 'number', label: 'Rotation', value: this.rotation},
				opacity: {type: 'range', label: 'Opacity', editable_range_label: true, value: this.opacity, min: 0, max: 1}
			}
		}).show();
		return this;
	}
}
ReferenceImage.prototype.menu = new Menu([
	/**
	Type

	 */
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
new Property(ReferenceImage, 'string', 'type', {default: 'reference'}); // reference, blueprint
new Property(ReferenceImage, 'string', 'scope', {default: 'global'}); // reference, blueprint
new Property(ReferenceImage, 'vector2', 'position');
new Property(ReferenceImage, 'vector2', 'size', {default: [400, 300]});
new Property(ReferenceImage, 'boolean', 'flip_x');
new Property(ReferenceImage, 'boolean', 'flip_y');
new Property(ReferenceImage, 'number', 'rotation');
new Property(ReferenceImage, 'number', 'z_layer');
new Property(ReferenceImage, 'number', 'opacity', {default: 1});
new Property(ReferenceImage, 'boolean', 'visibility', {default: true});
new Property(ReferenceImage, 'boolean', 'clear_mode');
new Property(ReferenceImage, 'number', 'attached_side');
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
		return ReferenceImage.all.filter(ref => Condition(ref.condition));
	}
})

ReferenceImage.updateAll = function() {
	ReferenceImage.all.forEach(ref => {
		ref.update();
	})
}


const ReferenceImageMode = {
	/**
	TODO
	x display background images ( no vue :( ))
	x selected display mode with handles and stuff
	x save in project
	x convert old background images to reference images
	x Add buttons to join and exit editing mode
	. Implement list of backgrounds (panel?)
	  Implement blueprint mode (locked to camera)
	  Implement display mode references
	  Start editing references when double clicking preview back
	  Integrate color picker
	 */
	active: false,
	activate() {
		ReferenceImageMode.active = true;
		Interface.work_screen.classList.add('reference_image_mode');
		ReferenceImage.updateAll();
		updateInterfacePanels();
	},
	deactivate() {
		ReferenceImageMode.active = false;
		if (ReferenceImage.selected) ReferenceImage.selected.unselect();
		Interface.work_screen.classList.remove('reference_image_mode');
		ReferenceImage.updateAll();
		updateInterfacePanels();
	}
}

let r = new ReferenceImage({source: 'assets/splash_art.png?20'}).addAsGlobalReference();


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
						ref.addAsReference();
					} else {
						ref.addAsGlobalReference();
					}
					ref.select();
				})
			}, 'image', false)
		}
	});
})