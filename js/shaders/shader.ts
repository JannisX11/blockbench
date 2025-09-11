import { settings } from '../interface/settings';

/**
 * Prepare shader with the correct options depending on device and settings
 * @internal
 */
export function prepareShader(shader: string): string {
	if (
		settings.antialiasing_bleed_fix.value == false ||
		Preview.selected?.renderer.capabilities.isWebGL2 != true
	) {
		shader = shader.replace(/centroid /g, '');
	}
	if (!isApp) {
		shader = shader.replace('precision highp', 'precision mediump');
	}
	return shader;
}
