var app            = require('electron').remote,
    fs             = require('fs'),
    nativeImage    = require('electron').nativeImage,
    exec           = require('child_process').exec,
    originalFs     = require('original-fs'),
    https           = require('https'),
    currentwindow  = app.getCurrentWindow(),
    dialog_win     = null,
    latest_version = false,
    preventClosing = true;
    recent_projects= undefined

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
    if (process.platform == 'linux') {
        $('#app_update_button').remove()
    }
    if (__dirname.includes('C:\\xampp\\htdocs\\blockbench\\web')) {
        Blockbench.addFlag('dev')
        $('#file_menu_list').append('<li class="menu_seperator"></li>')
        $('#file_menu_list').append('<li onclick="Blockbench.reload()"><i class="material-icons">refresh</i>Reload</li>')
    }
})

getLatestVersion(true)
//Called on start to show message
function getLatestVersion(init) {
    if (process.platform == 'linux') return;
    $.getJSON('https://blockbench.net/api/index.json', function(data) {
        if (data.version) {
            latest_version = data.version
            if (compareVersions(latest_version, appVersion) && init === true) {
                showDialog('update_notification')
                $('.dialog#update_notification h2 span').text(latest_version)
                console.log('Found new version: '+latest_version)
            } else if (init === false) {
                checkForUpdates()
            }
        }
    }).fail(function() {
        latest_version = false
    })
}
//Recent Projects
function updateRecentProjects() {
    if (recent_projects === undefined) {
        //Setup
        recent_projects = []
        var raw = localStorage.getItem('recent_projects')
        if (raw) {
            recent_projects = JSON.parse(raw)
        }
    }
    //Menu
    var list = $('ul#recent_projects')
    list.html('')
    var i = recent_projects.length-1
    while (i >= 0) {
        var p = recent_projects[i]
        var entry = $('<li onclick="readFile(\''+p.path.split('\\').join('\\\\')+'\',true)"><i class="material-icons">insert_drive_file</i>'+p.name+'</li>')
        list.append(entry)
        i--;
    }


    //Set Local Storage
    localStorage.setItem('recent_projects', JSON.stringify(recent_projects))
}
function addRecentProject(data) {
    var i = recent_projects.length-1
    while (i >= 0) {
        var p = recent_projects[i]
        if (p.path === data.path) {
            recent_projects.splice(i, 1)
        }
        i--;
    }
    recent_projects.push({name: data.name, path: data.path})
    if (recent_projects.length > 8) {
        recent_projects.shift()
    }
    updateRecentProjects()
}
//Updates
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

    $('.uc_btn').css('visibility', 'hidden')

    var asar_path = __dirname
    if (asar_path.includes('.asar') === false) {
        asar_path = asar_path + osfs+'resources'+osfs+'app.asar'
    }

    var file = originalFs.createWriteStream(asar_path)

    var request = https.get("https://blockbench.net/api/app.asar", function(response) {
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

//Default Pack
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
//Texture Paths
function findEntityTexture(mob, return_path) {
    var textures = {
        'geometry.chicken': 'chicken',
        'geometry.blaze': 'blaze',
        'geometry.llamaspit': 'llama/spit',
        'geometry.llama': 'llama/llama_creamy',
        'geometry.dragon': 'dragon/dragon',
        'geometry.ghast': 'ghast/ghast',
        'geometry.slime': 'slime/slime',
        'geometry.slime.armor': 'slime/slime',
        'geometry.lavaslime': 'slime/magmacube',
        'geometry.silverfish': 'silverfish',
        'geometry.shulker': 'shulker/shulker_undyed',
        'geometry.rabbit': 'rabbit/brown',
        'geometry.horse': 'horse/horse_brown',
        'geometry.horse.v2': 'horse2/horse_brown',
        'geometry.humanoid': 'steve',
        'geometry.creeper': 'creeper/creeper',
        'geometry.enderman': 'enderman/enderman',
        'geometry.zombie': 'zombie/zombie',
        'geometry.zombie.husk': 'zombie/husk',
        'geometry.zombie.drowned': 'zombie/drowned',
        'geometry.pigzombie': 'pig/pigzombie',
        'geometry.pigzombie.baby': 'pig/pigzombie',
        'geometry.skeleton': 'skeleton/skeleton',
        'geometry.skeleton.wither': 'skeleton/wither_skeleton',
        'geometry.skeleton.stray': 'skeleton/stray',
        'geometry.squid': 'squid',
        'geometry.spider': 'spider/spider',
        'geometry.cow': 'cow/cow',
        'geometry.mooshroom': 'cow/mooshroom',
        'geometry.sheep.sheared': 'sheep/sheep',
        'geometry.sheep': 'sheep/sheep',
        'geometry.pig': 'pig/pig',
        'geometry.bat': 'bat',
        'geometry.irongolem': 'iron_golem',
        'geometry.snowgolem': 'snow_golem',
        'geometry.zombie.villager': 'zombie_villager/zombie_villager',
        'geometry.evoker': 'illager/evoker',
        'geometry.vex': 'vex/vex',
        'geometry.vindicator': 'vindicator',
        'geometry.wolf': 'wolf/wolf',
        'geometry.ocelot': 'cat/ocelot',
        'geometry.trident': 'trident',
        'geometry.guardian': 'guardian',
        'geometry.polarbear': 'polarbear',
        'geometry.villager': 'villager/villager',
        'geometry.villager.witch': 'witch',
        'geometry.witherBoss': 'wither_boss/wither',
        'geometry.agent': 'agent',
        'geometry.armor_stand': 'armor_stand',
        'geometry.parrot': 'parrot/parrot_red_blue',
        'geometry.bed': 'bed/white',
        'geometry.player_head': 'steve',
        'geometry.mob_head': 'skeleton/skeleton',
        'geometry.dragon_head': 'dragon/dragon',
        'geometry.cod': 'fish/fish',
        'geometry.pufferfish.small': 'fish/pufferfish',
        'geometry.pufferfish.mid': 'fish/pufferfish',
        'geometry.pufferfish.large': 'fish/pufferfish',
        'geometry.salmon': 'fish/salmon',
        'geometry.tropicalfish_a': 'fish/tropical_a',
        'geometry.tropicalfish_b': 'fish/tropical_b'
    }
    var path = textures[mob.split(':')[0]]
    if (path) {
        var texture_path = Prop.file_path.split(osfs)
        texture_path.splice(-2)
        texture_path.push('textures')
        texture_path.push('entity')
        texture_path = texture_path.concat(path.split('/'))
        texture_path = texture_path.join(osfs)
        if (return_path) {
            return texture_path+'.png';
        } else {
            if (fs.existsSync(texture_path + '.png')) {
                var texture = new Texture({keep_size: true}).fromPath(texture_path + '.png').add()
            } else if (fs.existsSync(texture_path + '.tga')) {
                var texture = new Texture({keep_size: true}).fromPath(texture_path + '.tga').add()
            }
        }
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
        Project.name = pathToName(fileName, true);
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
        var content = buildEntityModel({raw: true})

        writeFileEntity(content, fileName)
    })
}
function saveFileObj() {
    app.dialog.showSaveDialog(currentwindow, {filters: [ {name: 'Alias Wavefront', extensions: ['obj']} ]}, function (fileName) {
        if (fileName === undefined) {
            return;
        }
        var content = buildOBJModel(pathToName(fileName, false))

        //OBJECT
        fs.writeFile(fileName, content.obj, function (err) {})

        //MATERIAL
        fs.writeFile(fileName.split('.obj').join('.mtl'), content.mtl, function (err) {})

        //IMAGES
        if (settings.obj_textures.value === true) {
            for (var key in content.images) {
                var texture = content.images[key]
                if (content.images.hasOwnProperty(key) && texture.path) {
                    if (texture.mode === 'link') {
                        var native_image_instance = nativeImage.createFromPath(texture.path)
                    } else {
                        var native_image_instance = nativeImage.createFromDataURL(texture.source)
                    }
                    var image = native_image_instance.toPNG()
                    var image_path = fileName.split(osfs)
                    image_path.pop()
                    image_path = image_path.join(osfs) + osfs + texture.name
                    if (image_path.substr(-4) !== '.png') {
                        image_path = image_path + '.png'
                    }
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
        Prop.project_saved = true;
        setProjectTitle(pathToName(Prop.file_path, false))

        if (Blockbench.entity_mode === false) {
            var content = buildBlockModel()
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
            var content = buildEntityModel({raw: true})
            writeFileEntity(content, Prop.file_path)
        }
    } else {
        if (Blockbench.entity_mode === false) {
            saveFileBlock()
        } else {
            saveFileEntity()
        }
    }
}
function writeFileEntity(content, fileName) {
    Prop.file_path = fileName
    fs.readFile(fileName, 'utf-8', function (errx, data) {
        var obj = {}
        if (!errx) {
            try {
                obj = JSON.parse(data)
            } catch (err) {
                err = err+''
                var answer = app.dialog.showMessageBox(currentwindow, {
                    type: 'warning',
                    buttons: ['Create Backup and Overwrite', 'Overwrite', 'Cancel'],
                    title: 'Blockbench',
                    message: 'Blockbench cannot combine this model with the old file',
                    detail: err,
                    noLink: false
                })
                if (answer === 0) {
                    var backup_file_name = pathToName(fileName, true) + ' backup ' + new Date().toLocaleString().split(':').join('_')
                    backup_file_name = fileName.replace(pathToName(fileName, false), backup_file_name)
                    fs.writeFile(backup_file_name, data, function (err2) {
                        if (err2) {
                            console.log('Error saving backup model: ', err2)
                        }
                    }) 
                }
                if (answer === 2) {
                    return;
                }

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
}
//Open
function openFile(makeNew) {
    app.dialog.showOpenDialog(currentwindow, {filters: [{name: 'Model', extensions: ['json']}]}, function (fileNames) {
        if (fileNames !== undefined) {
            addRecentProject({name: pathToName(fileNames[0], 'mobs_id'), path: fileNames[0]})
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
        addRecentProject({name: pathToName(filepath, 'mobs_id'), path: filepath})
        loadFile(data, filepath, makeNew)
    })
}
function openTexture() {
    var start_path;
    if (textures.length > 0) {
        var arr = textures[0].path.split(osfs)
        arr.splice(-1)
        start_path = arr.join(osfs)
    } else if (Prop.file_path) {
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

//Drop
document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault()
}
document.body.ondrop = (ev) => {
    if (ev.dataTransfer == undefined) {
        return; 
    }
    if (ev.dataTransfer.files[0] != undefined) {

        ev.preventDefault()
        var fileArray = ev.dataTransfer.files;
        if (fileArray[0].path.substr(-4).toUpperCase() == 'JSON') {
            readFile(fileArray[0].path, true)
        } else if (fileArray[0].path.substr(-7).toUpperCase() == 'BBSTYLE') {

            fs.readFile(fileArray[0].path, 'utf-8', function (err, data) {
                if (err) {
                    console.log(err)
                    return;
                }
                applyBBStyle(data)
            })


        } else if (fileArray[0].path.substr(-3).toUpperCase() == 'PNG') {

            if (ev.target == canvas1) {
                active_scene.background.image = fileArray[0].path
                enterScene(true)
            } else {
                
                if ($('li.texture').has(ev.target).length) {
                    var id = $('li.texture').has(ev.target).attr('texid')
                    var texture = getTextureById(id)
                    if (texture && texture.error) {
                        texture.fromPath(fileArray[0].path)
                        return;
                    }
                }

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
//Zoom
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
//Close
window.onbeforeunload = function() {
    if (preventClosing === true) {
        setTimeout(function() {
            showSaveDialog(true)
        }, 2)
        return true;
    }
}
function showSaveDialog(close) {
    if (Blockbench.flags.includes('allow_reload')) {
        close = false
    }
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
