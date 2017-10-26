
//IO
function buildBlockModel(options) {                    //Export Blockmodel
    if (options === undefined) options = {}
    var clear_elements = []
    var textures_used = []
    var element_index_lut = []

    function computeCube(s) {
        if (s.display.export == false) return;
        //Create Element
        var element = {}
        $.extend(true, element, s)
        element_index_lut[s.index()] = clear_elements.length

        if (element.shade === true) {
            delete element.shade
        }
        if (settings.minifiedout.value === true && element.name !== undefined) {
            delete element.name
        }
        clear_elements.push(omitKeys(element, ['display', 'uuid', 'title', 'icon', 'isParent', 'buttons']))
        //Gather Textures
        for (var face in s.faces) {
            if (s.faces.hasOwnProperty(face)) {
                if (!textures_used.includes(s.faces[face].texture)) {
                    textures_used.push(s.faces[face].texture)
                }
            }
        }
    }
    function iterate(arr) {
        var i = 0;
        if (!arr || !arr.length) {
            console.log('return')
            return;
        }
        for (i=0; i<arr.length; i++) {
            if (arr[i].title === 'Cube') {
                computeCube(arr[i])
                console.log(arr[i])
            } else if (arr[i].title === 'Group') {
                console.log('g')
                iterate(arr[i].children)
            }
        }
    }
    iterate(TreeElements)


    clear_elements.forEach(function(s) {
        for (var face in s.faces) {
            if (s.faces.hasOwnProperty(face)) {
                if (s.faces[face].texture === '$transparent') {
                    delete s.faces[face]
                } else if (s.faces[face].texture == undefined) {
                    s.faces[face].texture = '#missing'
                }
            }
        }
    })

    function checkExport(key, condition) {
        key = options[key]
        if (key === undefined) {
            return condition;
        } else {
            return key
        }
    }

    var texturesObj = {}
    textures.forEach(function(s, i){
        if (!textures_used.includes('#'+s.id)) return;
        texturesObj[s.id] = s.javaTextureLink()
        if (s.particle) {
            texturesObj.particle = s.javaTextureLink()
        }
    })

    var blockmodel = {}
    if (checkExport('description', Project.description !== '')) {
        blockmodel.description = Project.description;
    }
    if (checkExport('comment', settings.comment.value === true)) {
        blockmodel.credit = settings.comment_text.value
    }
    if (checkExport('parent', Project.parent != '')) {
        blockmodel.parent = Project.parent
    }
    if (checkExport('ambientocclusion', Project.ambientocclusion)) {
        blockmodel.ambientocclusion = false
    }
    if (checkExport('textures', Object.keys(texturesObj).length >= 1)) {
        blockmodel.textures = texturesObj
    }
    if (checkExport('elements', elements.length >= 1)) {
        blockmodel.elements = clear_elements
    }
    if (checkExport('groups', settings.export_groups.value)) {
        blockmodel.groups = compileGroups(undefined, element_index_lut)
    }
    if (checkExport('display', Object.keys(display).length >= 1)) {
        blockmodel.display = display
    }
    if (options.raw) {
        return blockmodel
    } else {
        return autoStringify(blockmodel)
    }
}
function loadFile(data, filepath, makeNew) {    //Load File Into GUI
    var previous_length = 0
    var previous_texture_length = 0
    if (makeNew === true) {
        //Create New Project
        if (newProject() == false) return;
        Prop.file_path = filepath
        Prop.file_name = pathToName(Prop.file_path, true)
        Project.name = pathToName(Prop.file_path, false)
        if (Project.name.length > 0) {
            $('title').text(Project.name+' - Blockbench')
        } else {
            $('title').text('Blockbench')
        }
        Prop.project_saved = true;
    } else {
        //Add to Current Project
        previous_length = elements.length
        previous_texture_length = textures.length
        added_model_index++;
        var import_group = new Group(pathToName(Prop.file_path, false))
    }

    data = JSON.parse(data)

    //Check if PE Model
    for (var key in data) {
        if (key.includes('geometry.')) {
            loadPEModelFile(data)
            return;
        }
    }
    settings.entity_mode.value = false;
    saveSettings()


    //Load
    if (data.display !== undefined) {
        display = data.display
    }

    if (data.elements) {
        data.elements.forEach(function(s) {
            base_cube = new Cube()
            base_cube.extend(s)
            for (var face in base_cube.faces) {
                if (s.faces[face] === undefined) {
                    base_cube.faces[face].texture = '$transparent'
                    base_cube.faces[face].uv = [0,0,0,0]
                }
            }
            base_cube.uuid = guid()
            base_cube.display.autouv = false;
            elements.push(base_cube);
            if (makeNew === true) {
                base_cube.addTo()
            } else if (import_group) {
                base_cube.addTo(import_group)
            }
        })
    }

    if (data.groups && data.groups.length > 0) {
        parseGroups(data.groups)
        if (import_group) {
            TreeElements.forEach(function(s) {
                s.addTo(import_group)
            })
        }
    }
    if (import_group) {
        import_group.addTo()
    }

    //Create Path Array to fetch textures
    var path_arr = filepath.split(osfs)
    path_arr.splice(-3)
    path_arr = path_arr.join(osfs)
    var texture_arr = data.textures
    var names = []
    for (var tex in texture_arr) {
        if (texture_arr.hasOwnProperty(tex)) {
            if (tex != 'particle') {
                var path = path_arr+osfs+'textures'+osfs+texture_arr[tex].split('/').join(osfs)+'.png'
                new Texture({id: tex}).fromPath(path).add()

                names.push(texture_arr[tex])
            }
        }
    }
    if (texture_arr === undefined) texture_arr = {}
    if (texture_arr.particle) {
        var path = path_arr+osfs+'textures'+osfs+texture_arr.particle.split('/').join(osfs)+'.png'
        if (names.includes(texture_arr.particle)) {
            textures.forEach(function(s) {
                if (s.path == path) {
                    s.enableParticle()
                }
            })
        } else {
            new Texture({id: 'particle'}).enableParticle().fromPath(path).add()
        }
    }
    //Get Rid Of ID overlapping
    textures.forEach(function(t, i) {
        if (i >= previous_texture_length) {
            if (getTexturesById(t.id).length > 1) {
                var before = t.id
                t.id = added_model_index + '_' + t.id
                elements.forEach(function(s, si) {
                    if (si >= previous_length) {
                        for (var face in s.faces) {
                            if (s.faces[face].texture === '#'+before) {
                                s.faces[face].texture = '#'+t.id
                            }
                        }
                    }
                })
            }
        }
    })
    //Select Last Texture
    if (textures.length > 0) {
        textures.forEach(function(s) {
            s.selected = false;
        })
        textures[textures.length-1].selected = true;
    }
    //Set Parent
    if (data.parent !== undefined) {
        Project.parent = data.parent;
    }
    //Set Ambient Occlusion
    if (data.ambientocclusion === false) {
        Project.ambientocclusion = false;
    }
    loadTextureDraggable()
    Canvas.updateAll()
    setUndo('Opened project')
    if (makeNew) {
        Prop.project_saved = true;
    }
}
function loadPEModelFile(data) {
    pe_list_data.length = 0
    entityMode.join()
    saveSettings()

    for (var key in data) {
        if (key.includes('geometry.') && data.hasOwnProperty(key)) {
            var base_model = {name: key, bonecount: 0, selected: false, object: data[key]}
            if (data[key].bones) {
                base_model.bonecount = data[key].bones.length
            }
            pe_list_data.push(base_model)
        }
    }

    if (pe_list == undefined) {
        pe_list = new Vue({
            el: '#pe_list',
            data: {
                search_text: '',
                list: pe_list_data
            },
            methods: {
                selectE: function(item, event) {
                    var index = pe_list_data.indexOf(item)
                    pe_list_data.forEach(function(s) {
                        s.selected = false;
                    })
                    pe_list_data[index].selected = true
                }
            },
            computed: {
                searched() {
                    var scope = this;
                    return this.list.filter(item => {
                        return item.name.toUpperCase().includes(scope.search_text)
                    })
                }
            }
        })
    } else {
        // pe_list._data = {pe_list_data}
        // pe_list.$forceUpdate();
    }
    showDialog('entity_import')
    $('#pe_list').css('max-height', ($(window).height() - 320) +'px')
    //texturelist._data.elements = textures
}
function loadPEModel() {
    var data;
    pe_list_data.forEach(function(s) {
        if (s.selected === true) {
            data = s
        }
    })
    if (data == undefined) {
        data = pe_list_data[0]
    }
    Project.parent = data.name
    if (data.object.texturewidth !== undefined) {
        Project.texture_width = data.object.texturewidth
    }
    if (data.object.textureheight !== undefined) {
        Project.texture_height = data.object.textureheight
    }

    if (data.object.bones) {
        data.object.bones.forEach(function(b) {
            var group = new Group(b.name)
            if (b.pivot) {
                group.origin = b.pivot
            } else {
                group.origin = [0, 0, 0]
            }
            if (b.rotation) {
                group.rotation = b.rotation
            }
            group.reset = b.reset === true

            if (b.cubes) {
                b.cubes.forEach(function(s) {
                    var base_cube = new Cube(b.name, true)
                    base_cube.display.autouv = false;
                    if (s.origin) {
                        base_cube.from = s.origin
                        if (s.size) {
                            base_cube.to[0] = s.size[0] + base_cube.from[0]
                            base_cube.to[1] = s.size[1] + base_cube.from[1]
                            base_cube.to[2] = s.size[2] + base_cube.from[2]
                        }
                    }
                    if (s.uv) {
                        base_cube.faces.north.uv[0] = (s.uv[0] / Project.texture_width)  * 16
                        base_cube.faces.north.uv[1] = (s.uv[1] / Project.texture_height) * 16
                        base_cube.faces.north.uv[2] = 16
                        base_cube.faces.north.uv[3] = 16
                    }
                    elements.push(base_cube)
                    base_cube.addTo(group)
                })
            }
            group.addTo()
        })
    }
    pe_list_data.length = 0;
    hideDialog()

    loadTextureDraggable()
    Canvas.updateAll()
    setUndo('Opened entity model')
}
function buildEntityModel(options) {
    var entitymodel = {}
    entitymodel.texturewidth = Project.texture_width;
    entitymodel.textureheight = Project.texture_height;
    var bones = []
    TreeElements.forEach(function(g) {
        if (g.title !== 'Group') return;
        //Bone
        var bone = {}
        bone.name = g.name
        bone.pivot = g.origin
        if (g.rotation.join('_') !== '0_0_0') {
            bone.rotation = g.rotation
        }
        if (g.reset) {
            bone.reset = true
        }
        //Cubes
        bone.cubes = []
        g.children.forEach(function(s) {
            if (s === undefined) return;
            if (s.display.export === false) return;
            var cube = {}
            cube.origin = s.from
            cube.size = s.size()
            cube.uv = [(s.faces.north.uv[0]/16) * Project.texture_width, (s.faces.north.uv[1]/16) * Project.texture_height]
            bone.cubes.push(cube)
        })
        bones.push(bone)
    })
    entitymodel.bones = bones

    return entitymodel
}
function buildOptifineModel() {
    var jpm = {}
    if (textures[0]) {
        jpm.texture = pathToName(textures[0].name, false)
    } else {
        showQuickMessage('No texture found')
    }
    jpm.textureSize = [Project.texture_width, Project.texture_height]

    if (settings.comment.value === true) {
        jpm.credit = settings.comment_text.value
    }
    if (Project.description !== '') {
        jpm.description = Project.description;
    }

    var submodels = []

    elements.forEach(function(s) {
        if (s.display.export === false) return;
        var submodel = {boxes: [{}]}
        var box = submodel.boxes[0]
        submodel.id = s.name
        box.coordinates = [s.from[0], s.from[1], s.from[2], s.size(0), s.size(1), s.size(2)]

        for (var face in s.faces) {
            if (s.faces.hasOwnProperty(face)) {
                if (s.faces[face].texture !== undefined && s.faces[face].texture !== '$transparent') {
                    box['uv'+capitalizeFirstLetter(face)] = [
                        s.faces[face].uv[0] / 16 * Project.texture_width,
                        s.faces[face].uv[1] / 16 * Project.texture_height,
                        s.faces[face].uv[2] / 16 * Project.texture_width,
                        s.faces[face].uv[3] / 16 * Project.texture_height
                    ]
                }
            }
        }
        submodels.push(submodel)
    })
    jpm.submodels = submodels


    return autoStringify(jpm)
}
function newProject(entity_mode) {
    if (showSaveDialog()) {
        if (display_mode === true) exitDisplaySettings()
        TextureAnimator
        projectTagSetup()
        elements.length = 0;
        TreeElements.length = 1
        TreeElements.splice(0, 1)
        textures.length = 0
        selected.length = 0
        display = {}
        Prop.file_path = 'Unknown';
        Prop.file_name = '-';
        $('title').text('Blockbench')
        Canvas.updateAll()
        outliner.$forceUpdate();
        texturelist.$forceUpdate();
        Undo.history.length = 0;
        Undo.index = 0;
        added_model_index = 0;
        if (entity_mode) {
            entityMode.join()
        } else {
            entityMode.leave()
        }
        setUndo('Created project')
        return true;
    } else {
        return false;
    }
}
function newEntityProject() {
    newProject(function () {
        settings.entity_mode.value = true
        entity_mode.join()
    })
}