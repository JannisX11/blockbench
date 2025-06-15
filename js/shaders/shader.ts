import { settings } from "../interface/settings";

export function prepareShader(shader: string): string {
	if ((settings.antialiasing_bleed_fix.value && Preview.selected?.renderer.capabilities.isWebGL2) == false) {
		shader = shader.replace(/centroid /g, '');
	}
	if (!isApp) {
		shader = shader.replace('precision highp', 'precision mediump');
	}
	return shader;
}