/*
    Utility to modify images with a canvas
*/

class CanvasFrame {
    constructor(a, b) {
        if (a && a.nodeName == 'CANVAS') {
            if (a.getContext('2d')) {
                this.canvas = a;
            } else {
                this.createCanvas(a.width, a.height)
                this.loadFromImage(a)
            }

        } else if (a && a.nodeName == 'IMG') {
            this.createCanvas(a.naturalWidth, a.naturalHeight)
            this.loadFromImage(a)

        } else if (a && b) {
            this.createCanvas(a, b)
        }
        this.ctx = this.canvas.getContext('2d')
    }
    get width() {return this.canvas.width;}
    get height() {return this.canvas.height;}
    
    createCanvas(w, h) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d')
    }
    async loadFromURL(url) {
        let img = new Image()
        img.src = url.replace(/#/g, '%23');
        await new Promise((resolve, reject) => {
            img.onload = () => {
                this.loadFromImage(img);
                resolve();
            }
            img.onerror = reject;
        })
    }
    loadFromImage(img) {
        if (img.naturalWidth) {
            this.canvas.width = img.naturalWidth;
            this.canvas.height = img.naturalHeight;
        }
        this.ctx.drawImage(img, 0, 0)
    }
    loadFromCanvas(img) {
        this.canvas.width = image.naturalWidth;
        this.canvas.height = image.naturalHeight;
        this.ctx.drawImage(img, 0, 0)
    }
    autoCrop() {
        // Based on code by remy, licensed under MIT
        // https://gist.github.com/remy/784508

        let copy = document.createElement('canvas').getContext('2d');
        let pixels = this.ctx.getImageData(0, 0, this.width, this.height);
        let i;
        let bound = {
            top: null,
            left: null,
            right: null,
            bottom: null
        };
        let x, y;
        
        for (i = 0; i < pixels.data.length; i += 4) {
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
            
        var trimHeight = bound.bottom - bound.top,
            trimWidth = bound.right - bound.left,
            trimmed = this.ctx.getImageData(bound.left, bound.top, trimWidth, trimHeight);
        
        copy.canvas.width = trimWidth;
        copy.canvas.height = trimHeight;
        copy.putImageData(trimmed, 0, 0);
        this.canvas = copy.canvas;
        this.ctx = copy;
    }
}