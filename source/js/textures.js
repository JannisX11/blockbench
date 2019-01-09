//Textures
class Texture {
	constructor(data) {
	    this.path = ''
	    this.name = ''
	    this.folder = '';
	    this.iconpath = ''
		this.particle = false
	    this.selected = false
	    this.error = false;
	    this.frameCount = 1
	    this.show_icon = true
	    this.average_color = {r:0, g:0, b:0}
	    this.dark_box = false
	    this.img = 0;
	    this.uuid = guid()

	    if (typeof data === 'object') {
	    	this.extend(data)
	    }
	    if (!this.id) {
	        var i = 0;
	        while (true) {
	            var matches = $.grep(textures, function(e) {return e.id == i})
	            if (matches.length > 0) {
	                i++;
	            } else {
	                this.id = i;
	                return;
	            }
	        }
	    }
	}
	load(isDefault) {
		var scope = this;

		this.error = false;
        this.show_icon = true
        this.frameCount = 1

        if (Canvas.materials[scope.uuid] !== undefined) {
            Canvas.materials[scope.uuid].dispose()
        }

        var img = this.img = new Image()

        img.src = this.iconpath
        img.onerror = function() {
            this.src = 'assets/missing.png'
            scope.error = true;
            scope.show_icon = false
            console.log('Error loading '+scope.iconpath)
            if (isApp && !isDefault) {
            	scope.fromDefaultPack()
            }
        }

        var tex = new THREE.Texture(img)
        img.tex = tex;
        img.tex.magFilter = THREE.NearestFilter
        img.tex.minFilter = THREE.NearestFilter

        img.onload = function() {

            this.tex.needsUpdate = true;
            scope.res = img.naturalWidth;

            scope.average_color = getAverageRGB(this)
            scope.dark_box = (scope.average_color.r + scope.average_color.g + scope.average_color.b) >= 383

            //Width / Animation
            if (img.naturalWidth !== img.naturalHeight) {
                if (img.naturalHeight % img.naturalWidth === 0) {
                    scope.frameCount = img.naturalHeight / img.naturalWidth
                    Canvas.updateAllUVs()
                } else {
                    scope.error = true;
                    showQuickMessage('Texture needs to be square')
                }
            }
            if (textures.indexOf(scope) === 0) {
                Project.texture_width = img.naturalWidth
                Project.texture_height = img.naturalHeight
            }
            if ($('.dialog#texture_edit:visible').length >= 1 && scope.selected === true) {
                loadTextureMenu(scope)
            }
            TextureAnimator.updateButton()
            Canvas.updateAllFaces()
        }
        var mat = new THREE.MeshLambertMaterial({color: 0xffffff, map: tex, transparent: settings.transparency.value});
        Canvas.materials[this.uuid] = mat
	    return this;
	}
	fromPath(path) {
		this.path = path
		this.name = pathToName(path, true)
		if (path.includes('data:image')) {
			this.iconpath = path
		} else {
			this.iconpath = path + '?' + tex_version
		}
		this.generateFolder(path)
		
		if (!isApp && Project.dataURLTextures) {
			if (this.img && this.img.src) {
				this.img.src = 'assets/missing.png'
			}
            this.error = true;
            this.show_icon = false
		} else {
			this.load()
		}
		return this;
	}
	fromDataURL(data_url) {
		this.path = this.folder+'/'+this.name
		this.iconpath = data_url
		this.load()
		return this;
	}
	fromDefaultPack() {
		if (settings.default_path && settings.default_path.value) {
			console.log('Trying to get texture from default pack')
			this.path = settings.default_path.value + osfs + this.folder + osfs + this.name
			this.iconpath = this.path + '?' + tex_version
			this.load(true)
		}
	}
	reopen() {
		var scope = this;
		if (isApp) {
		    app.dialog.showOpenDialog(currentwindow, {filters: [{name: 'PNG Texture', extensions: ['png']}]}, function (fileNames) {
		        if (fileNames !== undefined) {
		            fs.readFile(fileNames[0], function (err) {
		                if (err) {
		                    console.log(err)
		                }
		                scope.path = fileNames[0]
		                scope.iconpath = scope.path + '?' + tex_version;
		                scope.name = scope.path.split(osfs).slice(-1)[0]

		                if (scope.path.includes(osfs +'textures'+osfs)) {
		                    var arr = scope.path.split(osfs+'textures'+osfs)
		                    arr = arr[arr.length-1].split(osfs)
		                    arr.pop()
		                    scope.folder = arr.join('/')
		                } else {
		                    var arr = scope.path.split(osfs)
		                    scope.folder = arr[arr.length-2]
		                }

		                var img = new Image()
		                try {
		                    img.src = fileNames[0]
		                } catch(err) {
		                    img.src = 'missing.png'
		                }
		                var tex = new THREE.Texture(img)
		                img.tex = tex;
		                img.tex.magFilter = THREE.NearestFilter
		                img.tex.minFilter = THREE.LinearMipMapLinearFilter
		                img.onload = function() {
		                    this.tex.needsUpdate = true;
		                    scope.res = img.naturalWidth;
		                }
		                Canvas.materials[scope.uuid] = new THREE.MeshBasicMaterial({color: 0xffffff, map: tex, transparent: true});
		                
		                scope.load()
		                Canvas.updateAllFaces()

		            })
		        }
		    })
		} else {
			var file = $('.dialog:visible #texture_change').get(0).files[0]
			var reader = new FileReader()
			reader.onloadend = function() {
		        
		        scope.iconpath = reader.result
		        var img = new Image()
		        try {
		            img.src = reader.result
		        } catch(err) {
		            console.log(err)
		            img.src = 'missing.png'
		        }
		        var tex = new THREE.Texture(img)
		        img.tex = tex;
		        img.tex.magFilter = THREE.NearestFilter
		        img.tex.minFilter = THREE.LinearMipMapLinearFilter
		        img.onload = function() {
		            this.tex.needsUpdate = true;
		            scope.res = img.naturalWidth;
		        }
		        Canvas.materials[scope.uuid] = new THREE.MeshLambertMaterial({color: 0xffffff, map: tex, transparent: true});
		        scope.load()
		        Canvas.updateAllFaces()
		        main_uv.loadData()
			}
			if (file) {
				reader.readAsDataURL(file)
			}
		}
		Blockbench.dispatchEvent( 'change_texture_path', {texture: scope} )
	}
	refresh(single) {
		if (single) {
        	tex_version++;
		}
        this.iconpath = this.iconpath.replace(/\?\d+$/, '?' + tex_version)
        this.load()
		if (single) {
	        Canvas.updateAllFaces()
	        main_uv.loadData()
	        loadTextureDraggable()
		}
	}
	reloadTexture() {
		this.refresh(true)
	}
	enableParticle() {
		textures.forEach(function(s) {
	        s.particle = false;
	    })
	    this.particle = true
	    return this;
	}
	fillParticle() {
		var particle_tex = false
		textures.forEach(function(t) {
			if (t.particle) {
				particle_tex = t
			}
		})
		if (!particle_tex) {
			this.enableParticle()
		}
		return this;
	}
	select() {
		textures.forEach(function(s) {
	        s.selected = false;
	    })
	    this.selected = true
        textures.selected = this
	    return this;
	}
	generateFolder(path) {
        if (path.includes(osfs+'textures'+osfs)) {
            var arr = path.split(osfs+'textures'+osfs)
            arr = arr[arr.length-1].split(osfs)
            arr.pop()
            this.folder = arr.join('/')
        } else {
            var arr = path.split(osfs)
            this.folder = arr[arr.length-2]
        }
	    return this;
	}
	add() {
		if (!textures.includes(this)) {
			textures.push(this)
		}
           Blockbench.dispatchEvent( 'add_texture', {texture: this})
		loadTextureDraggable()
		return this;
	}
	extend(properties) {
		for (var key in properties) {
			if (properties.hasOwnProperty(key)) {
				this[key] = properties[key]
			}
		}
	}
	apply(all) {
		if (selected.length === 0) return;
		var scope = this;
	    if (all) {
	        var sides = ['north', 'east', 'south', 'west', 'up', 'down']
	    } else {
	        var sides = [main_uv.face]
	    }
	    selected.forEach(function(s) {
	        sides.forEach(function(side) {
	            elements[s].faces[side].texture = '#'+scope.id
	        })
	    })
	    Canvas.updateSelectedFaces()
	    main_uv.loadData()
	    setUndo('Applied texture')
	}
	openFolder() {
		if (!isApp) return;
		shell.showItemInFolder(this.path)
	}
	remove() {
	    textures.splice(textures.indexOf(this), 1)
	    Canvas.updateAll()
	    $('#uv_frame').css('background', 'transparent')
	    TextureAnimator.updateButton()
	    hideDialog()
	}
}


function applyTexture(all, id) {
    if (selected.length === 0) return;
    if (id === undefined) {
        textures.forEach(function(s) {
            if (s.selected) {
                id = s.id
            }
        })
    }
    if (id === undefined) return;
    getTextureById(id).apply(all)
}
function reloadTextures() {
    tex_version++;
    textures.forEach(function(t) {
        t.iconpath = t.path + '?' + tex_version;
        t.refresh(false)
    })
    Canvas.updateAllFaces()
    main_uv.loadData()
    loadTextureDraggable()
}
function getSelectedTextureIndex() {
    var index = false
    textures.forEach(function(s, i) {
        if (s.selected === true) {
            index = i
        }
    })
    return index;
}
function openTextureMenu(index) {
    if (index === undefined) {
        index = getSelectedTextureIndex()
        if (index === false) return;
    } else {
    	textures[index].select()
    }
    showDialog('texture_edit')

    loadTextureMenu(textures.selected)

    if (isApp) {
        $('#texture_edit #change_file_button').click( function() {
            textures.selected.reopen()
        })
    } else {
        $('#texture_edit #texture_change').off('change')
        $('#texture_edit #texture_change').on('change', function() {
            textures.selected.reopen()
        })
    }
}
function loadTextureMenu(tex) {
    var arr = tex.path.split(osfs)
    arr.splice(-1)
    var path = arr.join('<span class="slash">/</span>') + '<span class="slash">/</span><span class="accent_color">' + tex.name + '</span>'
    $('#texture_edit #te_title').text(tex.name)
    $('#texture_edit #te_path').html(path)
    $('#texture_edit input#te_variable').val(tex.id)
    $('#texture_edit input#te_folder').val(tex.folder)
    $('#texture_menu_thumbnail').html(tex.img)
}
function saveTextureMenu() {
    hideDialog()
    index = getSelectedTextureIndex()
    if (index === false) return;
    var tex = textures[index]
    tex.id = $('#texture_edit input#te_variable').val()
    tex.folder = $('#texture_edit input#te_folder').val()

    $('#texture_edit #change_file_button').unbind('click')
    $('#texture_edit #file_upload').unbind('input')
}
function loadTextureDraggable() {
    Vue.nextTick(function() {
        setTimeout(function() {
            $('li.texture').draggable({
                revertDuration: 0,
                helper: function(e) {
                    var t = $(e.target)
                    if (!t.hasClass('texture')) t = t.parent()
                    if (!t.hasClass('texture')) t = t.parent()
                    return t.find('.texture_icon_wrapper').clone().addClass('texture_drag_helper').attr('texid', t.attr('texid'))
                },
                cursorAt: { left: 24, top: 24 },
                revert: 'invalid',
                appendTo: 'body',
                zIndex: 19,
                stop: function(event, ui) {
                	setTimeout(function() {
                		if ($('canvas#canvas:hover').length > 0) {
                			if (canvasClick(event)) {
                				getTextureById(ui.helper.attr('texid')).apply()
                			}
                		}
                	}, 10)
                }
            })
        }, 42)
    })
}