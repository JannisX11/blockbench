//New
function newProject(entity_mode) {
    if (showSaveDialog()) {
        if (display_mode === true) exitDisplaySettings()
        //TextureAnimator
        projectTagSetup()
        elements.length = 0;
        TreeElements.length = 1
        TreeElements.splice(0, 1)
        Canvas.materials.length = 0
        textures.length = 0
        selected.length = 0
        selected_group = undefined
        display = {}
        Prop.file_path = 'Unknown';
        Prop.file_name = '-';
        setProjectTitle()
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
    newProject(true)
}
//Import
function loadFile(data, filepath, makeNew) {
    var previous_length = 0
    var previous_texture_length = 0
    if (makeNew === true) {
        //Create New Project
        if (newProject() == false) return;
        Blockbench.addFlag('importing')
        Prop.project_saved = true;
        Prop.file_path = filepath
        setProjectTitle(pathToName(filepath, true))
    } else {
        //Add to Current Project
        Blockbench.addFlag('importing')
        previous_length = elements.length
        previous_texture_length = textures.length
        added_model_index++;
        var import_group = new Group(pathToName(filepath, false))
    }
    try {
        data = JSON.parse(data)
    } catch (err1) {
        data = data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')
        try {
            data = JSON.parse(data)
        } catch (err) {
            console.error(err)
            var length = err.toString().split('at position ')[1]
            if (length) {
                length = parseInt(length)
                console.log(data.substr(0, length+1) + ' <-- HERE')
            } else if (err.toString().includes('Unexpected end of JSON input')) {
                console.log(data.substr(data.length-10, 10) + ' <-- HERE')
            }
            Blockbench.showMessageBox({
                title: 'Invalid Model File',
                icon: 'error',
                message: 'Could not open model file: <br> '+err,
                buttons: ['OK']
            })
            return;
        }
    }
    //Check if PE Model
    for (var key in data) {
        if (key.includes('geometry.')) {
            loadPEModelFile(data)
            return;
        }
    }
    if (!data.elements && !data.parent && !data.display && !data.textures) {
        Blockbench.showMessageBox({
            title: 'Invalid Model File',
            icon: 'error',
            message: 'This file does not contain valid model data.',
            buttons: ['OK']
        })
        return;
    }
    Blockbench.entity_mode = false;
    saveSettings()


    //Load
    if (data.display !== undefined) {
        display = data.display
    }

    var oid = elements.length

    if (data.elements) {
        data.elements.forEach(function(obj) {
            base_cube = new Cube(obj)
            if (obj.__comment) base_cube.name = obj.__comment
            var uv_stated = false;
            for (var face in base_cube.faces) {
                if (obj.faces[face] === undefined) {
                    base_cube.faces[face].texture = '$transparent'
                    base_cube.faces[face].uv = [0,0,0,0]
                } else  if (typeof obj.faces[face].uv === 'object') {
                    uv_stated = true
                }
            }
            if (!uv_stated) {
                base_cube.display.autouv = 2
                base_cube.mapAutoUV()
            } else {
                base_cube.display.autouv = 0;
            }
            elements.push(base_cube);
            if (makeNew === true) {
                TreeElements.push(base_cube)
                base_cube.display.parent = 'root'
            } else if (import_group) {
                import_group.children.push(base_cube)
                base_cube.display.parent = import_group
            }
        })
    }
    if (data.groups && data.groups.length > 0) {
        if (makeNew === true) {
            parseGroups(data.groups)
        } else if (import_group) {
            parseGroups(data.groups, import_group, oid)
        }
    }
    if (import_group) {
        import_group.addTo()
    }
    if (
        !data.elements &&
        data.parent == 'item/generated' &&
        data.textures &&
        typeof data.textures.layer0 === 'string'
    ) {
        base_cube = new Cube()
        base_cube.extend({
            name: 'Item Dummy',
            from: [0, 0, 7.5],
            to:   [16, 16, 7.8],
            faces: {
                north: {uv: [16,0,0,16], texture: 'layer0'},
                south: {uv: [16,0,16,0], texture: 'layer0'},
                east:  {uv: [0,0,0,0], texture: '$transparent'},
                west:  {uv: [0,0,0,0], texture: '$transparent'},
                up:    {uv: [0,0,0,0], texture: '$transparent'},
                down:  {uv: [0,0,0,0], texture: '$transparent'},
            },
            display: {
                autouv: false,
                export: false,
            }
        })
        elements.push(base_cube);
        base_cube.addTo()
    } else if (!data.elements && data.parent) {
        Blockbench.showMessageBox({
            title: 'Empty Model',
            icon: 'info',
            message: 'This file is a child of '+data.parent+' and does not contain a model.',
            buttons: ['OK']
        })
    }
    if (data.textures) {
        //Create Path Array to fetch textures
        var path_arr = filepath.split(osfs)
        var index = path_arr.length - path_arr.indexOf('models')
        path_arr.splice(-index)
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
    loadOutlinerDraggable()
    Canvas.updateAll()
    setUndo('Opened model')
    Blockbench.removeFlag('importing')
    if (makeNew) {
        Prop.project_saved = true;
    }
}
function loadPEModelFile(data) {
    pe_list_data.length = 0
    entityMode.join()
    $('#pe_search_bar').val('')
    if (pe_list && pe_list._data) {
        pe_list._data.search_text = ''
    }
    saveSettings()

    for (var key in data) {
        if (key.includes('geometry.') && data.hasOwnProperty(key)) {
            var base_model = {name: key, bonecount: 0, cubecount: 0, selected: false, object: data[key]}
            if (data[key].bones) {
                base_model.bonecount = data[key].bones.length
                data[key].bones.forEach(function(b) {
                    if (b.cubes) {
                        base_model.cubecount += b.cubes.length
                    }
                })
                if (typeof base_model.cubecount !== 'number') base_model.cubecount = '[E]'
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
    $('input#pe_search_bar').select()
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
    Project.texture_width = 64
    Project.texture_height = 64

    if (data.object.texturewidth !== undefined) {
        Project.texture_width = data.object.texturewidth
    }
    if (data.object.textureheight !== undefined) {
        Project.texture_height = data.object.textureheight
    }
    entityMode.old_res.x = Project.texture_width
    entityMode.old_res.y = Project.texture_height

    if (data.object.bones) {
        var included_bones = []
        data.object.bones.forEach(function(b) {
            included_bones.push(b.name)
        })
        data.object.bones.forEach(function(b) {
            var group = new Group(b.name)
            if (b.pivot) {
                group.origin = b.pivot
                group.origin[0] *= -1
            } else {
                group.origin = [0, 0, 0]
            }
            if (b.rotation) {
                group.rotation = b.rotation
                group.rotation.forEach(function(br, ri) {
                    group.rotation[ri] *= -1
                })
            }
            if (b.name === 'body' &&
                included_bones.includes('leg3') &&
                included_bones.includes('leg4') === false &&
                !data.name.includes('creeper') &&
                (group.rotation.join('_') === '0_0_0' || group.rotation === undefined)
            ) {
                group.rotation = [-90, 0, 0]
            }
            group.shade = !b.mirror
            group.reset = b.reset === true

            if (b.cubes) {
                b.cubes.forEach(function(s) {
                    var base_cube = new Cube({name: b.name, display:{autouv: false}})
                    if (s.name) {
                        base_cube.name = s.name
                    }
                    if (s.origin) {
                        base_cube.from = s.origin
                        base_cube.from[0] = -(base_cube.from[0] + s.size[0])
                        if (s.size) {
                            base_cube.to[0] = s.size[0] + base_cube.from[0]
                            base_cube.to[1] = s.size[1] + base_cube.from[1]
                            base_cube.to[2] = s.size[2] + base_cube.from[2]
                        }
                    }
                    if (s.uv) {
                        base_cube.uv_offset[0] = s.uv[0]
                        base_cube.uv_offset[1] = s.uv[1]
                    }
                    if (s.inflate && typeof s.inflate === 'number') {
                        base_cube.inflate = s.inflate
                    }
                    if (s.mirror === undefined) {
                        base_cube.shade = group.shade
                    } else {
                        base_cube.shade = !s.mirror
                    }
                    elements.push(base_cube)
                    base_cube.addTo(group, false)
                })
            }
            group.addTo(undefined, false)
        })
    }
    pe_list_data.length = 0;
    hideDialog()

    loadTextureDraggable()
    loadOutlinerDraggable()
    Canvas.updateAll()
    setProjectTitle()
    setUndo('Opened entity model')
    if (isApp && data.name) {
        findEntityTexture(data.name)
    }
}
//Export
class oneLiner {
    constructor(data) {
        if (data !== undefined) {
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    this[key] = data[key]
                }
            }
        }
    }
}
function buildBlockModel(options) {
    if (options === undefined) options = {}
    var clear_elements = []
    var textures_used = []
    var element_index_lut = []
    var largerCubesNr = 0;

    function computeCube(s) {
        if (s.display.export == false) return;
        //Create Element
        var element = {}
        element_index_lut[s.index()] = clear_elements.length

        if (options.cube_name !== false && !settings.minifiedout.value && s.name !== 'cube') {
            element.name = s.name
        }
        element.from = s.from.slice()
        element.to = s.to.slice()
        if (s.shade === false) {
            element.shade = false
        }
        if (s.rotation) {
            element.rotation = new oneLiner({
                angle: s.rotation.angle,
                axis: s.rotation.axis,
                origin: s.rotation.origin
            })
            if (s.rotation.rescale === true) {
                element.rotation.rescale = true
            }
        }
        element.faces = {}
        for (var face in s.faces) {
            if (s.faces.hasOwnProperty(face)) {
                if (s.faces[face].texture !== '$transparent') {
                    var tag = new oneLiner()
                    if (s.faces[face].enabled !== false) {
                        tag.uv = s.faces[face].uv
                    }
                    tag.texture = s.faces[face].texture ? s.faces[face].texture : '#missing'
                    if (s.faces[face].rotation) {
                        tag.rotation = s.faces[face].rotation
                    }
                    if (s.faces[face].cullface !== undefined) {
                        tag.cullface = s.faces[face].cullface
                    }
                    if (s.faces[face].tintindex !== undefined) {
                        tag.tintindex = s.faces[face].tintindex
                    }
                    element.faces[face] = tag
                }
            }
        }
        //Gather Textures
        for (var face in s.faces) {
            if (s.faces.hasOwnProperty(face)) {
                if (!textures_used.includes(s.faces[face].texture)) {
                    textures_used.push(s.faces[face].texture)
                }
            }
        }
        function inVd(n) {
            return n > 32 || n < -16
        }
        if (inVd(s.from[0]) ||
            inVd(s.from[1]) ||
            inVd(s.from[2]) ||
            inVd(s.to[0]) ||
            inVd(s.to[1]) ||
            inVd(s.to[2])
        ) {
            largerCubesNr++;
        }
        element.constructor.bbtype = 'Cube'
        clear_elements.push(element)
    }
    function iterate(arr) {
        var i = 0;
        if (!arr || !arr.length) {
            return;
        }
        for (i=0; i<arr.length; i++) {
            if (arr[i].type === 'cube') {
                computeCube(arr[i])
            } else if (arr[i].title === 'Group') {
                iterate(arr[i].children)
            }
        }
    }
    iterate(TreeElements)

    function checkExport(key, condition) {
        key = options[key]
        if (key === undefined) {
            return condition;
        } else {
            return key
        }
    }

    var texturesObj = {}
    var hasUnsavedTextures = false
    textures.forEach(function(s, i){
        if (!textures_used.includes('#'+s.id)) return;
        texturesObj[s.id] = s.javaTextureLink()
        if (s.particle) {
            texturesObj.particle = s.javaTextureLink()
        }
        if (s.mode === 'bitmap') {
            hasUnsavedTextures = true
        }
    })

    if (options.prevent_dialog !== true && hasUnsavedTextures && settings.dialog_unsaved_textures.value) {
        Blockbench.showMessageBox({
            title: 'Unsaved Textures',
            icon: 'broken_image',
            message: 'Your model has unsaved textures. Make sure to save them and paste them into your resource pack in the correct folder.',
            buttons: ['OK']
        })
    }
    if (options.prevent_dialog !== true && largerCubesNr > 0 && settings.dialog_larger_cubes.value) {
        Blockbench.showMessageBox({
            title: 'Model Too Large',
            icon: 'settings_overscan',
            message: 'Your model contains '+largerCubesNr+' cubes that are larger than the 3x3x3 limit allowed by Minecraft. This model will not work in Minecraft. Enable the option "Restricted Canvas" to prevent this.',
            buttons: ['OK']
        })
    }

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
    if (checkExport('ambientocclusion', Project.ambientocclusion === false)) {
        blockmodel.ambientocclusion = false
    }
    if (checkExport('textures', Object.keys(texturesObj).length >= 1)) {
        blockmodel.textures = texturesObj
    }
    if (checkExport('elements', clear_elements.length >= 1)) {
        blockmodel.elements = clear_elements
    }
    if (checkExport('display', Object.keys(display).length >= 1)) {
        var new_display = {}
        var entries = 0;
        for (var key in display) {
            if (display.hasOwnProperty(key)) {
                if ((typeof display[key].scale === 'object' && display[key].scale.join('_') !== '1_1_1') ||
                    display[key].rotation ||
                    display[key].translation
                ) {
                    new_display[key] = display[key]
                    entries++;
                    if (new_display[key].scale && new_display[key].scale.join('_') === '1_1_1') {
                        new_display[key].scale = undefined
                    }
                }
            }
        }
        if (entries) {
            blockmodel.display = new_display
        }
    }
    if (checkExport('groups', (settings.export_groups.value && getAllOutlinerGroups().length))) {
        groups = compileGroups(undefined, element_index_lut)
        var i = 0;
        while (i < groups.length) {
            if (typeof groups[i] === 'object') {
                i = Infinity
            }
            i++
        }
        if (i === Infinity) {
            blockmodel.groups = groups
        }
    }
    if (options.raw) {
        return blockmodel
    } else {
        return autoStringify(blockmodel)
    }
}
function buildEntityModel(options) {
    if (options === undefined) options = {}
    var entitymodel = {}
    entitymodel.texturewidth = parseInt(Project.texture_width);
    entitymodel.textureheight = parseInt(Project.texture_height);
    var bones = []

    TreeElements.forEach(function(g) {
        if (g.type !== 'group') return;
        //Bone
        var bone = {}
        bone.name = g.name
        bone.pivot = g.origin.slice()
        bone.pivot[0] *= -1
        if (g.rotation.join('_') !== '0_0_0') {
            bone.rotation = g.rotation.slice()
            bone.rotation.forEach(function(br, ri) {
                bone.rotation[ri] *= -1
            })
        }
        if (g.reset) {
            bone.reset = true
        }
        if (!g.shade) {
            bone.mirror = true
        }
        //Cubes
        if (g.children && g.children.length) {
            bone.cubes = []
            function iterate(arr) {
                var i = 0;
                while (i < arr.length) {
                    if (arr[i].type === 'group') {
                        iterate(arr[i].children)
                    } else if (arr[i].type === 'cube') {
                        var s = arr[i]
                        if (s !== undefined && s.display.export !== false) {
                            var cube = new oneLiner()
                            cube.origin = s.from.slice()
                            cube.size = s.size()
                            cube.origin[0] = -(cube.origin[0] + cube.size[0])
                            cube.uv = s.uv_offset
                            if (s.inflate && typeof s.inflate === 'number') {
                                cube.inflate = s.inflate
                            }

                            if (s.shade === !!bone.mirror) {
                                cube.mirror = !s.shade
                            }
                            bone.cubes.push(cube)
                        }
                    }
                    i++;
                }
            }
            iterate(g.children)
        }
        bones.push(bone)
    })
    entitymodel.bones = bones

    if (options.raw) {
        return entitymodel
    } else {
        return autoStringify(entitymodel)
    }
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
function buildOBJModel(name) {
    scene.position.set(0,0,0)
    var exporter = new THREE.OBJExporter();
    var content = exporter.parse( scene, name);
    scene.position.set(-8,-8,-8)
    return content;
}
function compileJSON(object, options) {
    var output = ''
    if (typeof options !== 'object') options = {}
    function newLine(tabs) {
        if (options.small === true) {return '';}
        var s = '\n'
        for (var i = 0; i < tabs; i++) {
            s += '\t'
        }
        return s;
    }
    function handleVar(o, tabs) {
        var out = ''
        if (typeof o === 'string') {
            //String
            out += '"' + o.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
        } else if (typeof o === 'boolean') {
            //Boolean
            out += (o ? 'true' : 'false')
        } else if (typeof o === 'number') {
            //Number
            o = (Math.round(o*100000)/100000).toString()
            out += o
        } else if (o === null) {
            //Null
            out += null
        } else if (typeof o === 'object' && o.constructor.name === 'Array') {
            //Array
            var comma = false
            out += '['
            for (var i = 0; i < o.length; i++) {
                var compiled = handleVar(o[i], tabs+1)
                if (compiled) {
                    var breaks = typeof o[i] === 'object'
                    if (comma) {out += ',' + (breaks || options.small?'':' ')}
                    if (breaks) {out += newLine(tabs)}
                    out += compiled
                    comma = true
                }
            }
            if (typeof o[o.length-1] === 'object') {out += newLine(tabs-1)}
            out += ']'
        } else if (typeof o === 'object') {
            //Object
            var breaks = o.constructor.name !== 'oneLiner';
            var comma = false
            out += '{'
            for (var key in o) {
                if (o.hasOwnProperty(key)) {
                    var compiled = handleVar(o[key], tabs+1)
                    if (compiled) {
                        if (comma) {out += ',' + (breaks || options.small?'':' ')}
                        if (breaks) {out += newLine(tabs)}
                        out += '"' + key + '":' + (options.small === true ? '' : ' ')
                        out += compiled
                        comma = true
                    }
                }
            }
            if (breaks) {out += newLine(tabs-1)}
            out += '}'
        }
        return out;
    }
    return handleVar(object, 1)
}
function autoStringify(object) {
  return compileJSON(object, {small: settings.minifiedout.value})
}