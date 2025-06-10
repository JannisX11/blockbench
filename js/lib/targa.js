/**
 * @fileoverview jsTGALoader - Javascript loader for TGA file
 * @author Vincent Thibault
 * @version 1.2.0
 * @blog http://blog.robrowser.com/javascript-tga-loader.html
 */

/* Copyright (c) 2013, Vincent Thibault. All rights reserved.
Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:
  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

(function(_global)
{
	'use strict';


	/**
	 * TGA Namespace
	 * @constructor
	 */
	window.Targa = function()
	{
	}


	/**
	 * @var {object} TGA type constants
	 */
	Targa.Type = {
		NO_DATA:      0,
		INDEXED:      1,
		RGB:          2,
		GREY:         3,
		RLE_INDEXED:  9,
		RLE_RGB:     10,
		RLE_GREY:    11
	};


	/**
	 * @var {object} TGA origin constants
	 */
	Targa.Origin = {
		BOTTOM_LEFT:  0x00,
		BOTTOM_RIGHT: 0x01,
		TOP_LEFT:     0x02,
		TOP_RIGHT:    0x03,
		SHIFT:        0x04,
		MASK:         0x30
	};


	/**
	 * Check the header of TGA file to detect errors
	 *
	 * @param {object} tga header structure
	 * @throws Error
	 */
	function checkHeader( header )
	{
		// What the need of a file without data ?
		if (header.imageType === Targa.Type.NO_DATA) {
			throw new Error('Targa::checkHeader() - No data');
		}

		// Indexed type
		if (header.hasColorMap) {
			if (header.colorMapLength > 256 || header.colorMapDepth !== 24 || header.colorMapType !== 1) {
				throw new Error('Targa::checkHeader() - Invalid colormap for indexed type');
			}
		}
		else {
			if (header.colorMapType) {
				throw new Error('Targa::checkHeader() - Why does the image contain a palette ?');
			}
		}

		// Check image size
		if (header.width <= 0 || header.height <= 0) {
			throw new Error('Targa::checkHeader() - Invalid image size');
		}

		// Check pixel size
		if (header.pixelDepth !== 8  &&
		    header.pixelDepth !== 16 &&
		    header.pixelDepth !== 24 &&
		    header.pixelDepth !== 32) {
			throw new Error('Targa::checkHeader() - Invalid pixel size "' + header.pixelDepth + '"');
		}
	}


	/**
	 * Decode RLE compression
	 *
	 * @param {Uint8Array} data
	 * @param {number} offset in data to start loading RLE
	 * @param {number} pixel count
	 * @param {number} output buffer size
	 */
	function decodeRLE( data, offset, pixelSize, outputSize)
	{
		var pos, c, count, i;
		var pixels, output;

		output = new Uint8Array(outputSize);
		pixels = new Uint8Array(pixelSize);
		pos    = 0;

		while (pos < outputSize) {
			c     = data[offset++];
			count = (c & 0x7f) + 1;

			// RLE pixels.
			if (c & 0x80) {
				// Bind pixel tmp array
				for (i = 0; i < pixelSize; ++i) {
					pixels[i] = data[offset++];
				}

				// Copy pixel array
				for (i = 0; i < count; ++i) {
					output.set(pixels, pos);
					pos += pixelSize;
				}
			}

			// Raw pixels.
			else {
				count *= pixelSize;
				for (i = 0; i < count; ++i) {
					output[pos++] = data[offset++];
				}
			}
		}

		return output;
	}


	/**
	 * Return a ImageData object from a TGA file (8bits)
	 *
	 * @param {Array} imageData - ImageData to bind
	 * @param {Array} indexes - index to colormap
	 * @param {Array} colormap
	 * @param {number} width
	 * @param {number} y_start - start at y pixel.
	 * @param {number} x_start - start at x pixel.
	 * @param {number} y_step  - increment y pixel each time.
	 * @param {number} y_end   - stop at pixel y.
	 * @param {number} x_step  - increment x pixel each time.
	 * @param {number} x_end   - stop at pixel x.
	 * @returns {Array} imageData
	 */
	function getImageData8bits(imageData, indexes, colormap, width, y_start, y_step, y_end, x_start, x_step, x_end)
	{
		var color, i, x, y;

		for (i = 0, y = y_start; y !== y_end; y += y_step) {
			for (x = x_start; x !== x_end; x += x_step, i++) {
				color = indexes[i];
				imageData[(x + width * y) * 4 + 3] = 255;
				imageData[(x + width * y) * 4 + 2] = colormap[(color * 3) + 0];
				imageData[(x + width * y) * 4 + 1] = colormap[(color * 3) + 1];
				imageData[(x + width * y) * 4 + 0] = colormap[(color * 3) + 2];
			}
		}

		return imageData;
	}


	/**
	 * Return a ImageData object from a TGA file (16bits)
	 *
	 * @param {Array} imageData - ImageData to bind
	 * @param {Array} pixels data
	 * @param {Array} colormap - not used
	 * @param {number} width
	 * @param {number} y_start - start at y pixel.
	 * @param {number} x_start - start at x pixel.
	 * @param {number} y_step  - increment y pixel each time.
	 * @param {number} y_end   - stop at pixel y.
	 * @param {number} x_step  - increment x pixel each time.
	 * @param {number} x_end   - stop at pixel x.
	 * @returns {Array} imageData
	 */
	function getImageData16bits(imageData, pixels, colormap, width, y_start, y_step, y_end, x_start, x_step, x_end)
	{
		var color, i, x, y;

		for (i = 0, y = y_start; y !== y_end; y += y_step) {
			for (x = x_start; x !== x_end; x += x_step, i += 2) {
				color = pixels[i + 0] | (pixels[i + 1] << 8);
				imageData[(x + width * y) * 4 + 0] = (color & 0x7C00) >> 7;
				imageData[(x + width * y) * 4 + 1] = (color & 0x03E0) >> 2;
				imageData[(x + width * y) * 4 + 2] = (color & 0x001F) >> 3;
				imageData[(x + width * y) * 4 + 3] = (color & 0x8000) ? 0 : 255;
			}
		}

		return imageData;
	}


	/**
	 * Return a ImageData object from a TGA file (24bits)
	 *
	 * @param {Array} imageData - ImageData to bind
	 * @param {Array} pixels data
	 * @param {Array} colormap - not used
	 * @param {number} width
	 * @param {number} y_start - start at y pixel.
	 * @param {number} x_start - start at x pixel.
	 * @param {number} y_step  - increment y pixel each time.
	 * @param {number} y_end   - stop at pixel y.
	 * @param {number} x_step  - increment x pixel each time.
	 * @param {number} x_end   - stop at pixel x.
	 * @returns {Array} imageData
	 */
	function getImageData24bits(imageData, pixels, colormap, width, y_start, y_step, y_end, x_start, x_step, x_end)
	{
		var i, x, y;

		for (i = 0, y = y_start; y !== y_end; y += y_step) {
			for (x = x_start; x !== x_end; x += x_step, i += 3) {
				imageData[(x + width * y) * 4 + 3] = 255;
				imageData[(x + width * y) * 4 + 2] = pixels[i + 0];
				imageData[(x + width * y) * 4 + 1] = pixels[i + 1];
				imageData[(x + width * y) * 4 + 0] = pixels[i + 2];
			}
		}

		return imageData;
	}


	/**
	 * Return a ImageData object from a TGA file (32bits)
	 *
	 * @param {Array} imageData - ImageData to bind
	 * @param {Array} pixels data
	 * @param {Array} colormap - not used
	 * @param {number} width
	 * @param {number} y_start - start at y pixel.
	 * @param {number} x_start - start at x pixel.
	 * @param {number} y_step  - increment y pixel each time.
	 * @param {number} y_end   - stop at pixel y.
	 * @param {number} x_step  - increment x pixel each time.
	 * @param {number} x_end   - stop at pixel x.
	 * @returns {Array} imageData
	 */
	function getImageData32bits(imageData, pixels, colormap, width, y_start, y_step, y_end, x_start, x_step, x_end)
	{
		var i, x, y;

		for (i = 0, y = y_start; y !== y_end; y += y_step) {
			for (x = x_start; x !== x_end; x += x_step, i += 4) {
				imageData[(x + width * y) * 4 + 2] = pixels[i + 0];
				imageData[(x + width * y) * 4 + 1] = pixels[i + 1];
				imageData[(x + width * y) * 4 + 0] = pixels[i + 2];
				imageData[(x + width * y) * 4 + 3] = pixels[i + 3];
			}
		}

		return imageData;
	}


	/**
	 * Return a ImageData object from a TGA file (8bits grey)
	 *
	 * @param {Array} imageData - ImageData to bind
	 * @param {Array} pixels data
	 * @param {Array} colormap - not used
	 * @param {number} width
	 * @param {number} y_start - start at y pixel.
	 * @param {number} x_start - start at x pixel.
	 * @param {number} y_step  - increment y pixel each time.
	 * @param {number} y_end   - stop at pixel y.
	 * @param {number} x_step  - increment x pixel each time.
	 * @param {number} x_end   - stop at pixel x.
	 * @returns {Array} imageData
	 */
	function getImageDataGrey8bits(imageData, pixels, colormap, width, y_start, y_step, y_end, x_start, x_step, x_end)
	{
		var color, i, x, y;

		for (i = 0, y = y_start; y !== y_end; y += y_step) {
			for (x = x_start; x !== x_end; x += x_step, i++) {
				color = pixels[i];
				imageData[(x + width * y) * 4 + 0] = color;
				imageData[(x + width * y) * 4 + 1] = color;
				imageData[(x + width * y) * 4 + 2] = color;
				imageData[(x + width * y) * 4 + 3] = 255;
			}
		}

		return imageData;
	}


	/**
	 * Return a ImageData object from a TGA file (16bits grey)
	 *
	 * @param {Array} imageData - ImageData to bind
	 * @param {Array} pixels data
	 * @param {Array} colormap - not used
	 * @param {number} width
	 * @param {number} y_start - start at y pixel.
	 * @param {number} x_start - start at x pixel.
	 * @param {number} y_step  - increment y pixel each time.
	 * @param {number} y_end   - stop at pixel y.
	 * @param {number} x_step  - increment x pixel each time.
	 * @param {number} x_end   - stop at pixel x.
	 * @returns {Array} imageData
	 */
	function getImageDataGrey16bits(imageData, pixels, colormap, width, y_start, y_step, y_end, x_start, x_step, x_end)
	{
		var i, x, y;

		for (i = 0, y = y_start; y !== y_end; y += y_step) {
			for (x = x_start; x !== x_end; x += x_step, i += 2) {
				imageData[(x + width * y) * 4 + 0] = pixels[i + 0];
				imageData[(x + width * y) * 4 + 1] = pixels[i + 0];
				imageData[(x + width * y) * 4 + 2] = pixels[i + 0];
				imageData[(x + width * y) * 4 + 3] = pixels[i + 1];
			}
		}

		return imageData;
	}


	/**
	 * Open a targa file using XHR, be aware with Cross Domain files...
	 *
	 * @param {string} path - Path of the filename to load
	 * @param {function} callback - callback to trigger when the file is loaded
	 */
	Targa.prototype.open = function targaOpen(path, callback)
	{
		var req, tga = this;
		req = new XMLHttpRequest();
		req.open('GET', path, true);
		req.responseType = 'arraybuffer';
		req.onload = function() {
			if (this.status === 200) {
				tga.load(new Uint8Array(req.response));
				if (callback) {
					callback.call(tga);
				}
			}
		};
		req.send(null);
	};


	/**
	 * Load and parse a TGA file
	 *
	 * @param {Uint8Array} data - TGA file buffer array
	 */
	Targa.prototype.load = function targaLoad( data )
	{
		var offset = 0;

		// Not enough data to contain header ?
		if (data.length < 0x12) {
			throw new Error('Targa::load() - Not enough data to contain header');
		}

		// Read TgaHeader
		this.header = {
			/* 0x00  BYTE */  idLength:       data[offset++],
			/* 0x01  BYTE */  colorMapType:   data[offset++],
			/* 0x02  BYTE */  imageType:      data[offset++],
			/* 0x03  WORD */  colorMapIndex:  data[offset++] | data[offset++] << 8,
			/* 0x05  WORD */  colorMapLength: data[offset++] | data[offset++] << 8,
			/* 0x07  BYTE */  colorMapDepth:  data[offset++],
			/* 0x08  WORD */  offsetX:        data[offset++] | data[offset++] << 8,
			/* 0x0a  WORD */  offsetY:        data[offset++] | data[offset++] << 8,
			/* 0x0c  WORD */  width:          data[offset++] | data[offset++] << 8,
			/* 0x0e  WORD */  height:         data[offset++] | data[offset++] << 8,
			/* 0x10  BYTE */  pixelDepth:     data[offset++],
			/* 0x11  BYTE */  flags:          data[offset++]
		};

		// Set shortcut
		this.header.hasEncoding = (this.header.imageType === Targa.Type.RLE_INDEXED || this.header.imageType === Targa.Type.RLE_RGB   || this.header.imageType === Targa.Type.RLE_GREY);
		this.header.hasColorMap = (this.header.imageType === Targa.Type.RLE_INDEXED || this.header.imageType === Targa.Type.INDEXED);
		this.header.isGreyColor = (this.header.imageType === Targa.Type.RLE_GREY    || this.header.imageType === Targa.Type.GREY);

		// Check if a valid TGA file (or if we can load it)
		checkHeader(this.header);

		// Move to data
		offset += this.header.idLength;
		if (offset >= data.length) {
			throw new Error('Targa::load() - No data');
		}

		// Read palette
		if (this.header.hasColorMap) {
			var colorMapSize  = this.header.colorMapLength * (this.header.colorMapDepth >> 3);
			this.palette      = data.subarray( offset, offset + colorMapSize);
			offset           += colorMapSize;
		}

		var pixelSize  = this.header.pixelDepth >> 3;
		var imageSize  = this.header.width * this.header.height;
		var pixelTotal = imageSize * pixelSize;

		// RLE encoded
		if (this.header.hasEncoding) {
			this.imageData = decodeRLE(data, offset, pixelSize, pixelTotal);
		}

		// RAW pixels
		else {
			this.imageData = data.subarray( offset, offset + (this.header.hasColorMap ? imageSize : pixelTotal) );
		}
	};


	/**
	 * Return a ImageData object from a TGA file
	 *
	 * @param {object} imageData - Optional ImageData to work with
	 * @returns {object} imageData
	 */
	Targa.prototype.getImageData = function targaGetImageData( imageData )
	{
		var width  = this.header.width;
		var height = this.header.height;
		var origin = (this.header.flags & Targa.Origin.MASK) >> Targa.Origin.SHIFT;
		var x_start, x_step, x_end, y_start, y_step, y_end;
		var getImageData;

			// Create an imageData
		if (!imageData) {
			if (document) {
				imageData = document.createElement('canvas').getContext('2d').createImageData(width, height);
			}
			// In Thread context ?
			else {
				imageData = {
					width:  width,
					height: height,
					data: new Uint8ClampedArray(width * height * 4)
				};
			}
		}

		if (origin === Targa.Origin.TOP_LEFT || origin === Targa.Origin.TOP_RIGHT) {
			y_start = 0;
			y_step  = 1;
			y_end   = height;
		}
		else {
			y_start = height - 1;
			y_step  = -1;
			y_end   = -1;
		}

		if (origin === Targa.Origin.TOP_LEFT || origin === Targa.Origin.BOTTOM_LEFT) {
			x_start = 0;
			x_step  = 1;
			x_end   = width;
		}
		else {
			x_start = width - 1;
			x_step  = -1;
			x_end   = -1;
		}

		// TODO: use this.header.offsetX and this.header.offsetY ?

		switch (this.header.pixelDepth) {
			case 8:
				getImageData = this.header.isGreyColor ? getImageDataGrey8bits : getImageData8bits;
				break;

			case 16:
				getImageData = this.header.isGreyColor ? getImageDataGrey16bits : getImageData16bits;
				break;

			case 24:
				getImageData = getImageData24bits;
				break;

			case 32:
				getImageData = getImageData32bits;
				break;
		}

		getImageData(imageData.data, this.imageData, this.palette, width, y_start, y_step, y_end, x_start, x_step, x_end);
		return imageData;
	};


	/**
	 * Return a canvas with the TGA render on it
	 *
	 * @returns {object} CanvasElement
	 */
	Targa.prototype.getCanvas = function targaGetCanvas()
	{
		var canvas, ctx, imageData;

		canvas    = document.createElement('canvas');
		ctx       = canvas.getContext('2d');
		imageData = ctx.createImageData(this.header.width, this.header.height);

		canvas.width  = this.header.width;
		canvas.height = this.header.height;

		ctx.putImageData(this.getImageData(imageData), 0, 0);

		return canvas;
	};


	/**
	 * Return a dataURI of the TGA file
	 *
	 * @param {string} type - Optional image content-type to output (default: image/png)
	 * @returns {string} url
	 */
	Targa.prototype.getDataURL = function targaGetDatURL( type )
	{
		return this.getCanvas().toDataURL(type || 'image/png');
	};


	// Find Context
	var shim = {};
	if (typeof(exports) === 'undefined') {
		if (typeof(define) === 'function' && typeof(define.amd) === 'object' && define.amd) {
			define(function(){
				return Targa;
			});
		} else {
			// Browser
			shim.exports = typeof(window) !== 'undefined' ? window : _global;
		}
	} 
	else {
		// Commonjs
		shim.exports = exports;
	}


	// Export
	if (shim.exports) {
		shim.exports.TGA = Targa;
	}

})(this);