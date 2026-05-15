
export function setProjectResolution(width: number, height: number, modify_uv: boolean = false) {
	if (Project.texture_width / width != Project.texture_width / height) {
		modify_uv = false;
	}

	let textures = Format.per_texture_uv_size ? Texture.all : undefined;

	Undo.initEdit({uv_mode: true, elements: Cube.all, uv_only: true, textures});

	let old_res = {
		x: Project.texture_width,
		y: Project.texture_height
	}
	Project.texture_width = width;
	Project.texture_height = height;

	if (modify_uv) {
		if (old_res.x != Project.texture_width && Math.areMultiples(old_res.x, Project.texture_width)) {
			adjustElementUVToResolution([
				Project.texture_width/old_res.x,
				Project.texture_height/old_res.y
			]);
		}
	}
	textures && textures.forEach(tex => {
		tex.uv_width = Project.texture_width;
		tex.uv_height = Project.texture_height;
	});

	Undo.finishEdit('Changed project resolution')
	Canvas.updateAllUVs()
	if (selected.length) {
		UVEditor.loadData()
	}
}

export function adjustElementUVToResolution(multiplier: ArrayVector2, elements = Outliner.elements, textures?: Texture[]) {
	for (let element of elements) {
		if ('faces' in element == false) continue;
		if (element instanceof Mesh) {
			for (let key in element.faces) {
				let face = element.faces[key];
				if (textures && !textures.includes(face.getTexture() as Texture)) continue;
				face.vertices.forEach(vertex_key => {
					if (face.uv[vertex_key]) {
						face.uv[vertex_key][0] *= multiplier[0];
						face.uv[vertex_key][1] *= multiplier[1];
					}
				})
			}

		} else if (element instanceof Cube && element.box_uv) {
			element.uv_offset[0] = Math.floor(element.uv_offset[0] * multiplier[0]);
			element.uv_offset[1] = Math.floor(element.uv_offset[1] * multiplier[1]);
		} else {
			for (let fkey in (element.faces as Record<string, Face>)) {
				let face = element.faces[fkey] as Face;
				if (textures && !textures.includes(face.getTexture() as Texture)) continue;
				face.uv[0] *= multiplier[0];
				face.uv[1] *= multiplier[1];
				face.uv[2] *= multiplier[0];
				face.uv[3] *= multiplier[1];
			}
		}
	}
}

export function editUVSizeDialog(options: {texture?: Texture, project?: boolean}): void {
	let old_size: ArrayVector2 = [Project.getUVWidth(options.texture), Project.getUVHeight(options.texture)];
	let textures: Texture[] | undefined = options.texture ? [options.texture] : undefined;
	if (options.texture && Texture.all.some(tex => tex.multi_selected)) {
		textures.safePush(...Texture.all.filter(tex => tex.multi_selected));
	}
	let element_backups: Record<string, any> = {};
	let group_backups: Record<string, any> = {};
	const elements = Outliner.elements.filter(element => isElementAffected(element));
	const groups = elements.length == Outliner.elements.length ? Group.all : [];

	// Form options
	const adjust_options = {
		adjust_uv: 'dialog.edit_uv_size.adjust.adjust_uv',
		adjust_scale: 'dialog.edit_uv_size.adjust.adjust_scale',
		keep: 'dialog.edit_uv_size.adjust.keep',
	}
	let target_text = tl('dialog.project.title');
	if (textures?.length > 1) {
		target_text = textures.length + ' ' + tl('dialog.edit_uv_size.result.textures');
	} else if (options.texture) {
		target_text = `${tl('data.texture')} ${(options.texture.name)}`;
	}
	type Results = {
		target: any
		target_size: ArrayVector2
		adjust: keyof typeof adjust_options
	}

	function isElementAffected(element: OutlinerElement): boolean {
		if ('faces' in element == false) return false;
		if (Format.per_texture_uv_size == false) return true;
		if (!textures || !textures.length) return true;
		for (let fkey in (element.faces as Record<string, Face>)) {
			let face = element.faces[fkey] as Face;
			if (textures.includes(face.getTexture() as Texture)) return true;
		}
		return false;
	}
	function changeElementUVs(multiplier: ArrayVector2, update_scale: boolean = false) {
		for (let element of elements) {
			if (!element_backups[element.uuid]) {
				element_backups[element.uuid] = element.getUndoCopy();
			} else {
				element.extend(element_backups[element.uuid]);
			}
		}
		for (let group of groups) {
			if (!group_backups[group.uuid]) {
				group_backups[group.uuid] = {origin: group.origin.slice()};
			} else {
				group.extend(group_backups[group.uuid]);
			}
		}
		adjustElementUVToResolution(multiplier, elements, textures);
		if (update_scale) {
			ModelScaler.scaleElements(elements, groups, multiplier[0], [0, 0, 0]);
		}
		Canvas.updateView({
			elements, element_aspects: {uv: true, transform: true, geometry: true},
			groups, group_aspects: {transform: update_scale}
		});
	}
	function revertElementChanges() {
		for (let element of elements) {
			if (!element_backups[element.uuid]) continue;
			element.extend(element_backups[element.uuid]);
			delete element_backups[element.uuid];
		}
		for (let group of groups) {
			if (group_backups[group.uuid]) {
				group.extend(group_backups[group.uuid]);
			}
		}
		Canvas.updateView({
			elements, element_aspects: {uv: true, transform: true, geometry: true},
			groups, group_aspects: {transform: true}
		});
	}
	function setValue(size: ArrayVector2) {
		if (options.texture && textures) {
			for (let texture of textures) {
				texture.uv_width = size[0];
				texture.uv_height = size[1];
			}
		} else {
			Project.texture_width = size[0];
			Project.texture_height = size[1];
		}
	}
	function getOutputText() {
		if (options.project) {
			return `${Project.texture_width} x ${Project.texture_height}`;
		} else {
			let texture = options.texture ?? Texture.getDefault();
			if (!texture) return '';
			let uv_size = texture.width / texture.getUVWidth();
			let x_value = uv_size * Format.block_size;
			let ratio = uv_size < 1 ? `1:${trimFloatNumber(1/uv_size)}` : `${trimFloatNumber(uv_size)}:1`;
			return `${trimFloatNumber(x_value, 2)}x - ${ratio}`;
		}
	}

	Undo.initEdit({
		textures,
		elements,
		groups
	});

	let dialog = new Dialog({
		id: 'edit_uv_size',
		title: 'dialog.edit_uv_size.title',
		darken: false,
		form: {
			target: {label: 'dialog.edit_uv_size.target', type: 'info', text: target_text},
			adjust: {type: 'select', label: 'dialog.edit_uv_size.adjust', options: adjust_options},
			target_size: {type: 'vector', label: 'Target UV Size', dimensions: 2, value: old_size, linked_ratio: true, min: 1, step: 1, force_step: true},
			preset: {type: 'buttons', label: ' ', buttons: [
				'dialog.edit_uv_size.preset.original',
				'dialog.edit_uv_size.preset.match_texture',
				'2x',
				'0.5x'
			], click(button) {
				if (button == 0) {
					dialog.form.setValues({target_size: old_size}, true);
				} else if (button == 1) {
					dialog.form.setValues({target_size: [options.texture?.width ?? 16, options.texture?.height ?? 16]}, true);
				} else {
					let current = (dialog.form.getResult() as Results).target_size;
					let factor = button == 2 ? 2 : 0.5;
					dialog.form.setValues({target_size: [current[0]*factor, current[1]*factor]}, true);
				}
			}},
			output: {type: 'info', label: 'dialog.edit_uv_size.result', text: getOutputText()},
		},
		onOpen() {
			let pos = window.innerHeight-this.object.clientHeight-50;
			this.object.style.top = pos + 'px';
		},
		onFormChange(result: Results) {
			setValue(result.target_size);

			dialog.form.form_data.output.bar.childNodes[1].textContent = getOutputText();

			if (result.adjust == 'adjust_uv' || result.adjust == 'adjust_scale') {
				let multiplier: ArrayVector2 = [
					result.target_size[0] / old_size[0],
					result.target_size[1] / old_size[1],
				];
				changeElementUVs(multiplier, result.adjust == 'adjust_scale');
			} else {
				Canvas.updateView({elements: Outliner.elements, element_aspects: {uv: true, transform: true, geometry: true}});
			}
			UVEditor.loadData();
		},
		onConfirm(result: Results) {
			Undo.finishEdit('Change UV Size');
		},
		onCancel() {
			setValue(old_size);
			revertElementChanges();
			Undo.cancelEdit(false);
			updateSelection();
		}
	}).show();
}