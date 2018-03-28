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
	    this.mode = 'link' //link, bitmap
	    if (!isApp) this.mode = 'bitmap'
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
	load(isDefault, reloading, cb) {
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
            if (isApp && !isDefault && scope.mode !== 'bitmap' && !Blockbench.entity_mode) {
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
            if (img.naturalWidth !== img.naturalHeight && Blockbench.entity_mode === false) {
                if (img.naturalHeight % img.naturalWidth === 0) {
                    scope.frameCount = img.naturalHeight / img.naturalWidth
                    Canvas.updateAllUVs()
                } else {
                    scope.error = true;
                    showQuickMessage('Texture needs to be square')
                }
            }
            if (Blockbench.entity_mode && textures.indexOf(scope) === 0 && !reloading && !scope.keep_size) {
                Project.texture_width = img.naturalWidth
                Project.texture_height = img.naturalHeight
                if (selected.length) {
                	main_uv.loadData()
                	main_uv.setGrid()
                }
            }
            if ($('.dialog#texture_edit:visible').length >= 1 && scope.selected === true) {
                scope.openMenu()
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
		this.mode = 'link'
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
		this.mode = 'bitmap'
		this.load()
		return this;
	}
	fromDefaultPack() {
		if (settings.default_path && settings.default_path.value) {
			this.mode = 'link'
			console.log('Trying to get texture from default pack')
			this.path = settings.default_path.value + osfs + this.folder + osfs + this.name
			this.iconpath = this.path + '?' + tex_version
			this.load(true)
		}
	}
	reopen() {
		var scope = this;
		if (isApp) {
		    app.dialog.showOpenDialog(currentwindow, {
		    	filters: [{name: 'PNG Texture', extensions: ['png']}],
		    	defaultPath: scope.path
		    }, function (fileNames) {
		        if (fileNames !== undefined) {
		            fs.readFile(fileNames[0], function (err) {
		                if (err) {
		                    console.log(err)
		                }
		                scope.path = fileNames[0]
		                scope.iconpath = scope.path + '?' + tex_version;
		                scope.name = scope.path.split(osfs).slice(-1)[0]
		                scope.mode = 'link'

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
		if (this.mode === 'bitmap') {
			return false;
		}
		if (single) {
        	tex_version++;
		}
		this.iconpath = this.path + '?' + tex_version;
        this.iconpath = this.iconpath.replace(/\?\d+$/, '?' + tex_version)
        this.load(undefined, true)
		if (single) {
	        //Canvas.updateAllFaces()
	        main_uv.loadData()
	        loadTextureDraggable()
		}
	}
	reloadTexture() {
		this.refresh(true)
	}
	updateMaterial() {
		var scope = this;
        var img = new Image()
        try {
            img.src = scope.iconpath
        } catch(err) {
        }
        var tex = new THREE.Texture(img)
        img.tex = tex;
        img.tex.magFilter = THREE.NearestFilter
        img.tex.minFilter = THREE.NearestFilter
        img.onload = function() {
            this.tex.needsUpdate = true;
        	Canvas.materials[scope.uuid].map = tex
        }
		return this;
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
	javaTextureLink() {
		return this.folder+'/'+this.name.split('.png').join('')
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
		var scope = this
        if (path.includes(osfs+'textures'+osfs)) {
            var arr = path.split(osfs+'textures'+osfs)
            arr = arr[arr.length-1].split(osfs)
            arr.pop()
            scope.folder = arr.join('/')
        } else {
            var arr = path.split(osfs)
            scope.folder = arr[arr.length-2]
            if (Blockbench.entity_mode === false) {
				Blockbench.showMessageBox({
		            title: 'Texture Import',
		            icon: 'folder_open',
		            message: 'The imported texture is not contained in a resource pack. Minecraft can only load textures inside the textures folder of a loaded resource pack.',
		            buttons: ['Change Path', 'OK'],
		            confirm: 0,
		            cancel: 1
		        }, function(result) {
		        	if (result === 0) {
		        		scope.reopen()
		        	}
				})
			}
        }
	    return this;
	}
	add() {
		var scope = this
		if (!textures.includes(this)) {
			textures.push(this)
		}
        Blockbench.dispatchEvent( 'add_texture', {texture: this})
		loadTextureDraggable()

		if (Blockbench.entity_mode && elements.length) {
		    var sides = ['north', 'east', 'south', 'west', 'up', 'down']
		    elements.forEach(function(s) {
		        sides.forEach(function(side) {
		            s.faces[side].texture = '#'+scope.id
		        })
		    })
		    Canvas.updateAllFaces()
		    if (selected.length) {
		    	main_uv.loadData()
		    }
		    textures.forEach(function (t, i) {
		    	if (t !== scope) {
	    			textures.splice(i, 1)
		    	}
		    })
		    setUndo('Loaded Texture')
		}
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
	    if (all || Blockbench.entity_mode) {
	        var sides = ['north', 'east', 'south', 'west', 'up', 'down']
	    } else {
	        var sides = [main_uv.face]
	    }
	    selected.forEach(function(obj) {
	        sides.forEach(function(side) {
	            obj.faces[side].texture = '#'+scope.id
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
	showContextMenu(event) {
		var scope = this;
        var menu_points = [
            {icon: 'crop_original',     name: 'Apply to Faces', condition: Blockbench.entity_mode === false && selected.length > 0, click: function() {scope.apply()}},
            {icon: 'fa-cube',           name: 'Apply to Cubes', condition: Blockbench.entity_mode === false && selected.length > 0, click: function() {scope.apply(true)}},
            {icon: 'refresh',           name: 'Refresh', condition: (isApp && scope.mode === 'link'), click: function() {scope.reloadTexture()}},
            {icon: 'folder',            name: 'Open in Folder', condition: (isApp && scope.mode === 'link'), click: function() {scope.openFolder()}},
            {icon: 'border_vertical',   name: 'Convert to Bitmap', condition: (isApp && scope.mode === 'link'), click: function() {scope.toBitmap()}},
            {icon: 'file_download',     name: 'Export', condition: (scope.mode !== 'link'),click: function() {scope.download()}},
            {icon: 'delete',            name: 'Delete', click: function() { scope.remove()}},
            {icon: 'list',              name: 'Properties', click: function() { scope.openMenu()}}
        ]
        new ContextMenu(event, menu_points)
	}
	openMenu() {
	    var scope = this
	    scope.select()
	    showDialog('texture_edit')

	    var arr = scope.path.split(osfs)
	    arr.splice(-1)
	    var path = arr.join('<span class="slash">/</span>') + '<span class="slash">/</span><span class="accent_color">' + scope.name + '</span>'
	    $('#texture_edit #te_title').text(scope.name + ' ('+scope.img.naturalWidth+' x '+scope.img.naturalHeight+')')
	    $('#texture_edit #te_path').html(path)
	    $('#texture_edit input#te_variable').val(scope.id)
	    $('#texture_edit input#te_name').val(scope.name)
	    $('#texture_edit input#te_folder').val(scope.folder)
	    $('#texture_menu_thumbnail').html(scope.img)

	    if (scope.mode === 'link') {
	    	$('#texture_edit .tool.link_only').show()
	    	$('#texture_edit .tool.bitmap_only').hide()
	    } else {
	    	$('#texture_edit .tool.link_only').hide()
	    	$('#texture_edit .tool.bitmap_only').show()
	    }

	    if (isApp) {
	        $('#texture_edit #change_file_button').click( function() {
	            scope.reopen()
	        })
	    } else {
	        $('#texture_edit #texture_change').off('change')
	        $('#texture_edit #texture_change').on('change', function() {
	            scope.reopen()
	        })
	    }
	}
	download(linkBack) {
		var scope = this;
		if (isApp) {
			function writeOnApp(linkBack) {
				var find_path;
				if (Blockbench.entity_mode) {
					find_path = findEntityTexture(Project.parent, true)
				}
				app.dialog.showSaveDialog(currentwindow, {
	            	filters: [ {name: 'Texture', extensions: ['png']} ],
	        		defaultPath: (find_path ? find_path : scope.path)
	        	}, function (fileName) {
	                if (fileName === undefined) {
	                    return;
	                }
	                if (scope.mode === 'link') {
	                	var image = nativeImage.createFromPath(scope.iconpath).toPNG()
	                } else {
	                	var image = nativeImage.createFromDataURL(scope.iconpath).toPNG()
	                }

	                fs.writeFile(fileName, image, function (err) {
	                	if (linkBack) {
	                		scope.toLink(fileName)
				    		Blockbench.showMessage('Linked Texture and File', 'center')
	                	}
	                })
	            })
			}
			if (linkBack) {
				writeOnApp(true)
			} else if (scope.mode === 'bitmap') {
				Blockbench.showMessageBox({
		            title: 'Export Texture',
		            icon: 'present_to_all',
		            message: 'Do you want to link the exported texture back in?',
		            buttons: ['Export and Link', 'Export Only'],
		            confirm: 0,
		            cancel: 1
		        }, function(result) {
		        	writeOnApp(result === 0)
				})
			} else {
				writeOnApp(false)
			}
		} else {
			var download = document.createElement('a');
			download.href = scope.iconpath
			download.download = scope.name;
			download.click();
		}
	}
	toLink(link) {
		if (link && isApp && this.mode === 'bitmap') {
	        tex_version++;
            this.fromPath(link)
			Undo.add('Converted texture', true)
			return this;
		} else {
			return false;
		}
	}
	toBitmap() {
		var scope = this;
		if (isApp && scope.mode === 'link') {
			Jimp.read(scope.iconpath).then(function (image) {
				image.getBase64(Jimp.MIME_PNG, function(err, dataUrl) {
				    scope.mode = 'bitmap'
				    scope.iconpath = dataUrl
				    Blockbench.showMessage('Converted Texture to Bitmap', 'center')
				    Undo.add('Converted texture', true)
				})
			})
		} else {
			return false;
		}
	}
	convert() {
		if (!isApp) {
			Blockbench.showMessage('Converting textures is not possible in the webapp.', 'center')
			return;
		}
		var scope = this;
		Blockbench.showMessageBox({
	        title: 'Convert Texture',
	        icon: 'compare',
	        message: 'Do you want to convert the texture to '+ (scope.mode === 'bitmap' ? ' a linked texture' : ' a bitmap') +'?'+
	        '<br><b>Link:</b> The texture is saved on the computer and linked to Blockbench.'+
	        '<br><b>Bitmap:</b> The texture only exists in Blockbench and can be modified in it.',
	        buttons: ['Convert', 'Cancel'],
	        confirm: 0,
	        cancel: 1
	    }, function(result) {
	    	if (result === 0) {
	    		if (scope.mode === 'link') {
					scope.toBitmap()
				} else if (isApp) {
					scope.download(true)
				}
	    	}
		})
	}
	highlightModeToggle() {
		var icon = $('.texture[texid="'+this.id+'"] i.texture_mode_toggle')
		var x = 0;
		icon.addClass('highlighted_icon')
		var interval = setInterval(function() {
			if (x%2 === 0) {
				icon.removeClass('highlighted_icon')
			} else {
				icon.addClass('highlighted_icon')
			}
			if (x > 3) {
				clearInterval(interval)
			}
			x++;
		}, 200)
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
    	if (t.mode === 'link') {
	        t.iconpath = t.path + '?' + tex_version;
	        t.refresh(false)
	    }
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
function saveTextureMenu() {
    hideDialog()
    index = getSelectedTextureIndex()
    if (index === false) return;
    var tex = textures[index]
    if (tex.mode === 'bitmap') {
    	tex.name = $('#texture_edit input#te_name').val()
    }
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
                			var data = Canvas.raycast()
                			if (data.cube && data.face) {
                				var tex = getTextureById(ui.helper.attr('texid'))
                				if (tex) {
                					data.cube.applyTexture(tex, [data.face])
                				}
                			}
                		}
                	}, 10)
                }
            })
        }, 42)
    })
}
function unselectTextures() {
	textures.forEach(function(s) {
        s.selected = false;
    })
    textures.selected = false
}

function createTexture() {
	var texture = new Texture({folder: 'folder', name: 'name'}).add().fromDataURL().fillParticle()
}