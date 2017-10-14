var app           = require('electron').remote,
    fs            = require('fs'),
    nativeImage   = require('electron').nativeImage,
    exec          = require('child_process').exec,
    originalFs    = require('original-fs'),
    http          = require('http'),
    currentwindow = app.getCurrentWindow(),
    dialog_win    = null,
    latest_version= false,
    preventClosing= true;

const shell = require('electron').shell;
const {clipboard} = require('electron')

$(document).ready(function() {
    if (app.process.argv.length >= 2) {
        if (app.process.argv[1].substr(-5) == '.json') {
            readFile(app.process.argv[1], true)
        }
    }
    $('.open-in-browser').click((event) => {
        event.preventDefault();
        shell.openExternal(event.target.href);
        return true;
    });
    $('.web_only').remove()
})


getLatestVersion(true)
//Called on start to show message
function getLatestVersion(init) {
    $.getJSON('http://blockbench.net/api/index.json', function(data) {
        if (data.version) {
            latest_version = data.version
            if (latest_version !== appVersion && init === true) {
                showDialog('update_notification')
                $('.dialog#update_notification h2 span').text(latest_version)
                console.log('Found new version: '+latest_version)
            } else if (init === false) {
                checkForUpdates()
            } else {
            }
        }
    }).fail(function() {
        latest_version = false
    })
}



function checkForUpdates(instant) {
    showDialog('updater')
    setProgressBar('update_bar', 0, 1)
    var data;
    if (latest_version === false) {
        data = [
            '<div class="tool" onclick="refreshUpdateDialog()">',
                '<i class="material-icons">refresh</i>',
                '<div class="tooltip">Refresh</div>',
            '</div>',
            '<div class="dialog_bar narrow">',
            '<i class="material-icons blue_icon">cloud_off</i>No internet connection',
            '</div>'
        ].join('')
    } else if (latest_version !== appVersion) {
        data = [
            '<div class="dialog_bar narrow">Latest version: '+latest_version+'</div>',
            '<div class="dialog_bar narrow">Installed version: '+appVersion+'</div>',
            '<div class=""><button type="button" class="large uc_btn" id="update_button" onclick="installUpdate()">Update</button></div>'
        ].join('')
        if (instant) {
            setTimeout(function() {
                installUpdate()
            }, 60)
        }
    } else {
        data = [
            '<div class="tool" onclick="refreshUpdateDialog()">',
                '<i class="material-icons">refresh</i>',
                '<div class="tooltip">Refresh</div>',
            '</div>',
            '<div class="dialog_bar narrow">',
            '<i class="material-icons blue_icon">check</i>Blockbench is up-to-date!',
            '</div>'
        ].join('')
    }
    $('#updater_content').html(data)
}
function refreshUpdateDialog() {
    data = '<div class="dialog_bar narrow"><i class="material-icons blue_icon spinning">refresh</i>Clearing cache data</div>'
    $('#updater_content').html(data)
    currentwindow.webContents.session.clearCache(function() {
        data = '<div class="dialog_bar narrow"><i class="material-icons blue_icon spinning">refresh</i>Connecting to server</div>'
        $('#updater_content').html(data)
        getLatestVersion(false)
    })
}

function installUpdate() {
    console.log('Starting Update')
    var received_bytes = 0;
    var total_bytes = 0;

    $('.uc_btn').attr('disabled', true)

    var asar_path = __dirname
    if (asar_path.includes('.asar') === false) {
        asar_path = asar_path + osfs+'resources'+osfs+'app.asar'
    }

    var file = originalFs.createWriteStream(asar_path)

    var request = http.get("http://blockbench.net/api/app.asar", function(response) {
        response.pipe(file);

        total_bytes = parseInt(response.headers['content-length']);

        response.on('end', updateInstallationEnd)
        response.on('data', function(chunk) {
            received_bytes += chunk.length;
            setProgressBar('update_bar', received_bytes / total_bytes, 1);
        })
    });
}

function updateInstallationEnd() {
    hideDialog()
    var exe_path = __dirname.split(osfs)
    exe_path.splice(-2)
    exe_path = exe_path.join(osfs)+osfs+'blockbench.exe'
    if (showSaveDialog(true)) {
        exec(exe_path)
    } else {
        showQuickMessage('Restart the app to update')
    }
}

function openDefaultTexturePath() {
    var answer = app.dialog.showMessageBox(currentwindow, {
        type: 'info',
        buttons: ['Remove', 'Continue'],
        noLink: true,
        title: 'Info',
        message: 'Select "textures"-folder of the default resource pack',
        detail: 'Extract the default resource pack from the Minecraft jar or google and download it. Then locate the "textures" folder and open it. Blockbench will remember that location and try to fetch textures from there if it can\'t find them in the current resource pack.',
    })
    if (answer === 0) {
        settings.default_path = {value: false, hidden: true}
    } else {
         app.dialog.showOpenDialog(currentwindow, {
            title: 'Select default "textures" Folder',
            properties: ['openDirectory'],
        }, function(filePaths) {
            settings.default_path = {value: filePaths[0], hidden: true}
        })
    }
}


//Save Dialogs
function saveFileBlock() {
    app.dialog.showSaveDialog(currentwindow, {
        filters: [ {
            name: 'JSON Model',
            extensions: ['json']
        }],
        defaultPath: Project.name
    }, function (fileName) {
        if (fileName === undefined) {
            return;
        }
        Prop.file_path = fileName;
        saveFile()
    })
}
function saveFileOptifine() {
    app.dialog.showSaveDialog(currentwindow, {
        filters: [ {
            name: 'Optifine Model',
            extensions: ['jpm']
        } ],
        defaultPath: Project.name
    }, function (fileName) {
        if (fileName === undefined) {
            return;
        }
        var content = buildOptifineModel()
        fs.writeFile(fileName, content, function (err) {
            if (err) {
                console.log('Error Saving Entity Model: '+err)
            }
            showQuickMessage('Saved as Optifine entity model')
        })
    })
}
function saveFileEntity() {
    app.dialog.showSaveDialog(currentwindow, {
        filters: [ {
            name: 'Entity Model',
            extensions: ['json']
        }],
        defaultPath: Project.name
    }, function (fileName) {
        if (fileName === undefined) {
            return;
        }
        var content = buildEntityModel(false)

        fs.readFile(fileName, 'utf-8', function (errx, data) {
            var obj = {}
            if (!errx) {
                try {
                    obj = JSON.parse(data)
                } catch (err) {
                    console.log(err)
                }
            }
            var model_name = Project.parent
            if (model_name == '') model_name = 'geometry.unknown'
            obj[model_name] = content
            content = autoStringify(obj)

            fs.writeFile(fileName, content, function (err) {
                if (err) {
                    console.log('Error Saving Entity Model: '+err)
                }
                showQuickMessage('Saved as bedrock entity model')
            })

        })

    })
}
function saveFileObj() {
    app.dialog.showSaveDialog(currentwindow, {filters: [ {name: 'Alias Wavefront', extensions: ['obj']} ]}, function (fileName) {
        if (fileName === undefined) {
            return;
        }
        scene.remove(three_grid)
        scene.remove(Transformer)
        var exporter = new THREE.OBJExporter();
        var content = exporter.parse( scene, pathToName(fileName, false));
        scene.add(three_grid)
        scene.add(Transformer)

        //OBJECT
        fs.writeFile(fileName, content.obj, function (err) {})

        //MATERIAL
        fs.writeFile(fileName.split('.obj').join('.mtl'), content.mtl, function (err) {})

        //IMAGES
        if (settings.obj_textures.value === true) {
            for (var key in content.images) {
                if (content.images.hasOwnProperty(key) && content.images[key].path) {
                    var native_image_instance = nativeImage.createFromPath(content.images[key].path)
                    var image = native_image_instance.toPNG()
                    var image_path = fileName.split(osfs)
                    image_path.pop()
                    image_path = image_path.join(osfs) + osfs + content.images[key].name

                    fs.writeFile(image_path, image, function (err) {})
                }
            }
        }
        showQuickMessage('Saved as obj model')
    })
}


//Writers
function saveFile(props) {
    if (Prop.file_path !== 'Unknown') {
        var content = buildBlockModel(true)
        Prop.project_saved = true;
        $('title').text(pathToName(Prop.file_path, false)+' - Blockbench')
        fs.writeFile(Prop.file_path, content, function (err) {
            if (err) {
                console.log('Error Saving File: '+err)
            }
            if (props && props.closeAfter) {
                preventClosing = false
                setTimeout(function() {
                    currentwindow.close()
                }, 12)
            }
            showQuickMessage('Saved as '+ pathToName(Prop.file_path, true))
        })
    } else {
        saveFileBlock()
    }
}

//Open
function openFile(makeNew) {
    app.dialog.showOpenDialog(currentwindow, {filters: [{name: 'Model', extensions: ['json']}]}, function (fileNames) {
        if (fileNames !== undefined) {
            readFile(fileNames[0], makeNew)
        }
    })
}
function readFile(filepath, makeNew) {
    fs.readFile(filepath, 'utf-8', function (err, data) {
        if (err) {
            console.log(err)
            return;
        }
        loadFile(data, filepath, makeNew)
    })
}
function openTexture() {
    var start_path;
    if (textures.length > 0) {
        var arr = textures[0].path.split(osfs)
        arr.splice(-1)
        start_path = arr.join(osfs)
    } else if (Prop.file_name) {
        var arr = Prop.file_path.split(osfs)
        arr.splice(-3)
        arr.push('textures')
        start_path = arr.join(osfs)
    }
    app.dialog.showOpenDialog(currentwindow, {
        properties: ['openFile', 'multiSelections'],
        defaultPath: start_path,
        filters: [{
            name: 'PNG Texture',
            extensions: ['png']
        }]
    }, function (fileNames) {
        if (fileNames !== undefined) {
            fileNames.forEach(function(path) {
                fs.readFile(path, function (err) {
                    if (err) {
                        console.log(err)
                    }
                    new Texture().fromPath(path).add().fillParticle()
                })
            })
        }
    })
}
function importExtrusion(makeNew) {
   app.dialog.showOpenDialog(currentwindow, {
        properties: ['openFile'],
        filters: [{
            name: 'PNG Texture',
            extensions: ['png']
        }]
    }, function (fileNames) {
        if (fileNames !== undefined) {
            var path = fileNames[0] 
            fs.readFile(path, function (err) {
                if (err) {
                    console.log(err)
                }
                if (makeNew === true) {
                    if (newProject() == false) return;
                }
                g_makeNew = makeNew

                new Texture().fromPath(path).add().fillParticle()

                showDialog('image_extruder')
                drawExtrusionImage(path)
            })
        }
    })
}

function dropTexture(ev) {
    ev.preventDefault();
    ev.stopPropagation();
}
function loadBackgroundImage(event) {
    if (event !== undefined) {
        if (event.altKey === true) {
            textPrompt('Background Image Path', 'active_scene.background.image', true)
            return;
        }
    }
    app.dialog.showOpenDialog(currentwindow, {properties: ['openFile'], filters: [{name: 'Image', extensions: ['png', 'jpg', 'jpg', 'jpeg', 'gif']}]}, function (fileNames) {
        if (fileNames !== undefined) {
            active_scene.background.image = fileNames[0]
            enterScene(true)
        }
    })
}


function setZoomLevel(mode) {
    switch (mode) {
        case 'in':    Prop.zoom += 5;  break;
        case 'out':   Prop.zoom -= 5;  break;
        case 'reset': Prop.zoom = 100; break;
    }
    var level = (Prop.zoom - 100) / 12
    currentwindow.webContents.setZoomLevel(level)
    setScreenRatio()
}

window.onbeforeunload = function() {
    if (preventClosing === true) {
        setTimeout(function() {
            showSaveDialog(true)
        }, 2)
        return true;
    }
}
document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault()
}
document.body.ondrop = (ev) => {
    if (ev.dataTransfer == undefined) {
        return; 
    }
    if (ev.dataTransfer.files[0] != undefined) {
        ev.preventDefault()
        if (ev.dataTransfer.files[0].path.substr(-4).toUpperCase() == 'JSON') {
            readFile(ev.dataTransfer.files[0].path, true)
        } else if (ev.dataTransfer.files[0].path.substr(-7).toUpperCase() == 'BBSTYLE') {

            fs.readFile(ev.dataTransfer.files[0].path, 'utf-8', function (err, data) {
                if (err) {
                    console.log(err)
                    return;
                }
                applyBBStyle(data)
            })


        } else if (ev.dataTransfer.files[0].path.substr(-3).toUpperCase() == 'PNG') {

            if (ev.target == canvas1) {
                active_scene.background.image = ev.dataTransfer.files[0].path
                enterScene(true)
            } else {

                var fileArray = ev.dataTransfer.files;
                var len = fileArray.length;

                for (var i = 0; i < len; i++) {
                    new Texture().fromPath(fileArray[i].path).add().fillParticle()
                }


                textures.forEach(function(s) {
                    if (s === textures[textures.length-1]) {
                        s.selected = true;
                    } else {
                        s.selected = false;
                    }
                })
                loadTextureDraggable()
            }
        }
    }
}

function showSaveDialog(close) {
    /*
    if (Prop.project_saved === false && elements.length > 0) {
        var answer = confirm('Your current work will be lost. Are you sure?')
        if (answer == true) {
            if (close === true) {
                preventClosing = false
                setTimeout(function() {
                    currentwindow.close()
                }, 12)
            }
            return true;
        } else {
            return false;
        }
    } else {
        if (close === true) {
            preventClosing = false
            setTimeout(function() {
                currentwindow.close()
            }, 12)
        }
        return true;
    }*/
    if (Prop.project_saved === false && elements.length > 0) {
        var answer = app.dialog.showMessageBox(currentwindow, {
            type: 'question',
            buttons: ['Save', 'Discard', 'Cancel'],
            title: 'Blockbench',
            message: 'Do you want to save your model?',
            noLink: true
        })
        if (answer === 0) {
            saveFile({closeAfter: close})
            return false;
        } else if (answer === 2) {
            return false;
        } else {
            if (close === true) {
                preventClosing = false
                setTimeout(function() {
                    currentwindow.close()
                }, 12)
            }
            return true;
        }
    } else {
        if (close === true) {
            preventClosing = false
            setTimeout(function() {
                currentwindow.close()
            }, 12)
        }
        return true;
    }
}
