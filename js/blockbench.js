var appVersion = '1.10.2'
var osfs = '/'
var File, i;
var browser_name = 'electron'
var elements = [];
var TreeElements = [];
var textures = [];
var selected = []
Array.prototype.Elements = function() {
    if (this != selected) {
        console.warn('Array.Elements() is only supported for the "selected" array')
    }
    var i = 0;
    var arr = []
    while (i < this.length) {
        arr.push(elements[this[i]])
        i++;
    }
    return arr;
}
var prev_side = 'north';
var nslide = {
    top:  null,
    left: null,
    pre:  null,
    lock: null
}
var uv_clipboard;
var outliner, texturelist;
var pe_list_data = []
var _vect;
var isApp = true
var open_dialog = false;
var tex_version = 1;
var round_index = 1000000;
var added_model_index = 0;
var currently_renaming = false;
var g_makeNew = false;
var brush_template;
var pe_list;
var holding_shift = false;
var main_uv;
var Prop = {
    wireframe:      false,
    tool:           'translate',
    file_path:      'Unknown',
    file_name:      '-',
    project_saved:  true,
    fps:            0,
    zoom:           100,
    facing:         'north'
}
var sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
var movementAxis = true;
var showSplashScreen = localStorage.getItem('welcomed_version') != appVersion

$.ajaxSetup({ cache: false });

$.getJSON('http://blockbench.net/api/index.json', function (data) {
    if (data.forceSplashScreen == true) {
        showSplashScreen = true
    }
})

function initializeApp() {
    //Browser Support Detection
    if (isApp === false) { 
        if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
            browser_name = 'firefox'
        } else if (!!window.chrome && !!window.chrome.webstore) {
            browser_name = 'chrome'
        } else if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) {
            browser_name = 'opera'
        } else if (/constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification))) {
            browser_name = 'safari'
        } else if (!!document.documentMode) {
            browser_name = 'internet_explorer'
        } else if (!!window.StyleMedia) {
            browser_name = 'edge'
        }
        if (['edge', 'internet_explorer'].includes(browser_name)) {
            alert(capitalizeFirstLetter(browser_name)+' does not support Blockbench')
        }
        $('.local_only').remove()
    } else {
        $('.web_only').remove()
    }

    //Misc
    console.log('Blockbench ' + appVersion + (isApp ? ' Desktop' : ' Web ('+capitalizeFirstLetter(browser_name)+')'))
    if (localStorage.getItem('donated') == 'true') {
        $('#donation_hint').remove()
    }

    updateMenu()
    
    setInterval(function() {
        Prop.fps = framespersecond;
        framespersecond = 0;
    }, 1000)
    settings.entity_mode.value = false

    main_uv = new UVEditor('main_uv', false, true)
    main_uv.setToMainSlot()

    setupVue()
    setupNslides()
    saveSettings()
//JQuery UI
    $('#cubes_list').droppable({
        greedy: true,
        accept: 'div.outliner_object',
        tolerance: 'pointer',
        hoverClass: 'drag_hover',
        drop: function(event, ui) {
            var item = TreeElements.findRecursive('uuid', $(ui.draggable).parent().attr('id'))
            dropOutlinerObjects(item, undefined, event)
        }
    })
    $('#cubes_list').contextmenu(function(event) {
        new ContextMenu(event, [
            {icon: 'add_box', name: 'Add Cube', click: function() {addCube()} },
            {icon: 'create_new_folder', name: 'Add Group', click: function() {addGroup()} },
            {icon: 'sort_by_alpha', name: 'Sort', click: function() {sortOutliner()} },
            {icon: 'playlist_add_check', name: 'Select All', click: function() {selectAll()} },
            {icon: 'dns', name: 'Toggle Options', click: function() {toggleOutlinerOptions()} },
        ])
    })


//Events
    $(window).on( "unload", saveLocalStorages)


    $('ul#cubes_list').click(function(event) {
        if (event.target === document.getElementById('cubes_list')) {
            unselectAll()
        }
    })


    $('input[type="range"]').on('mousewheel', function () {
        var factor = event.deltaY > 0 ? -1 : 1
        var val = parseFloat($(event.target).val()) + parseFloat($(event.target).attr('step')) * factor
        val = limitNumber(val, $(event.target).attr('min'), $(event.target).attr('max'))

        $(event.target).val(val)
        eval($(event.target).attr('oninput'))
    })

    $(document).mousedown(function(event) {
        if ($('.ctx').find(event.target).length === 0) {
            $('.context_handler.ctx').removeClass('ctx')
        }
        if ($('.contextMenu').find(event.target).length === 0) {
            $('.contextMenu').remove()
        }
        if ($(event.target).is('input.cube_name:not([disabled])') === false) {
            stopRenameCubes()
        }
    })
    $('.context_handler').on('click', function() {
        $(this).addClass('ctx')
    })
    $(document).contextmenu(function(event) {
        if (!$(event.target).hasClass('allow_default_menu')) {
            return false;
        }
    })
    $('.menu_bar_point').on('mouseenter', function() {
        if ($('.menu_bar_point.ctx').length > 0) {
            $('.menu_bar_point.ctx').removeClass('ctx')
            $(this).addClass('ctx')
        }
    })
    if (!isApp) {
        showSplashScreen = tryLoadPOSTModel()
    }
    if (showSplashScreen) {
        $('#welcome_content').load('http://www.blockbench.net/api/welcome/index.html', function() {
            $('#welcome_screen #welcome_content').css('max-height', ($(window).height() - 460)+'px')
            showDialog('welcome_screen')
            localStorage.setItem('welcomed_version', appVersion) 
        })
    }
    Undo.add('Blank')
}
function setupVue() {
    outliner = new Vue({
        el: '#cubes_list',
        data: {
            option: {
                root: {
                    name: 'Model',
                    isParent: true,
                    isOpen: true,
                    display: {
                        isselected: false
                    },
                    onOpened: function () {},
                    select: function() {},
                    children: TreeElements
                }
            }
        }
    })

    texturelist = new Vue({
        el: '#texture_list',
        data: {textures},
        methods: {
            toggleP: function(texture) {
                textures.forEach(function(t) {
                    if (t !== texture) {
                        t.particle = false;
                    }
                })
                texture.particle = !texture.particle
            },
            selectT: function(item, event) {
                var index = textures.indexOf(item)
                textures[index].select()
            },
            menu: function(item, event) {
                var index = textures.indexOf(item)
                textures.forEach(function(s) {
                    s.selected = false;
                })
                textures[index].selected = true
                openTextureMenu(index)
            },
            showContextMenu: function(item, event) {
                function selectThisTex() {
                    textures.forEach(function(s) { s.selected = false })
                    textures[index].selected = true
                }
                var index = textures.indexOf(item)
                var menu_points = []
                if (settings.entity_mode.value === false) {
                    menu_points = [
                        {icon: 'crop_original', name: 'Apply to Faces', click: function() {     item.apply()}},
                        {icon: 'fa-cube', name: 'Apply to Cubes', click: function() {           item.apply(true)}},
                    ]
                }
                menu_points.push(
                    {icon: 'refresh', name: 'Refresh', local_only: true, click: function() {item.reloadTexture()}},
                    {icon: 'folder',  name: 'Open in Folder', local_only: true, click: function() {item.openFolder()}},
                    {icon: 'delete',  name: 'Delete', click: function() {                   item.remove()}},
                    {icon: 'list',    name: 'Properties', click: function() {                 openTextureMenu(index)}}
                )
                new ContextMenu(event, menu_points)
            }
        }
    })
    texturelist._data.elements = textures



    var keybindlist = new Vue({
        el: 'ul#keybindlist',
        data: {keybinds},
        methods: {
            prepareInput: function(key) {
                $('div:focus').on('keyup mousedown', function(event) {
                    event.preventDefault()
                    key.code = event.which
                    key.ctrl = event.ctrlKey
                    key.shift = event.shiftKey
                    key.alt = event.altKey
                    keys = []
                    if (key.ctrl) keys.push('Ctrl')
                    if (key.shift) keys.push('Shift')
                    if (key.alt) keys.push('Alt')
                    if (key.code === 1) {
                        keys.push('Left-Click')
                    } else if (key.code === 2) {
                        keys.push('Mousewheel')
                    } else if (key.code === 3) {
                        keys.push('Right-Click')

                    } else if (key.code >= 96 && key.code <= 105) {
                        keys.push('NUMPAD '+event.key)
                    } else if (event.key === ' ') {
                        keys.push('SPACE')
                    } else {
                        keys.push(event.key.toUpperCase())
                    }
                    key.char = keys.join(' + ')

                    $(this).blur()
                    $(this).off('keyup mousedown')
                    localStorage.setItem('keybinds', JSON.stringify(omitKeys(keybinds, ['name'], true)))
                })
                .on('keydown keypress keyup click click dblclick mouseup', function(event) {
                    event.preventDefault()
                })
            },
            resetKey: function(key) {
                var obj = keybindSetup(true)
                for (var keystring in keybinds) {
                    if (keybinds.hasOwnProperty(keystring) && keybinds[keystring] === key) {
                        keybinds[keystring] = obj[keystring]
                        break;
                    }
                }
                localStorage.setItem('keybinds', JSON.stringify(omitKeys(keybinds, ['name'], true)))
            }
        }
    })
    keybindlist._data.elements = keybinds


    var settingslist = new Vue({
        el: 'ul#settingslist',
        data: {settings},
        methods: {
            saveSettings: function() {
                localStorage.setItem('settings', JSON.stringify(omitKeys(settings, ['name', 'desc'], true)) )
            }
        }
    })
    settingslist._data.elements = settings

    var project_vue = new Vue({
        el: '#project_settings',
        data: {Project}
    })
    project_vue._data.Project = Project


    var displaypresets_vue = new Vue({
        el: '#display_presets',
        data: {display_presets},
        methods: {
            applyPreset: function(preset, event) {
                var index = display_presets.indexOf(preset)
                applyDisplayPreset(display_presets[index])
            },
            deletePreset: function(preset, event) {
                var index = display_presets.indexOf(preset)
                if (display_presets[index].fixed == true) return;
                display_presets.splice(index, 1)
                localStorage.setItem('display_presets', JSON.stringify(display_presets))
            }
        }
    })
    displaypresets_vue._data.display_presets = display_presets

    var stats_bar_vue = new Vue({
        el: '#status_bar',
        data: {Prop}
    })
    project_vue._data.Prop = Prop
}
function resetAllKeybindings() {
    $.extend(keybinds, keybindSetup(true))
    localStorage.setItem('keybinds', JSON.stringify(omitKeys(keybinds, ['name'], true)))
}
function canvasGridSize(shift, ctrl) {
    if (!shift && !ctrl) {
        return 16 / limitNumber(settings.edit_size.value, 1, 64)
    } else if (ctrl && shift) {
        var basic = 16 / limitNumber(settings.edit_size.value, 1, 64)
        var control = 16 / limitNumber(settings.ctrl_size.value, 1, 1024)
        var shift = 16 / limitNumber(settings.shift_size.value, 1, 1024)
        control = basic / control
        return shift / control
    } else if (ctrl) {
        return 16 / limitNumber(settings.ctrl_size.value, 1, 1024)
    } else {
        return 16 / limitNumber(settings.shift_size.value, 1, 1024)
    }
}

//NSlide Trigger
function setupNslides(scope) {

    if (!scope) {
        scope = $('body')
    }

    scope.find('.nslide').draggable({
        revert: true,
        axis: 'x',
        revertDuration: 0,
        helper: function () {return '<div id="nslide_head"><span id="nslide_offset"></span><br><span id="nslide_accuracy"></span></div>'},
        opacity: 0.8,
        appendTo: 'body',
        cursor: "none",
        drag: function(event, ui) {
            nslideSlide(this, event, ui)
        },
        start: function(event, ui) {
            nslide.pre = canvasGridSize()
            nslide.top = ui.position.top
            nslide.left = ui.position.left
        },
        stop: function() {
            Canvas.updatePositions()
            setUndo('Moved element')
        }
    })

    scope.find('.nslide').keypress(function (e) {
        if (e.keyCode === 10 || e.keyCode === 13) {
            e.preventDefault();
            $(this).attr('contenteditable', 'false')
            $(this).removeClass('editing')
            var number = $(this).text().replace(/[^-.0-9]/g, "");
            $(this).text(number)
        }
    })
    .keyup(function (e) {
        if (e.keyCode !== 10 && e.keyCode !== 13) {
            nslideInput($(this))
        }
    })
    .focusout(function() {
        $(this).attr('contenteditable', 'false')
            $(this).removeClass('editing')
        var number = $(this).text().replace(/[^-.0-9]/g, "");
        $(this).text(number)
    })
    scope.find('.nslide').click(function(event) {
        if (selected.length === 0 && !selected_group) return;
        if (event.target != this) return;
        $(this).find('.nslide_arrow').remove()
        $(this).attr('contenteditable', 'true')
        $(this).addClass('editing')
        $(this).focus()
        document.execCommand('selectAll')
        //$(this).val(nslideStorage($(this).attr('n-action')))
        /*
        $(this).keyup(function(event) {
            if (event.which == 13) {
            }
        })
        */
    });
    scope.find('.nslide_tool').on('mouseenter', function() {
    if (selected.length === 0 && !selected_group) return;

        var item = [
            '<div class="nslide_arrow" onclick="nslideArrow($(this), -1, event)"><i class="material-icons">navigate_before</i></div>',
            '<div class="nslide_arrow na_right" onclick="nslideArrow($(this), 1, event)"><i class="material-icons">navigate_next</i></div>'
        ].join('')
        $(this).append(item)
    })
    scope.find('.nslide_tool').on('mouseleave', function() {
        $(this).parent().find('.nslide_arrow').remove()
    })
}
function nslideSlide(obj, event, ui) {
    if (selected.length === 0 && !selected_group) return;

    //Variables
    var isUV = false
    if ($(obj).attr('n-action').includes('uv') === true) isUV = true
    var number = 0;
    var y_offset = event.clientY-nslide.top
    var divider = 1;
    var color = ''

    //Lock
    if (event.shiftKey === true && nslide.lock === null) {
        nslide.lock = y_offset
    } else if (event.shiftKey === false && nslide.lock !== null) {
        nslide.lock = null;
    }
    if (nslide.lock !== null) {
        y_offset = nslide.lock
    }

    //Accuracy Level
    if (y_offset < 100) {
        divider = 1
        color = '#0ba3fb'   //Blue
    } else if (y_offset < 200) {
        divider = 2
        color = '#07c438'   //Green
    } else if (y_offset < 300) {
        divider = 4
        color = '#eda803'   //Yellow
    } else {
        divider = 8
        color = '#ff2f06'   //Red
    }

    //Slider Head
    $('#nslide_head #nslide_accuracy').text('Accuracy: '+divider)
    $('#nslide_head #nslide_accuracy').css('background', color)

    //Math
    var offset = Math.round((event.clientX-nslide.left)/50)
    if (isUV === false) {
        offset *= canvasGridSize();
    }
    var difference = offset - nslide.pre;
    nslide.pre = offset;
    difference = difference / divider;
    if (difference == 0) return;
    var action = $(obj).attr('n-action')

    //Group Origin
    if (selected_group && action.includes('origin')) {
        executeNslide(action, 0, difference)
        updateSelection()
        return;
    }

    //Elements
    selected.forEach(function(s) {
        executeNslide($(obj).parent(), s, difference)
    })

    //Update
    if (isUV === false) {
        Canvas.updatePositions()
    } else {
        Canvas.updateUVs()
    }
}
function nslideInput(obj) {
    if (selected.length === 0 && !selected_group) return;
    var number = $(obj).text().replace(/[^-.0-9]/g, "");
    var number = parseFloat(number)
    if (isNaN(number)) {
        return;
    }
    //UV
    var action = $(obj).attr('n-action')
    if (action.includes('uv')) {
        $(obj).parent().change()
        nslide.editor.nslideInput(action, number)
        return;
    }
    nslideStorage(action, number)
    Canvas.updateUVs()
    Canvas.updatePositions()
}
function nslideArrow(button, difference, event) {
    if (selected.length === 0 && !selected_group) return;
    var obj = $(button).parent();
    var action = $(obj).find('.nslide').attr('n-action');


    if (action.includes('uv') === false) {
        difference *= canvasGridSize(event.shiftKey, event.ctrlKey);
    }


    var isUV = false
    if (action.includes('uv') === true) isUV = true

    //Group Origin
    if (selected_group && action.includes('origin')) {
        executeNslide(action, 0, difference)
        updateSelection()
        return;
    }

    //Elements
    selected.forEach(function(s) {
        executeNslide(obj, s, difference)
    })

    //Update
    if (isUV === false) {
        Canvas.updatePositions()
    } else {
        Canvas.updateUVs()
    }

    setUndo('Moved cube')
}
//Internal
function executeNslide(action, index, difference) {
    if (typeof action !== 'string') {
        $(action).change()
        action = $(action).find('.nslide').attr('n-action')
        if (action.includes('uv')) {
            nslide.editor.slider(action, difference, index)
            return;
        }
    }
    var number = nslideStorage(action, false, index)
    number += difference;
    nslideStorage(action, number, index)
    $('#nslide_head #nslide_offset').text('Offset: '+number)
}
function nslideStorage(key, val, index) {
    if (key.includes('uv')) {
        return;
    }
    var group_origin = key.includes('origin') && selected_group && (settings.entity_mode.value || selected.length === 0)
    if (val !== undefined && val !== false) {
        if (group_origin) {
            switch (key) {
                case 'origin_x':
                selected_group.origin[0] = val
                break;
                case 'origin_y':
                selected_group.origin[1] = val
                break;
                case 'origin_z':
                selected_group.origin[2] = val
                break;
            }
            Canvas.updatePositions()
        } else if (selected.length > 0) {
            if (index !== undefined) {
                affected = [index]
            } else {
                affected = selected;
            }
            affected.forEach(function(s, i) {
                if (key.includes('origin') && elements[s].rotation == undefined) {
                    elements[s].rotation = {origin:[8,8,8], axis: 'y', angle: 0}
                }
                switch (key) {
                    case 'pos_x':
                    moveCube(elements[s], val, 0)
                    break;
                    case 'pos_y':
                    moveCube(elements[s], val, 1)
                    break;
                    case 'pos_z':
                    moveCube(elements[s], val, 2)
                    break;

                    case 'size_x':
                    scaleCube(elements[s], val, 0)
                    break;
                    case 'size_y':
                    scaleCube(elements[s], val, 1)
                    break;
                    case 'size_z':
                    scaleCube(elements[s], val, 2)
                    break;

                    case 'origin_x':
                    elements[s].rotation.origin[0] = val
                    break;
                    case 'origin_y':
                    elements[s].rotation.origin[1] = val
                    break;
                    case 'origin_z':
                    elements[s].rotation.origin[2] = val
                    break;

                //
                    case 'moveuv_x':
                    moveUVCoord(0, val, elements[s], i)
                    break;
                    case 'moveuv_y':
                    moveUVCoord(1, val, elements[s], i)
                    break;

                    case 'scaleuv_x':
                    scaleUVCoord(0, val, elements[s], i)
                    break;
                    case 'scaleuv_y':
                    scaleUVCoord(1, val, elements[s], i)
                    break;
                }
            })
        }
    } else {                                //GET
        if (index == undefined) index = selected[0]
        switch (key) {
            case 'pos_x':
            return elements[index].from[0]
            break;
            case 'pos_y':
            return elements[index].from[1]
            break;
            case 'pos_z':
            return elements[index].from[2]
            break;

            case 'size_x':
            return elements[index].size(0)
            break;
            case 'size_y':
            return elements[index].size(1)
            break;
            case 'size_z':
            return elements[index].size(2)
            break;

            case 'origin_x':
            if (group_origin) {
                return selected_group.origin[0]
            } else if (elements[index]) {
                try {
                    return elements[index].rotation.origin[0]
                } catch (err) {
                    return 8;
                }
            }
            break;
            case 'origin_y':
            if (group_origin) {
                return selected_group.origin[1]
            } else if (elements[index]) {
                try {
                    return elements[index].rotation.origin[1]
                } catch (err) {
                    return 8;
                }
            }
            break;
            case 'origin_z':
            if (group_origin) {
                return selected_group.origin[2]
            } else if (elements[index]) {
                try {
                    return elements[index].rotation.origin[2]
                } catch (err) {
                    return 8;
                }
            }
            break;
        }
    }
}
function updateNslideValues() {
    var m_pos = ['', '', '']
    var m_size = ['', '', '']
    var m_origin = ['', '', '']
    //Pos/Size
    if (selected.length > 0) {
        m_pos = elements[selected[0]].from

        m_size = [elements[selected[0]].size(0), elements[selected[0]].size(1), elements[selected[0]].size(2)]
    }

    //Origin
    if (settings.entity_mode.value) {
        if (selected_group) {
            m_origin = selected_group.origin
        }
    } else if (selected.length > 0) {
        if (elements[selected[0]].rotation != undefined) {
            m_origin = elements[selected[0]].rotation.origin
        }
    } else if (selected_group) {
        m_origin = selected_group.origin
    }
    $('div.nslide[n-action="pos_x"]:not(".editing")').text(trimFloatNumber(m_pos[0]))
    $('div.nslide[n-action="pos_y"]:not(".editing")').text(trimFloatNumber(m_pos[1]))
    $('div.nslide[n-action="pos_z"]:not(".editing")').text(trimFloatNumber(m_pos[2]))

    $('div.nslide[n-action="size_x"]:not(".editing")').text(trimFloatNumber(m_size[0]))
    $('div.nslide[n-action="size_y"]:not(".editing")').text(trimFloatNumber(m_size[1]))
    $('div.nslide[n-action="size_z"]:not(".editing")').text(trimFloatNumber(m_size[2]))

    $('div.nslide[n-action="origin_x"]:not(".editing")').text(trimFloatNumber(m_origin[0]))
    $('div.nslide[n-action="origin_y"]:not(".editing")').text(trimFloatNumber(m_origin[1]))
    $('div.nslide[n-action="origin_z"]:not(".editing")').text(trimFloatNumber(m_origin[2]))
}

//Movement
function isInBox(val) {
    return (val < 32 && val > -16 || settings.entity_mode.value)
}
function limitToBox(val) {
    if (settings.entity_mode.value) {
        return val;
    } else if (val > 32) {
        return 32;
    } else if (val < -16) {
        return -16;
    } else {
        return val;
    }
}
function moveCube(obj, val, axis) {
    //Obj = Direct  -  val = Total  -   Axis = Number
    val = limitToBox(val)
    val = limitToBox(val + obj.size(axis))
    var size = obj.size(axis)
    var difference = val - obj.to[axis]
    obj.to[axis] = val
    obj.from[axis] = val - size
    if (obj.rotation && movementAxis === false) {
        obj.rotation.origin[axis] += difference
    }
    obj.mapAutoUV()
}
function scaleCube(obj, val, axis) {
    obj.to[axis] = limitToBox(val + obj.from[axis])
    obj.mapAutoUV()
}
function scaleCubeNegative(obj, val, axis) {
    obj.from[axis] = limitToBox(obj.to[axis] - val)
    obj.mapAutoUV()
}
function moveCubesRelative(difference, index) { //Multiple
    var axes = []
    // < >
    // PageUpDown
    // ^ v
    var facing = getFacingDirection()
    var height = getFacingHeight()
    switch (facing) {
        case 'north': axes = ['x', 'z', 'y']; break;
        case 'south': axes = ['x', 'z', 'y']; break;
        case 'west':  axes = ['z', 'x', 'y']; break;
        case 'east':  axes = ['z', 'x', 'y']; break;
    }

    if (height !== 'middle') {
        if (index === 1) {
            index = 2
        } else if (index === 2) {
            index = 1
        }
    }
    if (facing === 'south' && (index === 0 || index === 1))  difference *= -1
    if (facing === 'west'  && index === 0)  difference *= -1
    if (facing === 'east'  && index === 1)  difference *= -1
    if (index === 2 && height !== 'down') difference *= -1
    if (index === 1 && height === 'up') difference *= -1

    difference *= canvasGridSize();
    
    var action = 'pos_'+axes[index]
    selected.forEach(function(s) {
        executeNslide(action, s, difference)
    })
    Canvas.updatePositions()
    setUndo('Moved cube')
}


//Selections
function addToSelection(id, event, isOutlinerClick) {
    if (elements[id] === undefined) return false;
    //Shift
    if (event.shiftKey === true && elements[id].getParentArray().includes(elements[selected[selected.length-1]]) && isOutlinerClick) {
        var starting_point;
        var last_selected = elements[selected[selected.length-1]]
        elements[id].getParentArray().forEach(function(s, i) {
            if (s === last_selected || s === elements[id]) {
                if (starting_point) {
                    starting_point = false
                } else {
                    starting_point = true
                }
                if (s.type === 'cube') {
                    var index = elements.indexOf(s)
                    if (!selected.includes(index)) {
                        selected.push(index)
                    }
                } else {
                    s.selectLow()
                }
            } else if (starting_point) {
                if (s.type === 'cube') {
                    var index = elements.indexOf(s)
                    if (!selected.includes(index)) {
                        selected.push(index)
                    }
                } else {
                    s.selectLow(false)
                }
            }
        })


    //Control
    } else if (event.ctrlKey || event.shiftKey ) {
        if (selected.includes(id)) {
            selected = selected.filter(function(e) {return e !== id})
        } else {
            selected.push(id)
        }


    //Normal
    } else {
        selected = [id]
        elements[id].showInOutliner()
    }
    if (selected_group) {
        selected_group.unselect()
    }
    getAllOutlinerGroups().forEach(function(s) {
        s.display.isselected = false;
    })
    updateSelection()
    return elements[id];
}
function updateSelection() {
    //Clear
    scene.remove(rot_origin)
    Transformer.detach()
    Transformer.hoverAxis = null;
    outlines.children = []
    elements.forEach(function(s) {
        s.display.isselected = false
    })

    //Selected Elements
    selected = selected.filter(function(s) {
        return typeof elements[s] === 'object' && elements[s].type === 'cube'
    })


    selected.forEach(function(s) {
        elements[s].display.isselected = true
        Canvas.buildOutline(s)
        if (Prop.tool !== 'brush' && elements[s].display.visibility === true) {
            Transformer.attach(elements[s].display.mesh)
        }
    })
    Canvas.updateAllFaces()

    //Interface
    if (selected.length > 0) {
        $('.selection_only').css('visibility', 'visible')
        main_uv.loadData()
    } else if (selected.length === 0) {
        $('.selection_only').css('visibility', 'hidden')
    }
    if (
        (settings.entity_mode.value === true && selected_group !== undefined) ||
        (settings.entity_mode.value === false && (selected_group !== undefined || selected.length > 0))
    ) {
        Rotation.load()
    }
    $('#outliner_stats').text(selected.length+'/'+elements.length)

    //Misc
    movementAxis = isMovementOnRotatedAxis()
    centerTransformer()
    updateNslideValues()
    if (settings.entity_mode.value) {
        if (selected_group) {
            $('.selection_only#options').css('visibility', 'visible')
            if (settings.origin.value) {
                setOriginHelper({origin: selected_group.origin, axis: 'x', angle: 0})
            }
        } else {
            $('.selection_only#options').css('visibility', 'hidden')
        }
    } else {
        //Origin Helper
        if (selected.length === 1 && settings.origin.value) {
            var obj = elements[selected[0]]
            if (obj.rotation != undefined) {
                setOriginHelper(obj.rotation)
            } else if (settings.origin.value) {
                setOriginHelper({origin: [8,8,8], axis: 'x', angle: 0})
            }
        }
    }
}
function selectAll() {
    if (selected.length < elements.length) {
        selected.length = 0
        var i = 0; 
        while (elements.length > i) {
            selected.push(i)
            i++;
        }
    } else {
        selected.length = 0
        if (selected_group) selected_group.unselect()
    }
    updateSelection()
    Blockbench.dispatchEvent('select_all')
}
function unselectAll() {
    selected.length = 0
    if (selected_group) selected_group.unselect()
    getAllOutlinerGroups().forEach(function(s) {
        s.display.isselected = false
    })
    updateSelection()
}
function invertSelection() {
    elements.forEach(function(s, i) {
        if (selected.includes(i)) {
            selected.splice(selected.indexOf(i), 1)
        } else {
            selected.push(i)
        }
    })
    updateSelection()
    Blockbench.dispatchEvent('invert_selection')
}
function createSelection() {
    if ($('#selgen_new').is(':checked')) {
        selected.length = 0
    }
    var name_seg = $('#selgen_name').val().toUpperCase()
    var rdm = $('#selgen_random').val()/100

    var array = elements
    if ($('#selgen_group').is(':checked') && selected_group) {
        array = selected_group.children
    }

    array.forEach(function(s, i) {
        if (s.name.toUpperCase().includes(name_seg) === false) return;
        if (Math.random() > rdm) return;
        selected.push(i)
    })
    updateSelection()
    hideDialog()
}

function limitCoord(coord) {
    if (settings.entity_mode.value === true) return coord
    if (coord > 32) {coord = 32}
    else if (coord < -16) {coord = -16}
    return coord;
}

//Undo
var Undo = {
    index: 0,
    history: [],

    add: function(action) {
        var entry = new Undo.historyEntry(action)

        //Clear History if in middle
        if (Undo.history.length-1 > Undo.index) {
            Undo.history.length = Undo.index+1
        }
     
        if (Undo.history[Undo.history.length-1] != entry) {
            Undo.history.push(entry)
        }
        if (Undo.history.length > settings.undo_limit.value) {
            Undo.history.shift()
        }
        Undo.index = Undo.history.length-1
        Prop.project_saved = false;
    },
    undo: function() {
        if (Undo.history.length <= 0 || Undo.index < 1) return;

        Prop.project_saved = false;
        Undo.index--;

        var entry = Undo.history[Undo.index]
        Undo.loadEntry(entry)
        console.log('Undo: '+Undo.history[Undo.index+1].action)
        Blockbench.dispatchEvent('undo', {entry: entry})
    },
    redo: function() {
        if (Undo.history.length <= 0) return;
        if (Undo.index+1 >= Undo.history.length) {
            return;
        }
        Prop.project_saved = false;
        Undo.index++;

        var entry = Undo.history[Undo.index]
        Undo.loadEntry(entry)
        console.log('Redo: '+entry.action)
        Blockbench.dispatchEvent('redo', {})
    },
    loadEntry: function(entry) {
        selected.length = 0
        updateSelection()
        if (selected_group) {
            selected_group.unselect()
        }

        elements.length = 0
        textures.length = 0

        entry.elements.forEach(function(s, i) {
            elements.push(new Cube().extend(s))
            if (s.display.isselected === true) {
                selected.push(i)
            }
        })

        entry.textures.forEach(function(s) {
            var tex = new Texture(s)

            if (Blockbench.isWeb === false) {
                var arr = tex.iconpath.split('?')
                arr[arr.length-1] = tex_version
                tex.iconpath = arr.join('?')
            }

            tex.load()
            textures.push(tex)
        })

        parseGroups(JSON.parse(entry.outliner))
        main_uv.setFace(entry.face)

        if (TreeElements.length === 0) {       
            TreeElements.push('a')
            TreeElements.splice(0, 1)
        }

        Canvas.updateAll()
        outliner.$forceUpdate();
        loadOutlinerDraggable()
        texturelist.$forceUpdate();
    },
    historyEntry: function(action) {       //Constructor
        var entry = this;

        this.action = action
        this.face = main_uv.face
        this.elements = []
        elements.forEach(function(s, i) {
            entry.elements.push(new Cube().extend(s))
            entry.elements[entry.elements.length-1].display.isselected = selected.includes(i) === true
        })
        this.textures = []
        textures.forEach(function(s) {
            var tex = {}
            $.extend(true, tex, s)
            delete tex.material
            delete tex.img
            entry.textures.push(tex)
        })
        this.outliner = JSON.stringify(compileGroups())
    }
}
function setUndo(action) {
    if (settings.show_actions.value === true) {
        showStatusMessage(action)
    }
    Undo.add(action)
}

//Misc
function setTool(stool) {
    Prop.tool = stool
    $(canvas1).css('cursor', 'default')

    switch(stool) {
        case 'brush':
            showQuickMessage('Select a template cube')
            brush_template = 'select';
            $(canvas1).css('cursor', 'crosshair')
            break;
        case 'translate':
            Transformer.setMode('translate')
            break;
        case 'scale':
            Transformer.setMode('scale')
            break;
    }
    updateSelection()
    $('.tool.sel').removeClass('sel')
    $('.tool#tool_'+Prop.tool).addClass('sel')
}
function paint() {
    if (!$('#tool_brush.sel').length) return
    var from = [
        elements[selected[0]].from[0]+0,
        elements[selected[0]].from[1]+0,
        elements[selected[0]].from[2]+0
    ]
    var canvas_grid = canvasGridSize()
    var sizes = [canvas_grid, canvas_grid, canvas_grid]
    if (brush_template && brush_template.type === 'cube') {
        sizes = brush_template.size()
    }
    switch (main_uv.face) {
        case 'north':
        from[2] -= sizes[2];
        break;
        case 'south':
        from[2] += sizes[2];
        break;
        case 'west':
        from[0] -= sizes[0];
        break;
        case 'east':
        from[0] += sizes[0];
        break;

        case 'up':
        from[1] += sizes[1];
        break;
        case 'down':
        from[1] -= sizes[1];
        break;
    }

    var base_cube = new Cube()
    if (typeof brush_template === 'object') {
        base_cube.extend(brush_template).addTo(brush_template.display.parent)
    }
    base_cube.uuid = guid()

    base_cube.to = [
        from[0]+base_cube.size(0),
        from[1]+base_cube.size(1),
        from[2]+base_cube.size(2)
    ]
    if (settings.entity_mode.value === false) {
        var i = 0
        while (i < 3) {
            if (base_cube.to[i] > 32 || from[i] < -16) return;
            i++;
        }
    }
    var number = base_cube.name.match(/[0-9]+$/)
    if (number) {
        number = parseInt(number[0])
        base_cube.name = base_cube.name.split(number).join(number+1)
    }

    base_cube.from = from
    base_cube.display.mesh = undefined;
    elements.push(base_cube)
    selected.length = 0
    selected.push(elements.length-1)
    Canvas.updateSelected()
    setUndo('Painted voxel')
}

var Screencam = {
    copyCanvas: function() {
        dataUrl = canvas1.toDataURL()
        if (isApp) {
            var screenshot = nativeImage.createFromDataURL(dataUrl)
            clipboard.writeImage(screenshot)
            Blockbench.showMessage('Screenshot copied to clipboard', 'center')
        } else {
            new Dialog({
                title: 'Screenshot - Right Click to copy', 
                id: 'screenie', 
                lines: ['<img src="'+dataUrl+'" width="600px" class="allow_default_menu"></img>'],
                draggable: true,
                singleButton: true
            }).show()
        }
    },
    cleanCanvas: function() {

        scene.remove(three_grid)
        scene.remove(Transformer)
        scene.remove(outlines)
        scene.remove(rot_origin)

        setTimeout(function() {

            Screencam.copyCanvas()
            scene.add(three_grid)
            scene.add(Transformer)
            scene.add(outlines)

            if (selected.length === 1 && settings.origin.value) {
                var obj = elements[selected[0]]
                if (obj.rotation != undefined) {
                    setOriginHelper(obj.rotation)
                } else if (settings.origin.value) {
                    setOriginHelper({origin: [8,8,8], axis: 'x', angle: 0})
                }
            }

        }, 40)
    },
    fullScreen: function() {
        currentwindow.capturePage(function(screenshot) {
            /*
            clipboard.writeImage(screenshot)
            Blockbench.showMessage('Screenshot copied to clipboard', 'center')
            */
        })
    }
}
//Transform
function rotateUVFace(number, iteration) {
    while (iteration > 0) {
        if (number == undefined) {
            number = 90
        } else {
            number += 90
            if (number == 360) {
                number = undefined
            }
        }
        iteration -= 1;
    }
    return number;
}
function rotateSelectedY(iteration, skipSave) {
    var origin = [8, 8, 8]
    if (selected_group) {
        origin = selected_group.origin.slice()
    } else if (elements[selected[0]].rotation != undefined) {
        origin = elements[selected[0]].rotation.origin.slice()
    }
    while (iteration > 0) {
        selected.forEach(function(s) {
            var cube = elements[s]
            //main
            var x = cube.from[2]
            cube.from[2] = cube.to[2]
            cube.to[2] = x
            cube.from = rotateCoordsY(cube.from, 1, origin)
            cube.to = rotateCoordsY(cube.to, 1, origin)
            if (cube.rotation) {
                cube.rotation.origin = rotateCoordsY(cube.rotation.origin, 1, origin)
            }
            //Fine Rotation
            if (cube.rotation !== undefined) {
                if (cube.rotation.axis === 'x') {
                    cube.rotation.axis = 'z'
                } else if (cube.rotation.axis != 'y') {
                    cube.rotation.axis = 'x'
                    cube.rotation.angle *= (-1)
                }
            }
            //Faces
            if (cube.faces.up.rotation == undefined) {
                cube.faces.up.rotation = 90
            } else {
                cube.faces.up.rotation += 90
                if (cube.faces.up.rotation == 360) {
                    delete cube.faces.up.rotation
                }
            }
            if (cube.faces.down.rotation == undefined) {
                cube.faces.down.rotation = 270
            } else {
                cube.faces.down.rotation -= 90
                if (cube.faces.down.rotation == 0) {
                    delete cube.faces.down.rotation
                }
            }
            var temp = cube.faces.north
            cube.faces.north = cube.faces.west
            cube.faces.west = cube.faces.south
            cube.faces.south = cube.faces.east
            cube.faces.east = temp
        })
        iteration -= 1;
    }
    if (!skipSave) {
        Canvas.updatePositions()
        Canvas.updateSelectedFaces()
        setUndo('Rotated cubes')
    }
}
function rotateCoordsY(array, axis, origin) {
    if (origin === undefined) {
        origin = [8, 8, 8]
    }
    var a, b;
    array.forEach(function(s, i) {
        if (i == axis) {
            //
        } else {
            if (a == undefined) {
                a = s - origin[i]
                b = i
            } else {
                array[b] = s - origin[i]
                array[b] = origin[b] - array[b]
                array[i] = origin[i] + a;
            }
        }
    })
    return array
}
function rotateSelectedX(iteration, skipSave) {
    var origin = [8, 8, 8]
    if (selected_group) {
        origin = selected_group.origin.slice()
    } else if (elements[selected[0]].rotation != undefined) {
        origin = elements[selected[0]].rotation.origin.slice()
    }
    while (iteration > 0) {
        selected.forEach(function(s) {
            var cube = elements[s]
            //Coordinates
            var y = cube.from[2]
            cube.from[2] = cube.to[2]
            cube.to[2] = y
            cube.from = rotateCoordsX(cube.from, 1, origin)
            cube.to = rotateCoordsX(cube.to, 1, origin)
            if (cube.rotation) {
                cube.rotation.origin = rotateCoordsX(cube.rotation.origin, 1, origin)
            }
            //Fine Rotation
            if (cube.rotation !== undefined) {
                if (cube.rotation.axis === 'y') {
                    cube.rotation.axis = 'z'
                } else if (cube.rotation.axis != 'x') {
                    cube.rotation.axis = 'y'
                    cube.rotation.angle *= (-1)
                }
            }

            //UV
            cube.faces.west.rotation = rotateUVFace(cube.faces.west.rotation, 1)
            cube.faces.east.rotation = rotateUVFace(cube.faces.east.rotation, 3)
            cube.faces.north.rotation = rotateUVFace(cube.faces.north.rotation, 2)
            cube.faces.down.rotation = rotateUVFace(cube.faces.down.rotation, 2)

            var temp = cube.faces.north
            cube.faces.north = cube.faces.down
            cube.faces.down = cube.faces.south
            cube.faces.south = cube.faces.up
            cube.faces.up = temp
        })
        iteration -= 1;
    }
    if (!skipSave) {
        Canvas.updatePositions()
        Canvas.updateSelectedFaces()
        setUndo('Rotated cubes')
    }
}
function rotateCoordsX(array, axis, origin) {
    if (origin === undefined) {
        origin = [8, 8, 8]
    }
    var new_array = [
        array[0],
        origin[1] - ( array[2] - origin[2] ),
        origin[2] + ( array[1] - origin[1] )
    ]
    return new_array
}
function rotateSelectedZ(iteration) {
    if (iteration === 1) {
        rotateSelectedX(1)
        rotateSelectedY(1)
        rotateSelectedX(3)
    } else {
        rotateSelectedX(1)
        rotateSelectedY(3)
        rotateSelectedX(3)
    }
    Canvas.updatePositions()
    Canvas.updateSelectedFaces()
    setUndo('Rotated cubes')
}
function mirror(axis) {
    function mirrorUVX(uv) {
        return [uv[2], uv[1], uv[0], uv[3]]
    }
    function mirrorUVY(uv) {
        return [uv[0], uv[3], uv[2], uv[1]]
    }
    var center = 8
    if (selected_group) {
        center = selected_group.origin[axis]
    }
    selected.forEach(function(s) {
        var obj = elements[s]
        if (obj.rotation) {
            if (obj.rotation.axis !== axisIndex(axis)) {
                obj.rotation.angle *= -1
            }
        }
        var from = obj.from[axis]
        obj.from[axis] = center - (obj.to[axis] - center)
        obj.to[axis] = center - (from - center)
        if (obj.rotation) {
            obj.rotation.origin[axis] = center - (obj.rotation.origin[axis] - center)
        }
        //Faces
        var switchFaces;
        switch(axis) {
            case 0: switchFaces = ['west', 'east']; break;
            case 1: switchFaces = ['up', 'down']; break;
            case 2: switchFaces = ['south', 'north']; break;
        }
        var x = obj.faces[switchFaces[0]]
        obj.faces[switchFaces[0]] = obj.faces[switchFaces[1]]
        obj.faces[switchFaces[1]] = x
        //UV
        if (axis === 1) {
            obj.faces.north.uv = mirrorUVY(obj.faces.north.uv)
            obj.faces.south.uv = mirrorUVY(obj.faces.south.uv)
            obj.faces.east.uv = mirrorUVY(obj.faces.east.uv)
            obj.faces.west.uv = mirrorUVY(obj.faces.west.uv)
        } else {
            obj.faces.north.uv = mirrorUVX(obj.faces.north.uv)
            obj.faces.south.uv = mirrorUVX(obj.faces.south.uv)
            obj.faces.east.uv = mirrorUVX(obj.faces.east.uv)
            obj.faces.west.uv = mirrorUVX(obj.faces.west.uv)
        }
        if (axis === 0) {
            obj.faces.up.uv = mirrorUVX(obj.faces.up.uv)
            obj.faces.down.uv = mirrorUVX(obj.faces.down.uv)
        } else {
            obj.faces.up.uv = mirrorUVY(obj.faces.up.uv)
            obj.faces.down.uv = mirrorUVY(obj.faces.down.uv)
        }
    })
    Canvas.updatePositions()
    Canvas.updateSelectedFaces()
    setUndo('Mirrored cubes')
}
function openScaleAll() {
    $('#model_scale_range').val(1)
    $('#model_scale_label').val(1)

    selected.forEach(function(s) {
        var obj = elements[s]
        obj.display.before = {from: [], to: [], origin: [8, 8, 8]}
        obj.display.before.from[0] = obj.from[0]
        obj.display.before.from[1] = obj.from[1]
        obj.display.before.from[2] = obj.from[2]

        obj.display.before.to[0] = obj.to[0]
        obj.display.before.to[1] = obj.to[1]
        obj.display.before.to[2] = obj.to[2]

        if (obj.rotation !== undefined ) {
            obj.display.before.origin[0] = obj.rotation.origin[0]
            obj.display.before.origin[1] = obj.rotation.origin[1]
            obj.display.before.origin[2] = obj.rotation.origin[2]
        }
    })
    showDialog('scaling')
}
function scaleAll(save, size) {
    if (save === true) {
        hideDialog()
    }
    if (size === undefined) {
        size = $('#model_scale_label').val()
    }
    origin = [8, 8, 8]
    if (settings.entity_mode.value) {
        origin = [0, 0, 0]
    } else if (selected_group) {
        origin = selected_group.origin
    }
    var clip = false
    selected.forEach(function(s) {
        var obj = elements[s]
        obj.display.autouv = false;
        origin.forEach(function(ogn, i) {
            if ($('#model_scale_'+getAxisLetter(i)+'_axis').is(':checked')) {

                obj.from[i] = (obj.display.before.from[i] - ogn) * size
                if (obj.from[i] + ogn > 32 || obj.from[i] + ogn < -16) clip = true
                obj.from[i] = limitCoord(obj.from[i] + ogn)

                obj.to[i] = (obj.display.before.to[i] - ogn) * size
                if (obj.to[i] + ogn > 32 || obj.to[i] + ogn < -16) clip = true
                obj.to[i] = limitCoord(obj.to[i] + ogn)

                if (obj.rotation !== undefined) {
                    obj.rotation.origin[i] = (obj.display.before.origin[i] - ogn) * size
                    obj.rotation.origin[i] = obj.rotation.origin[i] + ogn
                }
            } else {

                obj.from[i] = obj.display.before.from[i]
                obj.to[i] = obj.display.before.to[i]

                if (obj.rotation !== undefined) {
                    obj.rotation.origin[i] = obj.display.before.origin[i]
                }

            }
        })
        if (save === true) {
            delete obj.display.before
        }
    })
    if (clip && settings.entity_mode.value === false) {
        $('#scaling_clipping_warning').text('Model clipping: Your model is too large for the canvas')
    } else {
        $('#scaling_clipping_warning').text('')
    }
    Canvas.updatePositions()
    if (save === true) {
        setUndo('Scaled cubes')
    }
}
function modelScaleSync(label) {
    if (label) {
        var size = $('#model_scale_label').val()
        $('#model_scale_range').val(size)
    } else {
        var size = $('#model_scale_range').val()
        $('#model_scale_label').val(size)
    }
    scaleAll(false, size)
}
function cancelScaleAll() {
    selected.forEach(function(s) {
        var obj = elements[s]
        if (obj === undefined) return;
        obj.from[0] = obj.display.before.from[0]
        obj.from[1] = obj.display.before.from[1]
        obj.from[2] = obj.display.before.from[2]

        obj.to[0] = obj.display.before.to[0]
        obj.to[1] = obj.display.before.to[1]
        obj.to[2] = obj.display.before.to[2]

        if (obj.rotation !== undefined ) {
            obj.rotation.origin[0] = obj.display.before.origin[0]
            obj.rotation.origin[1] = obj.display.before.origin[1]
            obj.rotation.origin[2] = obj.display.before.origin[2]
        }
        delete obj.display.before
    })
    Canvas.updatePositions()
    hideDialog()
}
function centerCubesAll(axis) {
    centerCubes(0, false)
    centerCubes(1, false)
    centerCubes(2, false)
    Canvas.updatePositions()
    setUndo('Centered cubes')
}
function centerCubes(axis, update) {
    var average = 0;
    selected.forEach(function(s) {
        var obj = elements[s]
        average += obj.from[axis]
        average += obj.to[axis]
    })
    average = average / (selected.length * 2)
    var difference = 8 - average

    selected.forEach(function(s) {
        executeNslide('pos_'+getAxisLetter(axis), s, difference)
    })

    if (update !== false) {
        Canvas.updatePositions()
        setUndo('Centered cubes on '+getAxisLetter(axis))
    }
}


TextureAnimator = {
    isPlaying: false,
    interval: false,
    start: function() {
        TextureAnimator.isPlaying = true
        TextureAnimator.updateButton()
        TextureAnimator.interval = setInterval(TextureAnimator.nextFrame, 1000/settings.texture_fps.value)
    },
    stop: function() {
        TextureAnimator.isPlaying = false
        clearInterval(TextureAnimator.interval)
        TextureAnimator.updateButton()
    },
    updateSpeed: function() {
        if (TextureAnimator.isPlaying) {
            TextureAnimator.stop()
            TextureAnimator.start()
        }
    },
    nextFrame: function() {
        textures.forEach(function(tex, i) {
            if (tex.frameCount) {
                if (tex.currentFrame === undefined) {
                    tex.currentFrame = 0
                } else if (tex.currentFrame >= tex.frameCount-1) {
                    tex.currentFrame = 0
                } else {
                    tex.currentFrame++;
                }
                $($('.texture').get(i)).find('img').css('margin-top', (tex.currentFrame*-48)+'px')
            } 
        })
        var i = 0
        while (i < elements.length) {
            Canvas.updateUV(i, true)
            i++;
        }
    },
    reset: function() {
        TextureAnimator.stop()
        textures.forEach(function(tex, i) {
            if (tex.frameCount) {
                tex.currentFrame = 0
                $($('.texture').get(i)).find('img').css('margin-top', '0')
            } 
        })
        while (i < elements.length) {
            Canvas.updateUV(i, true)
            i++;
        }
    },
    updateButton: function() {
        var btn = $('#texture_animation_button')
        var i = 0;
        var shotBtn = false;
        while (i < textures.length) {
            if (textures[i].frameCount > 1) {
                shotBtn = true;
                i = textures.length
            }
            i++;
        }
        if (shotBtn) {
            btn.show()
            if (TextureAnimator.isPlaying) {
                btn.find('i').text('pause')
                btn.attr('onclick', 'TextureAnimator.stop()')
            } else {
                btn.find('i').text('play_arrow')
                btn.attr('onclick', 'TextureAnimator.start()')
            }
        } else {
            btn.hide()
            if (TextureAnimator.isPlaying) {
                TextureAnimator.stop()
            }
        }
    }
}