import { Blockbench } from "../../api";
import { Property } from "../../util/property";
import { OutlinerElement } from "./outliner_element";

interface FaceOptions {
	texture?: Texture | UUID | false
}

export abstract class Face {
	texture: UUID | false | undefined
	element: OutlinerElement
	direction?: string
	uv: any

	/**
	 * Returns a 2D rectangle around the UV face
	 */
	getBoundingRect(): any {}
	constructor(data: FaceOptions) {
		for (let key in (this.constructor as typeof Face).properties) {
			(this.constructor as typeof Face).properties[key].reset(this);
		}
	}
	extend(data: FaceOptions) {
		for (let key in (this.constructor as typeof Face).properties) {
			(this.constructor as typeof Face).properties[key].merge(this, data)
		}
		if (data.texture === null) {
			this.texture = null;
		} else if (data.texture === false) {
			this.texture = false;
		} else if (data.texture instanceof Texture && Texture.all.includes(data.texture)) {
			this.texture = data.texture.uuid;
		} else if (typeof data.texture === 'string') {
			Merge.string(this, data, 'texture')
		}
		return this;
	}
	getTexture(): Texture | undefined | null | false {
		let event_result = Blockbench.dispatchEvent('get_face_texture', {face: this, element: this.element});
		if (event_result) {
			let result = event_result.find(v => v != undefined);
			if (result) return result;
		}
		if (Format.per_group_texture && this.element.parent instanceof Group && this.element.parent.texture) {
			return Texture.all.find(texture => texture.uuid == (this.element.parent as Group).texture);
		}
		if (this.texture !== null && (Format.single_texture || (Format.single_texture_default && (Format.per_group_texture || !this.texture)))) {
			return Texture.getDefault();
		}
		if (typeof this.texture === 'string') {
			return Texture.all.find(texture => texture.uuid == this.texture)
		}
		return this.texture;
	}
	reset() {
		for (let key in (this.constructor as typeof Face).properties) {
			(this.constructor as typeof Face).properties[key].reset(this);
		}
		this.texture = false;
		return this;
	}
	/**
	 * Returns a save copy of the face, ready for serialization
	 */
	getSaveCopy() {
		let copy = {
			uv: this.uv,
			texture: undefined
		}
		for (let key in (this.constructor as typeof Face).properties) {
			if (this[key] != (this.constructor as typeof Face).properties[key].default) (this.constructor as typeof Face).properties[key].copy(this, copy);
		}
		let tex = this.getTexture()
		if (tex === null) {
			copy.texture = null;
		} else if (tex instanceof Texture && Blockbench.hasFlag('compiling_bbmodel')) {
			copy.texture = Texture.all.indexOf(tex);
		} else if (tex instanceof Texture) {
			copy.texture = tex.uuid;
		}
		return copy;
	}
	/**
	 * Get a copy for undo tracking
	 */
	getUndoCopy(): Face {
		let copy = new (this.constructor as any)(this.direction, this) as Face & {cube?: any, mesh?: any};
		delete copy.cube;
		delete copy.mesh;
		delete copy.direction;
		return copy;
	}
	static properties: Record<string, Property<any>>
}
const global = {
	Face,
};
declare global {
	const Face: typeof global.Face
	type Face = import("./face").Face
}
Object.assign(window, global);