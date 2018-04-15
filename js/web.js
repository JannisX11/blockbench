(function() {
	$.getScript("js/file_saver.js");
})()

$('.open-in-browser').click((event) => {
       event.preventDefault();
       window.open(event.target.href, '_blank');
});
var lastImportEvent;



document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault()
}
document.body.ondrop = (ev) => {
    if (ev.dataTransfer == undefined) {
        return; 
    }
    if (ev.dataTransfer.files[0] != undefined) {
        ev.preventDefault()
        var file = ev.dataTransfer.files[0]
        var reader = new FileReader()

        if (file.name.substr(-4).toUpperCase() == 'JSON') {

            reader.onloadend = function() {
                loadFile(reader.result, 'model', true)
            }
            if (file) {
                reader.readAsText(file)
            }
        } else if (file.name.length > 6 && file.name.substr(-7).toUpperCase() == 'BBSTYLE') {
            
            reader.onloadend = function() {
                applyBBStyle(reader.result)
            }
            if (file) {
                reader.readAsText(file)
            }


        } else if (file.name.substr(-3).toUpperCase() == 'PNG') {


            if (ev.target == canvas1) {
                reader.onloadend = function() {
                    //background
                    active_scene.background.image = reader.result
                    enterScene(true)
                }
                if (file) {
                    reader.readAsDataURL(file)
                }
            } else {
                if ($('li.texture').has(ev.target).length) {
                    var id = $('li.texture').has(ev.target).attr('texid')
                    var texture = getTextureById(id)
                    if (texture && texture.error) {
                        reader.onloadend = function() {
                            texture.fromDataURL(reader.result)
                        }
                        reader.readAsDataURL(file)
                        return;
                    }
                }
                //texture
                var fileArray = ev.dataTransfer.files;
                var len = fileArray.length;

                function addTex(file, name) {
                    var reader = new FileReader()
                    reader.onloadend = function() {
                        new Texture({folder: 'blocks', name: name}).add().fromDataURL(reader.result).fillParticle()
                    }
                    reader.readAsDataURL(file)
                }

                var i = 0;
                while (fileArray[i]) {
                    addTex(fileArray[i], fileArray[i].name)
                    i++;
                }
                loadTextureDraggable()
                
            }

        }
    }
}


function tryLoadPOSTModel() {
    if ($('#post_model').text() !== '') {
        if ($('#post_textures').text() !== '') {
            Project.dataURLTextures = true
        }
        loadFile($('#post_model').text(), 'model', true)
        //$('#post_model').remove()
        if ($('#post_textures').text() !== '') {
            var data = JSON.parse( $('#post_textures').text() )
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    var tex = getTextureById(key+'');
                    if (tex) {
                        tex.img.src = ''
                        tex.source = data[key]
                    }
                }
            }
            textures.forEach(function(tex) {
                tex.load()
            })
        }
        return true;
    } else {
        return false
    }
}

//Loader Open
function openFile(makeNew) {
    g_makeNew = makeNew
	fileLoaderLoad('.json', false, readFile)
    $('#file_folder').val('')
}
function importExtrusion(makeNew) {
    g_makeNew = makeNew
    fileLoaderLoad('.png', true, readExtrusion)
}
//Texture
function openTexture() {
    fileLoaderLoad('.png', true, readTexture)
}
function loadBackgroundImage(event) {
    if (event !== undefined) {
        if (event.altKey === true) {
            textPrompt('Background Image Path', 'active_scene.background.image', true)
            return;
        }
    }
    fileLoaderLoad('image/*', false, readBackgroundImage)
}
//Main
function fileLoaderLoad(type, showInputs, importFunction) {
    //Meta
    $('#file_name').val('')
    if (showInputs === true) {
        $('#file_loader_meta').show()
    } else {
        $('#file_loader_meta').hide()
    }
    //Loader
    $('#file_upload').attr('accept', type)

    //Clear Events
    try {
        $('#web_import_btn')[0].removeEventListener('click', lastImportEvent)
        $('#file_upload')[0].removeEventListener('change', lastImportEvent)
    } catch (err) {}
    //Add Events
    $('#web_import_btn')[0].addEventListener('click', importFunction)
    $('#file_upload')[0].addEventListener('change', function() {
        var path_parts = $(this).val().split('\\')
        $('#file_name').val(path_parts[path_parts.length-1])
    })
    lastImportEvent = importFunction

    showDialog('file_loader')
}


//Loader Read
function readTexture(file) {
	hideDialog()
	var file = $('#file_upload').get(0).files[0]
	var reader = new FileReader()
	reader.onloadend = function() {
		var path = reader.result

        var name = $('#file_name').val()
        if (name == undefined) {
            name = 'Texture'
        }
        
        var folder = $('#file_folder').val()
        if (folder == "") {
            folder = "blocks"
        }

        new Texture({folder: folder, name: name}).add().fromDataURL(path).fillParticle()

	}
	if (file) {
		reader.readAsDataURL(file)
	}
}
function readFile() {
	hideDialog()
	var file = $('#file_upload').get(0).files[0]
	var reader = new FileReader()
	reader.onloadend = function() {
	
		loadFile(reader.result, 'model', g_makeNew)
	}
	if (file) {
		reader.readAsText(file)
	} else {

	}
}
function reopenTexture(texture) {
	var file = $('.dialog:visible #texture_change').get(0).files[0]
	var reader = new FileReader()
	reader.onloadend = function() {
        
        texture.source = reader.result
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
        var thisTexture = texture;
        img.onload = function() {
            this.tex.needsUpdate = true;
            thisTexture.res = img.naturalWidth;
        }
        texture.material = new THREE.MeshBasicMaterial({color: 0xffffff, map: tex, transparent: true});
        texture.reload()
        Canvas.updateAllFaces()
        Blockbench.dispatchEvent( 'change_texture_path', {texture: texture} )
	}
	if (file) {
		reader.readAsDataURL(file)
	}
}
function readExtrusion() {
    hideDialog()
    var file = $('#file_upload').get(0).files[0]
    var reader = new FileReader()

    reader.onloadend = function() {
        if (g_makeNew) {
            if (newProject() == false) return;
        }
        var path = reader.result

        var name = $('#file_name').val()
        if (name == undefined) {
            name = 'Texture'
        }
        
        var folder = $('#file_folder').val()
        if (folder == "") {
            folder = "blocks"
        }

        new Texture({folder: folder, name: name}).add().fromDataURL(path).fillParticle()

        showDialog('image_extruder')
        drawExtrusionImage(path)

    }
    if (file) {
        reader.readAsDataURL(file)
    } else {

    }
}
function readBackgroundImage() {
    hideDialog()
    var file = $('#file_upload').get(0).files[0]
    var reader = new FileReader()
    reader.onloadend = function() {
        var path = reader.result
        active_scene.background.image = path
        enterScene(true)
    }
    if (file) {
        reader.readAsDataURL(file)
    }
}

//Saver
function saveFileBlock() {
    saveFile()
}
function saveFileOptifine() {
    var data = buildOptifineModel()
    var blob = new Blob([data], {type: "text/plain;charset=utf-8"});
    saveAs(blob, 'model.jpm')
    showQuickMessage('Saved Optifine entity model')
}
function saveFileEntity() {
    var obj = {}
    var model_name = Project.parent
    if (model_name == '') model_name = 'geometry.unknown'
    obj[model_name] = buildEntityModel({raw: true})

    var data = autoStringify(obj)
    var blob = new Blob([data], {type: "text/plain;charset=utf-8"});
    saveAs(blob, 'mobs.json')
    showQuickMessage('Saved as bedrock entity model')
}
function saveFileObj() {
    var content = buildOBJModel('model')
    //OBJECT
    var blob_obj = new Blob([content.obj], {type: "text/plain;charset=utf-8"});
    var obj_saver = saveAs(blob_obj, 'model.obj')

    obj_saver.onwriteend = function() {
        //MATERIAL
        var blob_mtl = new Blob([content.mtl], {type: "text/plain;charset=utf-8"});
        saveAs(blob_mtl, 'model.mtl').onwriteend = function() {
            if (settings.obj_textures.value === true) {
                var tex_i = 0
                function saveTex() {
                    if (textures[tex_i] && content.images.hasOwnProperty(textures[tex_i].id)) {
                        var image_data = atob(textures[tex_i].source.split(',')[1]);
                        var arraybuffer = new ArrayBuffer(image_data.length);
                        var view = new Uint8Array(arraybuffer);
                        for (var i=0; i<image_data.length; i++) {
                            view[i] = image_data.charCodeAt(i) & 0xff;
                        }
                        var blob = new Blob([arraybuffer], {type: 'application/octet-stream'})
                        var img_saver = saveAs(blob, textures[tex_i].name)
                        img_saver.onwriteend = function() {
                            tex_i++
                            saveTex()
                        }
                    } else if (textures[tex_i]) {
                        tex_i++
                        saveTex()
                    } else {
                        showQuickMessage('Saved as .obj model')
                    }
                }
                saveTex()
            } else {
                showQuickMessage('Saved as .obj model')
            }
        }
    }

}

function saveFile() {
	var data = buildBlockModel()
	var blob = new Blob([data], {type: "text/plain;charset=utf-8"});
	saveAs(blob, 'model.json')
}

//Misc
window.onbeforeunload = function() {
	if (Prop.project_saved === false && elements.length > 0) {
    	return true;
	}
}
function showSaveDialog(close) {
    if (Prop.project_saved === false && elements.length > 0) {
        var answer = confirm('Your current work will be lost. Are you sure?')
        if (answer == true) {
            if (close) {
                //preventClosing = false
            }
            return true;
        } else {
            return false;
        }
    } else {
        if (close) {
            preventClosing = false
            app.getCurrentWindow().close()
        }
        return true;
    }
}
function checkForUpdates() {
    showQuickMessage('Webapp is up-to-date')
}