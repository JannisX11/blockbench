export function quantize(data, opts) {
	let palette = opts.has_transparency ? [[0, 0, 0]] : [];
	let counter = opts.has_transparency ? [100] : [];
	for (let i = 0; i < data.length; i += 4) {
		if (data[i+3] < 127) {
			continue;
		}
		let r = data[i];
		let g = data[i+1];
		let b = data[i+2];
		let match = palette.findIndex((color, i) => color[0] == r && color[1] == g && color[2] == b && (i != 0 || !opts.has_transparency));
		if (match == -1) {
			palette.push([r, g, b])
			counter.push(1)
		} else {
			counter[match] += 1;
		}
		if (!opts.prio_color_accuracy && palette.length > 256) break;
	}
	let threshold = 4;
	while (palette.length > 256 && opts.prio_color_accuracy) {
		counter.forEachReverse((count, index) => {
			if (index == 0) return;
			if (count < threshold) {
				palette.splice(index, 1);
				counter.splice(index, 1);
			}
		});
		threshold *= 1.5;
		if (threshold > 50) break;
	}
	return palette;
}
export function applyPalette(data, palette, opts) {
	let array = new Uint8Array(data.length / 4);
	for (let i = 0; i < array.length; i++) {
		if (data[i*4+3] < 127) {
			continue;
		}
		let r = data[i*4];
		let g = data[i*4+1];
		let b = data[i*4+2];
		let match = palette.findIndex((color, i) => color[0] == r && color[1] == g && color[2] == b && (i != 0 || !opts.has_transparency));
		if (match == -1 && opts.prio_color_accuracy) {
			let closest = palette.filter((color, i) => Math.epsilon(color[0], r, 6) && Math.epsilon(color[1], g, 6) && Math.epsilon(color[2], b, 6) && (i != 0 || !opts.has_transparency));
			if (!closest.length) {
				closest = palette.filter((color, i) => Math.epsilon(color[0], r, 24) && Math.epsilon(color[1], g, 24) && Math.epsilon(color[2], b, 128) && (i != 0 || !opts.has_transparency));
			}
			if (!closest.length) {
				closest = palette.filter((color, i) => Math.epsilon(color[0], r, 24) && Math.epsilon(color[1], g, 24) && Math.epsilon(color[2], b, 128) && (i != 0 || !opts.has_transparency));
			}
			if (!closest.length) {
				closest = palette.filter((color, i) => Math.epsilon(color[0], r, 64) && Math.epsilon(color[1], g, 64) && Math.epsilon(color[2], b, 128) && (i != 0 || !opts.has_transparency));
			}
			if (!closest.length) {
				closest = palette.slice();
			}
			closest.sort((color_a, color_b) => {
				let diff_a = Math.pow(color_a[0] + r, 2) + Math.pow(color_a[1] + g, 2) + Math.pow(color_a[2] + b, 2);
				let diff_b = Math.pow(color_b[0] + r, 2) + Math.pow(color_b[1] + g, 2) + Math.pow(color_b[2] + b, 2);
				return diff_a - diff_b;
			})
			if (closest[0]) {
				match = palette.indexOf(closest[0]);
			}
		}
		if (match != -1) array[i] = match;
	}
	return array;
}
