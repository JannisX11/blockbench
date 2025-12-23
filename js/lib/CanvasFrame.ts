/*
	Utility to modify images with a canvas
*/
export class CanvasFrame {
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	
	constructor()
	constructor(width: number, height: number)
	constructor(source?: HTMLCanvasElement | HTMLImageElement | number, copy_canvas?: number | boolean) {
		if (source instanceof HTMLCanvasElement) {
			if (source.getContext('2d') && copy_canvas !== true) {
				this.canvas = source;
			} else {
				this.createCanvas(source.width, source.height)
				this.loadFromImage(source)
			}

		} else if (source instanceof HTMLImageElement) {
			this.createCanvas(source.naturalWidth, source.naturalHeight)
			this.loadFromImage(source)

		} else {
			this.createCanvas(source || 16, typeof copy_canvas == 'number' ? copy_canvas : 16);
		}
		this.ctx = this.canvas.getContext('2d')
	}
	get width() {return this.canvas.width;}
	get height() {return this.canvas.height;}
	
	createCanvas(width: number, height: number) {
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		this.ctx = this.canvas.getContext('2d')
	}
	async loadFromURL(url: string) {
		let img = new Image()
		if (!isApp && url.startsWith('https')) {
			img.crossOrigin = "blockbench.net";
		}
		img.src = url.replace(/#/g, '%23');
		await new Promise<void>((resolve, reject) => {
			img.onload = () => {
				this.loadFromImage(img);
				resolve();
			}
			img.onerror = reject;
		})
	}
	loadFromImage(img: HTMLImageElement | HTMLCanvasElement) {
		if ('naturalWidth' in img) {
			this.canvas.width = img.naturalWidth;
			this.canvas.height = img.naturalHeight;
		}
		this.ctx.drawImage(img, 0, 0)
	}
	loadFromCanvas(canvas: HTMLCanvasElement) {
		this.canvas.width = canvas.width;
		this.canvas.height = canvas.height;
		this.ctx.drawImage(canvas, 0, 0)
	}
	autoCrop() {
		// Based on code by remy, licensed under MIT
		// https://gist.github.com/remy/784508

		let copy = document.createElement('canvas').getContext('2d');
		let pixels = this.ctx.getImageData(0, 0, this.width, this.height);
		let bound = {
			top: null as null|number,
			left: null as null|number,
			right: null as null|number,
			bottom: null as null|number
		};
		let x: number, y: number;
		
		for (let i = 0; i < pixels.data.length; i += 4) {
			if (pixels.data[i+3] !== 0) {
				x = (i / 4) % this.width;
				y = ~~((i / 4) / this.width);
			
				if (bound.top === null) {
					bound.top = y;
				}
				
				if (bound.left === null) {
					bound.left = x; 
				} else if (x < bound.left) {
					bound.left = x;
				}
				
				if (bound.right === null) {
					bound.right = x; 
				} else if (bound.right < x) {
					bound.right = x;
				}
				
				if (bound.bottom === null) {
					bound.bottom = y;
				} else if (bound.bottom < y) {
					bound.bottom = y;
				}
			}
		}
			
		let trimHeight = bound.bottom - bound.top + 1,
			trimWidth = bound.right - bound.left + 1,
			trimmed = this.ctx.getImageData(bound.left, bound.top, trimWidth, trimHeight);
		
		copy.canvas.width = trimWidth;
		copy.canvas.height = trimHeight;
		copy.putImageData(trimmed, 0, 0);
		this.canvas = copy.canvas;
		this.ctx = copy;
	}
	isEmpty(): boolean {
		let {data} = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
		for (let i = 0; i < data.length; i += 4) {
			let alpha = data[i+3];
			if (alpha) return false;
		}
		return true;
	}
}

Object.assign(window, {CanvasFrame});
