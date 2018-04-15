var ctx, ext_img, extrusion_canvas, ext_height, ext_width;
var pixel_opacity_tolerance = 10

function drawExtrusionImage(path) {
	extrusion_canvas = $('#extrusion_canvas').get(0)
	ctx = extrusion_canvas.getContext('2d')

	setProgressBar('extrusion_bar', 0)
	$('#scan_tolerance').on('input', function() {
		$('#scan_tolerance_label').text($(this).val())
	})

	ext_img = new Image()
	ext_img.src = path
	ext_img.style.imageRendering = 'pixelated'
	ctx.imageSmoothingEnabled = false;

	ext_img.onload = function() {
		ctx.clearRect(0, 0, 256, 256);
		ctx.drawImage(ext_img, 0, 0, 256, 256)
		ext_width = ext_img.naturalWidth
		ext_height = ext_img.naturalHeight

		if (ext_width > 128) return;

		var g = 256 / ext_width;
		var p = 0
		ctx.beginPath();

		for (var x = 0; x <= 256; x += g) {
		    ctx.moveTo(0.5 + x + p, p);
		    ctx.lineTo(0.5 + x + p, 256 + p);
		}
		for (var x = 0; x <= 256; x += g) {
		    ctx.moveTo(p, 0.5 + x + p);
		    ctx.lineTo(256 + p, 0.5 + x + p);
		}

		ctx.strokeStyle = "black";
		ctx.stroke();
	}

	//Grid
}

function convertExtrusionImage() {
	var scan_mode = $('select#scan_mode option:selected').attr('id') /*areas, lines, columns, pixels*/
	var texture_index = '#'+textures[textures.length-1].id
	var isNewProject = elements.length === 0;
	
	pixel_opacity_tolerance = $('#scan_tolerance').val()
	function isOpaquePixel(px_x, px_y) {
		var pixel = ctx.getImageData(256*(px_x/ext_width)+1, 256*(px_y/ext_height)+1, 1, 1).data
		return pixel[3] >= pixel_opacity_tolerance;
	}

	var ext_x, ext_y;
	var finished_pixels = []
	var cube_nr = 0;
	var cube_name = textures[textures.length-1].name.split('.')[0]
	selected = []
	//Scale Index
	var scale_i = 1;
	if (ext_width < ext_height) {
		ext_width = ext_height;
	}
	scale_i = 16 / ext_width;

	//Scanning
	ext_y = 0;

	asyncLoop({
	    length : ext_height,
	    functionToLoop : function(async_loop, i){
	        setTimeout(function(){

				ext_x = 0;
				while (ext_x < ext_width) {
					if (finished_pixels.includes(ext_x+'.'+ext_y) === false && isOpaquePixel(ext_x, ext_y) === true) {

						//Search From New Pixel
						var loop = true;
						var rect = {x: ext_x, y: ext_y, x2: ext_x, y2: ext_y}

						//Expanding Loop
						while (loop === true) {
							var y_check, x_check, canExpandX, canExpandY;
							//Expand X
							if (scan_mode === 'areas' || scan_mode === 'lines') {
								y_check = rect.y
								x_check = rect.x2 + scale_i
								canExpandX = true
								while (y_check <= rect.y2) {
									//Check If Row is Free
									if (isOpaquePixel(x_check, y_check) === false || finished_pixels.includes(x_check+'.'+y_check) === true) {
										canExpandX = false;
									}
									y_check += scale_i
								}
								if (canExpandX === true) {
									rect.x2 += scale_i
								}
							} else {
								canExpandX = false;
							}
							//Expand Y
							if (scan_mode === 'areas' || scan_mode === 'columns') {
								x_check = rect.x
								y_check = rect.y2 + scale_i
								canExpandY = true
								while (x_check <= rect.x2) {
									//Check If Row is Free
									if (isOpaquePixel(x_check, y_check) === false || finished_pixels.includes(x_check+'.'+y_check) === true) {
										canExpandY = false
									}
									x_check += scale_i
								}
								if (canExpandY === true) {
									rect.y2 += scale_i
								}
							} else {
								canExpandY = false;
							}
							//Conclusion
							if (canExpandX === false && canExpandY === false) {
								loop = false;
							}
						}
						if (scan_mode === 'areas' || scan_mode === 'columns') {
							rect.x2 += scale_i-1;
						}
						if (scan_mode === 'areas' || scan_mode === 'columns') {
							rect.y2 += scale_i-1;
						}



						//Draw Rectangle
						var draw_x = rect.x
						var draw_y = rect.y
						while (draw_y <= rect.y2) {
							draw_x = rect.x
							while (draw_x <= rect.x2) {
								finished_pixels.push(draw_x+'.'+draw_y)
								draw_x++;
							}
							draw_y++;
						}
						var current_cube = new Cube({name: cube_name+'_'+cube_nr, display: {autouv: 0}})
						
						current_cube.from = [rect.x*scale_i, 0, rect.y*scale_i]
						current_cube.to = [(rect.x2+1)*scale_i, scale_i, (rect.y2+1)*scale_i]
						current_cube.display.autouv = false

						//Sides
						current_cube.faces.up = {uv:[rect.x*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture_index}
						current_cube.faces.down = {uv:[rect.x*scale_i, (rect.y2+1)*scale_i, (rect.x2+1)*scale_i, rect.y*scale_i], texture: texture_index}

						current_cube.faces.north = {uv:[(rect.x2+1)*scale_i, rect.y*scale_i, rect.x*scale_i, (rect.y+1)*scale_i], texture: texture_index}
						current_cube.faces.south = {uv:[rect.x*scale_i, rect.y2*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture_index}

						current_cube.faces.east = {uv:[rect.x2*scale_i, rect.y*scale_i, (rect.x2+1)*scale_i, (rect.y2+1)*scale_i], texture: texture_index, rotation: 90}
						current_cube.faces.west = {uv:[rect.x*scale_i, rect.y*scale_i, (rect.x+1)*scale_i, (rect.y2+1)*scale_i], texture: texture_index, rotation: 270}

						elements.push(current_cube)
						selected.push(elements[elements.length-1])
						cube_nr++;
					}


					ext_x++;
				}
				setProgressBar('extrusion_bar', ext_y/ext_height, ext_width*2)
				ext_y++;
				async_loop()

	        },ext_width*2);
	    },
	    callback : function(){
			setProgressBar('extrusion_bar', 1)

		    var group = new Group(cube_name).addTo()
		    selected.forEach(function(s) {
		        s.addTo(group, false)
		    })
		    if (g_makeNew === true || isNewProject) {
		        setProjectTitle(cube_name)
		        Prop.project_saved = false;
		    }
		    loadOutlinerDraggable()
			Canvas.updateAll()
			setUndo()
			hideDialog()
	    }    
	});
}


