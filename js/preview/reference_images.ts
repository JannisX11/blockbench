import { Filesystem } from "../file_system";
import { FormResultValue } from "../interface/form";
import { CSS3DObject } from "../lib/CSS3DRenderer";
import { clipboard } from "../native_apis";
import { addEventListeners, getAverageRGB } from "../util/util";
import { Preview } from "./preview";

export type ReferenceImageViewMode = 'flat_image' | 'billboard';
export type ReferenceImageLayer = 'background' | 'viewport' | 'float' | 'blueprint';
export type ReferenceImageScope = 'project' | 'global' | 'built_in';

interface ReferenceImageOptions {
	name?: string
	layer?: ReferenceImageLayer
	scope?: string
	is_blueprint?: boolean
	view_mode?: ReferenceImageViewMode
	condition?: ConditionResolvable;
	position?: ArrayVector2
	size?: ArrayVector2
	billboard_position?: ArrayVector3
	billboard_rotation?: ArrayVector3
	flip_x?: boolean
	flip_y?: boolean
	rotation?: number
	opacity?: number
	visibility?: boolean
	sync_to_timeline?: boolean
	cull_backface?: boolean
	clear_mode?: boolean
	attached_side?: string
	source?: string
	modes?: string[]
}

export class ReferenceImage {
	name: string = '';
	layer: ReferenceImageLayer = 'background';
	scope: ReferenceImageScope = 'project';
	view_mode: ReferenceImageViewMode = 'flat_image';
	is_blueprint: boolean = false;
	position: number[] = [0, 0];
	size: number[] = [0, 0];
	flip_x: boolean = false;
	flip_y: boolean = false;
	rotation: number = 0;
	billboard_position?: ArrayVector3
	billboard_rotation?: ArrayVector3
	opacity: number = 0;
	visibility: boolean = true;
	sync_to_timeline: boolean = true;
	cull_backface: boolean = false;
	clear_mode: boolean = false;
	attached_side: string = '';
	source: string = '';
	modes: string[] = [];
	uuid: string;
	cache_version: number = 0;
	condition: ConditionResolvable;
	toolbar: HTMLElement
	/**@private */
	_edit_events_initialized?: boolean
	/**@private */
	_modify_nodes: any[];
	removed?: true;
	defaults: {};
	dark_background: boolean = false;
	image_is_loaded: boolean = false;
	auto_aspect_ratio: boolean = true;
	is_video: boolean = false;
	node: HTMLDivElement;
	img: HTMLImageElement;
	video: HTMLVideoElement & {_loading?: boolean, ref_source?: any};
	scene_object: CSS3DObject;
	declare public menu: Menu

	constructor(data: ReferenceImageOptions = {}) {		
		this.uuid = guid();
		this.condition = data.condition;

		for (let key in ReferenceImage.properties) {
			ReferenceImage.properties[key].reset(this);
		}
		this.position.V2_set(Interface.preview.clientWidth/2, Interface.preview.clientHeight/2);

		this._modify_nodes = [];
		this.defaults = data;

		if (data.source && ['mp4', 'wmv', 'mov'].includes(pathToExtension(data.source))) {
			this.is_video = true;
		}
		this.node = Interface.createElement('div', {class: 'reference_image'}) as HTMLDivElement;
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
			}) as HTMLVideoElement;
			this.video.muted = true;
			addEventListeners(this.node, 'mousedown mousemove', (event: MouseEvent | PointerEvent) => {
				// Enable pointer events for controls section
				let from_bottom = this.video.clientHeight - event.offsetY;
				this.video.style.pointerEvents = from_bottom < 62 ? 'auto' : '';
			})
			this.video.append(Interface.createElement('source', {type: `video/mp4`}))
			this.node.append(this.video);
			this.image_is_loaded = true;
		} else {
			this.node.append(this.img);
		}
		this.scene_object = new CSS3DObject(this.node);
		switch (Format.forward_direction) {
			case '-z': this.billboard_rotation[1] = 180; this.billboard_position[2] = Format.block_size; break;
			case '+z': this.billboard_rotation[1] = 0; this.billboard_position[2] = -Format.block_size; break;
			case '-x': this.billboard_rotation[1] = -90; this.billboard_position[0] = Format.block_size; break;
			case '+x': this.billboard_rotation[1] = 90; this.billboard_position[0] = -Format.block_size; break;
		}

		let onload = () => {
			let was_image_loaded = this.image_is_loaded;
			this.image_is_loaded = true;

			if (this.is_video && this.video) this.video.pause();

			if (this.auto_aspect_ratio) {
				let original_size = this.size.slice();
				if (this.aspect_ratio > 1) {
					this.size[1] = this.size[0] / this.aspect_ratio;
				} else {
					this.size[0] = this.size[1] * this.aspect_ratio;
				}
				if (original_size.equals(this.size) == false) this.update();

			} else if (!was_image_loaded) {
				this.update();
			}
			this.updateClearMode();
		}
		if (this.is_video) {
			this.video.addEventListener('loadeddata', onload);
		} else {
			this.img.onload = onload;
		}
		this.img.onerror = () => {
			this.image_is_loaded = false;
		}

		this.extend(data);
	}
	get aspect_ratio(): number {
		return this.source_width / this.source_height;
	}
	get source_width(): number {
		return (this.is_video ? this.video.videoWidth : this.img.naturalWidth) || 16;
	}
	get source_height(): number {
		return (this.is_video ? this.video.videoHeight : this.img.naturalHeight) || 16;
	}
	extend(data: ReferenceImageOptions) {
		if (data.size instanceof Array) this.auto_aspect_ratio = false;

		if (data.layer == 'blueprint') {
			data.layer = 'background';
			data.is_blueprint = true;
		}

		if (data.modes instanceof Array) {
			this.modes.replace(data.modes);
		}

		for (let key in ReferenceImage.properties) {
			ReferenceImage.properties[key].merge(this, data)
		}
		if (data.is_blueprint) {
			this.enableBlueprintMode();
		}
	}
	getSaveCopy(): ReferenceImageOptions {
		let copy: ReferenceImageOptions = {};
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
		// @ts-expect-error
		if (this.modes.length && !this.modes.includes(Modes.selected.id)) return false;
		if (this.is_blueprint) {
			return Preview.all.find(p => p.isOrtho && p.angle == this.attached_side) !== undefined;
		}
		return true;
	}
	addAsReference(save: boolean = false) {
		Project.reference_images.push(this);
		if (Preview.selected && Preview.selected.angle) {
			this.enableBlueprintMode();
			this.changeLayer('background');
		}
		if (Format.image_editor) {
			this.changeLayer('viewport');
		}
		this.scope = 'project';
		this.update();
		if (save) this.save();
		return this;
	}
	addAsGlobalReference(save: boolean = false) {
		ReferenceImage.global.push(this);
		if (Preview.selected && Preview.selected.angle) {
			this.enableBlueprintMode();
			this.changeLayer('background');
		}
		if (Format.image_editor) {
			this.changeLayer('viewport');
		}
		this.scope = 'global';
		this.update();
		if (save) this.save();
		return this;
	}
	addAsBuiltIn(save: boolean = false) {
		ReferenceImage.built_in.push(this);
		this.scope = 'built_in';
		this.update();
		if (save) this.save();
		return this;
	}
	select(force: boolean = false): this {
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
	unselect(): this {
		if (ReferenceImage.selected == this) ReferenceImage.selected = null;
		this.update();
		return this;
	}
	get selected(): boolean {
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
			if (this.node) this.node.remove();
			if (this.scene_object) Canvas.scene.remove(this.scene_object);
			return this;
		}

		this.node.setAttribute('reference_layer', this.layer);
		if (this.view_mode == 'flat_image') {
			Canvas.scene.remove(this.scene_object);
			this.node.classList.remove('in_scene');
			this.node.style.zIndex = '';

			switch (this.layer) {
				case 'background':
				case 'viewport': {
					Interface.preview.querySelector('.clamped_reference_images').append(this.node);
					break;
				}
				case 'float': default: {
					Interface.work_screen.append(this.node);
					break;
				}
			}
		} else {
			Canvas.scene.add(this.scene_object);
			this.node.classList.add('in_scene');
			this.scene_object.backface_culling = this.cull_backface;
			let zindex = this.layer == 'background' ? '-1' : '1';
			this.node.style.zIndex = zindex;
			if (ReferenceImage.selected) zindex = '1';
			// Z index currently does not work per element, this is a temporary workaround
			Preview.selected.css_renderer.domElement.style.zIndex = zindex;
		}
		
		this.updateTransform();

		let image_content = this.is_video ? this.video : this.img;

		image_content.style.display = (this.visibility && this.image_is_loaded) ? 'block' : 'none';
		image_content.style.opacity = this.opacity.toString();

		let transforms = [];
		if (this.rotation) transforms.push(`rotate(${this.rotation}deg)`);
		if (this.flip_x) transforms.push('scaleX(-1)');
		if (this.flip_y) transforms.push('scaleY(-1)');
		image_content.style.transform = transforms.join(' ');

		let source = this.source + (this.cache_version ? ('?'+this.cache_version) : '');
		if (this.is_video) {
			if (this.video.ref_source != source) {
				this.video.ref_source = source;
				(this.video.firstElementChild as HTMLSourceElement).src = source;
				this.video.load();
			}
			this.video.controls = this.selected;
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
		if (this.selected) {
			if (this.view_mode == 'billboard') {
				Interface.preview.append(this.toolbar);
			} else {
				this.node.append(this.toolbar);
			}
		}

		// Unselect
		if (!this.selected && this._modify_nodes.length) {
			this.node.classList.remove('selected');
			this._modify_nodes.forEach(node => node.remove());
			this._modify_nodes.empty();
		}
		if (this.selected && this.toolbar) {
			this.toolbar.querySelector('.tool[tool_id=flip_x]').classList.toggle('enabled', this.flip_x);
			this.toolbar.querySelector('.tool[tool_id=flip_y]').classList.toggle('enabled', this.flip_y);
			this.toolbar.querySelector('.tool[tool_id=visibility]').classList.toggle('enabled', this.visibility);
			(this.toolbar.querySelector('.tool[tool_id=rotation]') as HTMLElement).style.display = this.view_mode == 'billboard' ? 'block' : 'none';
		}
		return this;
	}
	getZoomLevel() {
		let preview = this.is_blueprint && Preview.all.find(p => p.isOrtho && p.angle == this.attached_side);
		return preview ? preview.camOrtho.zoom * 2 : 1;
	}
	updateTransform() {
		if (!(this.node.isConnected || this.view_mode == 'billboard')) return;
		let preview = this.is_blueprint && Preview.all.find(p => p.isOrtho && p.angle == this.attached_side);
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
			this.node.style.clipPath = '';

			if (this.view_mode == 'flat_image') {
				let position = this.getClampedPosition();
				this.node.style.left = (position[0] - this.size[0]/2) + 'px';
				this.node.style.top  = (position[1] - this.size[1]/2) + 'px';

			} else if (this.view_mode == 'billboard') {
				this.node.style.left = '0';
				this.node.style.top  = '0';
				this.scene_object.discardCopyElements();
				this.scene_object.position.fromArray(this.billboard_position);
				this.scene_object.rotation.fromArray(this.billboard_rotation.map(v => Math.degToRad(v)));
				let scale = Format.block_size / 128;
				this.scene_object.scale.set(scale, scale, scale);
			}
		}
		return this;
	}
	getClampedPosition() {
		let edge_limit = [
			Math.min(0, -this.size[0]/2 + 50),
			Math.min(0, -this.size[1]/2 + 50)
		]
		let parent = this.node.parentNode as HTMLElement;
		return [
			Math.clamp(this.position[0], edge_limit[0], parent.clientWidth - edge_limit[0]),
			Math.clamp(this.position[1], edge_limit[1], parent.clientHeight - edge_limit[1])
		];
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
			const corner = Interface.createElement('div', {class: 'reference_image_resize_corner '+direction});
			const sign_x = direction[1] == 'e' ? 1 : -1;
			const sign_y = direction[0] == 's' ? 1 : -1;
			const multiplier = 1 / this.getZoomLevel();
			addEventListeners(corner, 'mousedown touchstart', (e1: MouseEvent) => {
				convertTouchEvent(e1);

				let original_position = this.position.slice();
				let original_size = this.size.slice();
				let local_sign_x = sign_x;
				let local_sign_y = sign_y;

				if (this.view_mode == 'billboard') {
					let corner_rect = corner.getBoundingClientRect();
					let ref_rect = this.node.getBoundingClientRect();
					let ref_center = [Math.lerp(ref_rect.left, ref_rect.right, 0.5), Math.lerp(ref_rect.top, ref_rect.bottom, 0.5)];
					if ((corner_rect.left > ref_center[0]) != (sign_x == 1)) {
						local_sign_x *= -1;
					}
					if ((corner_rect.top > ref_center[1]) != (sign_y == 1)) {
						local_sign_y *= -1;
					}
				}

				let move = (e2: MouseEvent) => {
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
					this.size[0] = Math.max(original_size[0] + offset[0] * local_sign_x, max_size[0]);
					this.position[0] = original_position[0] + offset[0] / 2, 0;

					if (!e2.ctrlOrCmd && !Pressing.overrides.ctrl) {
						offset[1] = local_sign_y * (this.size[0] / this.aspect_ratio - original_size[1]);
					}

					this.size[1] = Math.max(original_size[1] + offset[1] * local_sign_y, max_size[1]);
					this.position[1] = original_position[1] + offset[1] / 2, 0;

					if (!this.is_blueprint && this.view_mode == 'flat_image') {
						this.position.replace(this.getClampedPosition());
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
		addEventListeners(rotate_handle, 'mousedown touchstart', (e1: MouseEvent) => {
			convertTouchEvent(e1);

			let original_rotation = this.rotation;
			let offset = $(this.node).offset();
			let center = [
				offset.left + this.size[0]/2,
				offset.top  + this.size[1]/2,
			]
			let initial_angle = null;

			let move = (e2: MouseEvent) => {
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
			let stop = (e2: MouseEvent) => {
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

		let z_move_handle = Interface.createElement('div', {class: 'reference_image_z_handle'}, [
			Blockbench.getIconNode('north'),
			Blockbench.getIconNode('south'),
		]);
		this.node.append(z_move_handle);
		this._modify_nodes.push(z_move_handle);

		this.toolbar = Interface.createElement('div', {class: 'reference_image_toolbar'});
		this.node.append(this.toolbar);
		this._modify_nodes.push(this.toolbar);
		
		// Controls
		function addButton(id: string, name: string, icon: string, click: (event: MouseEvent) => void) {
			let node = Interface.createElement('div', {class: 'tool', tool_id: id}, Blockbench.getIconNode(icon));
			self.toolbar.append(node);
			node.onclick = click;
			BarItem.prototype.addLabel(false, {
				name: tl(name),
				node: node
			})
			return node;
		}

		addButton('layer', 'reference_image.layer', 'flip_to_front', (event) => {
			let layers = {
				background: 'reference_image.layer.background',
				viewport: 'reference_image.layer.viewport',
				float: 'reference_image.layer.float',
			}
			let options = Object.keys(layers).map(key => {
				return {
					name: layers[key],
					icon: this.layer == key ? 'far.fa-dot-circle' : 'far.fa-circle',
					click: () => {
						this.changeLayer(key as ReferenceImageLayer);
						this.update().save();
					}
				}
			})
			new Menu(options).open(event.target as HTMLElement);
		});
		
		addButton('flip_x', tl('action.flip', 'X'), 'icon-mirror_x', () => {
			self.flip_x = !self.flip_x;
			self.update().save();
		});
		
		addButton('flip_y', tl('action.flip', 'Y'), 'icon-mirror_y', () => {
			self.flip_y = !self.flip_y;
			self.update().save();
		});
		
		addButton('rotation', 'reference_image.rotation', '3d_rotation', (event: MouseEvent) => {
			let snap_sides = {
				north: [0, 0, 0],
				east: [0, -90, 0],
				south: [0, 180, 0],
				west: [0, 90, 0],
				bottom: [-90, 0, 0],
				top: [90, 0, 0],
			};
			function getRotationSide(vector: ArrayVector3): string {
				for (let key in snap_sides) {
					if (vector.equals(snap_sides[key])) {
						return key;
					}
				}
				return 'custom';
			}
			let dialog = new ConfigDialog('test', {
				title: 'Rotation',
				width: 360,
				form: {
					side: {
						label: 'Side',
						type: 'select',
						value: getRotationSide(self.billboard_rotation),
						options: {
							north: 'direction.north',
							east: 'direction.east',
							south: 'direction.south',
							west: 'direction.west',
							bottom: 'direction.bottom',
							top: 'direction.top',
							custom: 'Custom',
						}
					},
					vector: {
						label: 'Rotation',
						type: 'vector',
						dimensions: 3,
						step: 2.5,
						value: self.billboard_rotation,
					}
				}
			}).show();

			dialog.form.addListener('change', ({result, cause, changed_keys}) => {
				console.log({result, cause, changed_keys})
				if (changed_keys.includes('side')) {
					let value = snap_sides[result.side];
					if (value) {
						self.billboard_rotation.replace(value as ArrayVector3);
						dialog.form.setValues({vector: value}, false);
					}
				} else {
					self.billboard_rotation.replace(result.vector as ArrayVector3);
					let side = getRotationSide(result.vector as ArrayVector3);
					dialog.form.setValues({side}, false);
				}
				self.update().save();
			})

			let anchor_position = self.toolbar.getBoundingClientRect();
			let top = anchor_position.top - dialog.object.clientHeight - 4;
			let left = Math.lerp(anchor_position.left, anchor_position.right, 0.5) - dialog.object.clientWidth/2;
			dialog.object.style.top = top + 'px';
			dialog.object.style.left = left + 'px';
		});
		
		new NumSlider('slider_reference_image_opacity', {
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
			addEventListeners(this.node, 'mousedown touchstart', (e1: MouseEvent) => {
				let target_classes = (e1.target as HTMLElement).classList;
				if (!target_classes.contains('reference_image') && !target_classes.contains('reference_image_z_handle')) return;
				convertTouchEvent(e1);

				let original_position = this.position.slice();
				let original_b_position = this.billboard_position.slice();
				let original_b_rotation = this.billboard_rotation.slice();
				let zoom = this.getZoomLevel();
				let z_movement = target_classes.contains('reference_image_z_handle');

				let move = (e2: MouseEvent) => {
					convertTouchEvent(e2);
					let offset = [
						(e2.clientX - e1.clientX),
						(e2.clientY - e1.clientY),
					];

					if (this.view_mode == 'billboard') {
						let preview = Preview.selected;
						let control_scale = preview.calculateControlScale(this.scene_object.position);
						let vector = new THREE.Vector3(offset[0], -offset[1], 0).multiplyScalar(control_scale / 14);
						vector.applyQuaternion(preview.camera.quaternion)

						/*if (e2.ctrlOrCmd || Pressing.overrides.ctrl) {
							if (Math.abs(vector.x) > Math.abs(vector.y) && Math.abs(vector.x) > Math.abs(vector.z)) {
								vector.y = vector.z = 0;
							} else if (Math.abs(vector.y) > Math.abs(vector.z)) {
								vector.x = vector.z = 0;
							} else {
								vector.x = vector.y = 0;
							}
						}*/
						vector.applyQuaternion(this.scene_object.quaternion.clone().invert());
						if (z_movement) {
							vector.x = vector.y = 0;
						} else {
							vector.z = 0;
						}
						vector.applyQuaternion(this.scene_object.quaternion);

						this.billboard_position.replace(original_b_position);
						this.billboard_position.V3_add(vector);

					} else {
						this.position[0] = original_position[0] + offset[0] / zoom;
						this.position[1] = original_position[1] + offset[1] / zoom;

						if (!this.is_blueprint) {
							this.position.replace(this.getClampedPosition());
						}
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
	projectMouseCursor(x: number, y: number): boolean | ArrayVector2 {
		if (!this.resolveCondition() || !this.visibility) return false;

		if (this.view_mode == 'billboard') {
			let pointerevents = this.node.style.pointerEvents;
			this.node.style.pointerEvents = 'all';
			let hits = document.elementsFromPoint(x, y);
			this.node.style.pointerEvents = pointerevents;
			return hits.includes(this.node);
		}

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
	openContextMenu(event: MouseEvent) {
		this.menu.open(event, this);
		return this;
	}
	reset() {
		return this;
	}
	async delete(force = false) {
		if (!force) {
			let icon: string | HTMLImageElement;
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
		if (this.scene_object) this.scene_object.removeFromParent();
		this.node.remove();
	}
	changeLayer(layer: ReferenceImageLayer): this {
		if (layer == this.layer) return;

		if (this.is_blueprint) this.is_blueprint = false;
		if (layer == 'float' || this.layer == 'float') {
			let preview_offset = $(Interface.preview).offset();
			let workscreen_offset = $(Interface.work_screen).offset();
			let sign = layer == 'float' ? 1 : -1;
			
			this.position[0] += (preview_offset.left - workscreen_offset.left) * sign;
			this.position[1] += (preview_offset.top - workscreen_offset.top) * sign;
		}
		if (this.view_mode == 'billboard') {
			ReferenceImage.active.forEach(ref => {
				if (ref.view_mode == 'billboard') ref.layer = layer;
			})
		}
		this.layer = layer;
		return this;
	}
	changeScope(new_scope: ReferenceImageScope): this {
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
	enableBlueprintMode(): this {
		if (this.is_blueprint) return this;
		if (Preview.selected?.angle) {
			this.is_blueprint = true;
			if (this.layer == 'float') this.changeLayer('viewport');
			this.attached_side = Preview.selected.angle;
			this.position.V2_set(0, 0);
		}
		return this;
	}
	propertiesDialog(): this {
		new Dialog('reference_image_properties', {
			title: 'data.reference_image',
			form: {
				source: {type: 'file', label: 'reference_image.image',
					condition: () => isApp && this.source && PathModule.isAbsolute(this.source),
					value: this.source,
					extensions: this.is_video ? ReferenceImage.video_extensions : ReferenceImage.supported_extensions
				},
				view_mode: {type: 'inline_select', label: 'reference_image.view_mode', value: this.view_mode, options: {
					flat_image: 'reference_image.view_mode.flat_image',
					billboard: 'reference_image.view_mode.billboard',
				}},
				layer: {type: 'select', label: 'reference_image.layer', value: this.layer, options: {
					background: 'reference_image.layer.background',
					viewport: 'reference_image.layer.viewport',
					float: 'reference_image.layer.float',
				}},
				scope: {type: 'select', label: 'reference_image.scope', value: this.scope, options: {
					project: 'reference_image.scope.project',
					global: 'reference_image.scope.global',
				}},
				position: {type: 'vector', label: 'reference_image.position', dimensions: 2, value: this.position, condition: (form) => form.view_mode == 'flat_image'},
				billboard_position: {type: 'vector', label: 'reference_image.position', dimensions: 3, value: this.billboard_position, condition: (form) => form.view_mode == 'billboard'},
				size: {type: 'vector', label: 'reference_image.size', dimensions: 2, linked_ratio: true, value: this.size},
				rotation: {type: 'number', label: 'reference_image.rotation', value: this.rotation},
				opacity: {type: 'range', label: 'reference_image.opacity', editable_range_label: true, value: this.opacity * 100, min: 0, max: 100, step: 1},
				visibility: {type: 'checkbox', label: 'reference_image.visibility', value: this.visibility},
				sync_to_timeline: {type: 'checkbox', label: 'reference_image.sync_to_timeline', value: this.sync_to_timeline, condition: this.is_video && Format.animation_mode},
				cull_backface: {type: 'checkbox', label: 'reference_image.cull_backface', value: this.cull_backface, condition: (form) => form.view_mode == 'billboard'},
				//is_blueprint: {type: 'checkbox', label: 'reference_image.blueprint', value: this.is_blueprint, condition: () => Preview.selected.angle},
				clear_mode: {type: 'checkbox', label: 'reference_image.clear_mode', value: this.clear_mode},
			},
			onConfirm: (result) => {
				if (this.removed) return;
				let clear_mode_before = this.clear_mode;
				this.extend({
					source: result.source,
					//is_blueprint: result.is_blueprint,
					view_mode: result.view_mode,
					position: result.position,
					billboard_position: result.billboard_position,
					size: result.size,
					rotation: result.rotation,
					opacity: result.opacity / 100,
					visibility: result.visibility,
					sync_to_timeline: result.sync_to_timeline,
					cull_backface: result.cull_backface,
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

	static properties: Record<string, Property> = {};
	static supported_extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif', 'mp4', 'wmv', 'mov'];
	static image_extensions = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif'];
	static video_extensions = ['mp4', 'wmv', 'mov'];

	declare static all: ReferenceImage[];
	declare static active: ReferenceImage[];
	declare static current_project: ReferenceImage[];
	static selected: ReferenceImage | null = null;
	static built_in: ReferenceImage[] = [];
	static global: ReferenceImage[] = [];
	static updateAll(): void {
		ReferenceImage.all.forEach(ref => {
			ref.update();
		})
	}
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
		condition: (ref) => ref.is_video && Format.animation_mode,
		icon: (ref) => ref.sync_to_timeline,
		click(ref) {
			ref.sync_to_timeline = !ref.sync_to_timeline;
			ref.update().save();
		}
	},
	/*{
		id: 'blueprint',
		name: 'reference_image.blueprint',
		icon: (ref) => ref.is_blueprint,
		click(ref) {
			if (ref.is_blueprint) {
				ref.is_blueprint = false;
			} else {
				ref.enableBlueprintMode();
			}
			ref.update().save();
		}
	},*/
	{
		id: 'clear_mode',
		name: 'reference_image.clear_mode',
		icon: (ref) => ref.clear_mode,
		//condition: ref => ref.is_blueprint,
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
		name: 'reference_image.view_mode',
		icon: 'pin_end',
		children: (reference) => {
			let view_mode = {
				flat_image: 'reference_image.view_mode.flat_image',
				billboard: 'reference_image.view_mode.billboard',
			}
			let children = [];
			for (let key in view_mode) {
				children.push({
					id: key,
					name: view_mode[key],
					icon: reference.view_mode == key ? 'far.fa-dot-circle' : 'far.fa-circle',
					click() {
						reference.view_mode = key;
						reference.update().save();
					}
				})
			}
			return children;
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
new Property(ReferenceImage, 'boolean', 'is_blueprint');
new Property(ReferenceImage, 'enum', 'view_mode', {default: 'flat_image'});
new Property(ReferenceImage, 'vector2', 'position');
new Property(ReferenceImage, 'vector2', 'size', {default: [400, 300]});
new Property(ReferenceImage, 'vector', 'billboard_position');
new Property(ReferenceImage, 'vector', 'billboard_rotation');
new Property(ReferenceImage, 'boolean', 'flip_x');
new Property(ReferenceImage, 'boolean', 'flip_y');
new Property(ReferenceImage, 'number', 'rotation');
new Property(ReferenceImage, 'number', 'opacity', {default: 1});
new Property(ReferenceImage, 'boolean', 'visibility', {default: true});
new Property(ReferenceImage, 'boolean', 'sync_to_timeline', {default: true});
new Property(ReferenceImage, 'boolean', 'cull_backface', {default: false});
new Property(ReferenceImage, 'boolean', 'clear_mode');
new Property(ReferenceImage, 'string', 'attached_side', {default: 'north'});
new Property(ReferenceImage, 'string', 'source');

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


StateMemory.init('global_reference_images', 'array');
export async function initReferenceImages() {
	StateMemory.global_reference_images.forEach(template => {
		new ReferenceImage(template).addAsGlobalReference();
	});
}

SharedActions.add('delete', {
	condition: () => (ReferenceImageMode.active && !!ReferenceImage.selected),
	subject: 'reference_image',
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

export const ReferenceImageMode = {
	active: false,
	toolbar: null as Toolbar,
	activate(): void {
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
	deactivate(): void {
		ReferenceImageMode.active = false;
		if (ReferenceImage.selected) ReferenceImage.selected.unselect();
		Interface.work_screen.classList.remove('reference_image_mode');
		ReferenceImageMode.toolbar.node.remove();
		ReferenceImage.updateAll();
		BARS.updateConditions();
	},
	async importReferences(files: Filesystem.FileResult[]) {
		let options: any = await new Promise<Record<string, FormResultValue> | void>((resolve, reject) => {
			let icon = new Image();
			icon.src = files[0].content as string;
			icon.classList.add('reference_image_import_preview')

			new Dialog({
				id: 'add_reference_image',
				title: 'action.add_reference_image',
				lines: [icon],
				form: {
					view_mode: {
						type: 'inline_select',
						options: {
							flat_image: 'reference_image.view_mode.flat_image',
							billboard: 'reference_image.view_mode.billboard',
						}
					},
					layer: {type: 'select', label: 'reference_image.layer', value: 'background', options: {
						background: 'reference_image.layer.background',
						viewport: 'reference_image.layer.viewport',
						float: 'reference_image.layer.float',
					}},
					global: {
						type: 'checkbox',
						label: 'message.add_reference_image.globally',
						value: false
					},
				},
				onFormChange(result) {
					icon.classList.toggle('billboard', result.view_mode == 'billboard');
				},
				onConfirm(result) {
					resolve(result);
				},
				onCancel() {
					resolve();
				}
			}).show();
		})
		if (!options) {
			ReferenceImageMode.deactivate();
			return;
		}
		files.forEach(file => {
			let ref = new ReferenceImage({
				source: file.content as string,
				name: file.name,
				view_mode: options.view_mode
			});
			if (Format.image_editor) {
				ref.layer = 'viewport';
			}
			if (options.global) {
				ref.addAsGlobalReference(true);
			} else {
				ref.addAsReference(true);
			}
			ref.select();
		})
	},
	saveGlobalReferences(): void {
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
			});
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
					ReferenceImageMode.importReferences([{content: image, name: 'Pasted', path: ''}]);
				}
			} else {
				navigator.clipboard.read().then(content => {
					if (content && content[0] && content[0].types.includes('image/png')) {
						content[0].getType('image/png').then(blob => {
							let url = URL.createObjectURL(blob);
							if (image.length > 32) {
								ReferenceImageMode.importReferences([{content: url, name: 'Pasted', path: ''}]);
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
			let menu = new Menu('apply_display_preset', this.children(), {searchable: false});
			menu.open(e.target as HTMLElement, 'wrong context');
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
										reference.modes.forEachReverse((mode: string) => {
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

const global = {
	ReferenceImage,
	ReferenceImageMode,
};
declare global {
	const ReferenceImage: typeof global.ReferenceImage
	type ReferenceImage = import('./reference_images').ReferenceImage
	const ReferenceImageMode: typeof global.ReferenceImageMode
	interface BarItemRegistry {
		edit_reference_images: Action
		add_reference_image: Action
		reference_image_from_clipboard: Action
		toggle_all_reference_images: Action
		reference_image_list: Action
	}
}
Object.assign(window, global);
