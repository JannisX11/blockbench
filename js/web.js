(function() {
	$.getScript("lib/file_saver.js");
})()


$(document).ready(function() {
	$('.open-in-browser').click((event) => {
		   event.preventDefault();
		   window.open(event.target.href, '_blank');
	});
})



function tryLoadPOSTModel() {
	if ($('#post_model').text() !== '') {
		if ($('#post_textures').text() !== '') {
			Project.dataURLTextures = true
		}
		loadModel($('#post_model').text(), 'model')
		//$('#post_model').remove()
		if ($('#post_textures').text() !== '') {
			var data = JSON.parse( $('#post_textures').text() )
			for (var key in data) {
				if (data.hasOwnProperty(key)) {
					var tex = getTextureById(key+'');
					if (tex) {
						tex.img.src = ''
                        tex.source = 'data:image/png;base64,'+data[key]
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



//Saver
function writeFileEntity() {
	var obj = {}
	var model_name = Project.parent
	if (model_name == '') model_name = 'geometry.unknown'
	obj[model_name] = buildEntityModel({raw: true})

	var data = autoStringify(obj)
	var blob = new Blob([data], {type: "text/plain;charset=utf-8"});
	saveAs(blob, 'mobs.json', {autoBOM: true})
	Blockbench.showQuickMessage('Saved as bedrock entity model')
}
function writeFileObj() {
	var content = buildOBJModel('model')
	//OBJECT
	var blob_obj = new Blob([content.obj], {type: "text/plain;charset=utf-8"});
	var obj_saver = saveAs(blob_obj, 'model.obj', {autoBOM: true})

	obj_saver.onwriteend = function() {
		//MATERIAL
		var blob_mtl = new Blob([content.mtl], {type: "text/plain;charset=utf-8"});
		saveAs(blob_mtl, 'model.mtl', {autoBOM: true}).onwriteend = function() {
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
						Blockbench.showQuickMessage(tl('message.save_obj'))
					}
				}
				saveTex()
			} else {
				Blockbench.showQuickMessage(tl('message.save_obj'))
			}
		}
	}
}

function saveFile() {
	var data = buildBlockModel()
	var blob = new Blob([data], {type: "text/plain;charset=utf-8"});
	saveAs(blob, 'model.json', {autoBOM: true})
}

//Misc
window.onbeforeunload = function() {
	if (Prop.project_saved === false && elements.length > 0) {
		return true;
	}
}
function showSaveDialog(close) {
	var unsaved_textures = 0;
	textures.forEach(function(t) {
		if (!t.saved) {
			unsaved_textures++;
		}
	})
	if ((Prop.project_saved === false && elements.length > 0) || unsaved_textures) {

		var answer = confirm(tl('message.close_warning.web'))
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