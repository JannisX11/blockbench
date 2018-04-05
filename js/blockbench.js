var appVersion = '1.11.1'
var osfs = '/'
var File, i;
var browser_name = 'electron'
var elements = [];
var TreeElements = [];
var textures = [];
var selected = [];
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
var g_makeNew = false;
var slider_scroll_stop_function;
var pe_list;
var holding_shift = false;
var main_uv;
var Prop = {
    active_panel:   'preview',
    wireframe:      false,
    file_path:      'Unknown',
    file_name:      '-',
    project_saved:  true,
    fps:            0,
    zoom:           100,
    facing:         'north'
}
var mouse_pos = {x:0,y:0}
var sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
var movementAxis = true;

$.ajaxSetup({ cache: false });


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
    Toolbox.updateBar()

    if (isApp) {
        updateRecentProjects()
    }
    
    setInterval(function() {
        Prop.fps = framespersecond;
        framespersecond = 0;
    }, 1000)
    Blockbench.entity_mode = false

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
            {icon: 'sort_by_alpha', name: 'Sort', condition: TreeElements.length > 0, click: function() {sortOutliner()} },
            {icon: 'playlist_add_check', name: 'Select All', condition: TreeElements.length > 0, click: function() {selectAll()} },
            {icon: 'format_indent_decrease', name: 'Collapse All', condition: TreeElements.length > 0, click: function() {collapseAllGroups()} },
            {icon: 'dns', name: 'Toggle Options', click: function() {toggleOutlinerOptions()} },
        ])
    })
    $('#texture_list').contextmenu(function(event) {
        new ContextMenu(event, [
            {icon: 'add_box', name: 'Import Texture', click: function() {openTexture()} },
            {icon: 'check_box_outline_blank', name: 'Create Blank', click: function() {Painter.addBitmapDialog()} },
            {icon: 'refresh', name: 'Reload Textures', condition: isApp, click: function() {reloadTextures()} },
        ])
    })
//Events
    $(window).on( "unload", saveLocalStorages)

    $('.entity_mode_only').hide()

    $('.ui#uv'      ).click( function() { setActivePanel('uv'      )})
    $('.ui#textures').click( function() { setActivePanel('textures')})
    $('.ui#options' ).click( function() { setActivePanel('options' )})
    $('.ui#outliner').click( function() { setActivePanel('outliner')})
    $('header'      ).click( function() { setActivePanel('header'  )})
    $('#preview'    ).click( function() { setActivePanel('preview' )})

    $('.tool').mouseenter(function() {
        var tooltip = $(this).find('div.tooltip')
        if (!tooltip || typeof tooltip.offset() !== 'object') return;
        //Left
        if (tooltip.css('left') === '-4px') {
            tooltip.css('left', 'auto')
        }
        if (-tooltip.offset().left > 4) {
            tooltip.css('left', '-4px')
        }
        //Right
        if (tooltip.css('right') === '-4px') {
            tooltip.css('right', 'auto')
        }
        if ((tooltip.offset().left + tooltip.width()) - $(window).width() > 4) {
            tooltip.css('right', '-4px')
        }
    })


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
        eval($(event.target).attr('onmouseup'))
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
    $(document).mousemove(function(event) {
        mouse_pos.x = event.clientX
        mouse_pos.y = event.clientY
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
    $('#texture_list').click(function(){
        unselectTextures()
    })
    $('#brush_color').spectrum({
        preferredFormat: "hex",
        color: 'ffffff',
        showAlpha: true,
        showInput: true
    })
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
function executeNslide(action, obj, difference) {
    if (typeof action !== 'string') {
        $(action).change()
        action = $(action).find('.nslide').attr('n-action')
        if (action.includes('uv')) {
            nslide.editor.slider(action, difference, obj)
            return;
        }
    }
    var number = nslideStorage(action, false, obj)
    number += difference;
    nslideStorage(action, number, obj)
    $('#nslide_head #nslide_offset').text('Offset: '+number)
}
function nslideStorage(key, val, obj) {
    if (key.includes('uv')) {
        return;
    }
    var group_origin = key.includes('origin') && selected_group && (Blockbench.entity_mode || selected.length === 0)
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
            var affected;
            if (obj !== undefined) {
                affected = [obj]
            } else {
                affected = selected;
            }
            affected.forEach(function(s, i) {
                if (key.includes('origin') && s.rotation == undefined) {
                    s.rotation = {origin:[8,8,8], axis: 'y', angle: 0}
                }
                switch (key) {
                    case 'pos_x':
                    moveCube(s, val, 0)
                    break;
                    case 'pos_y':
                    moveCube(s, val, 1)
                    break;
                    case 'pos_z':
                    moveCube(s, val, 2)
                    break;

                    case 'size_x':
                    scaleCube(s, val, 0)
                    break;
                    case 'size_y':
                    scaleCube(s, val, 1)
                    break;
                    case 'size_z':
                    scaleCube(s, val, 2)
                    break;

                    case 'origin_x':
                    s.rotation.origin[0] = val
                    break;
                    case 'origin_y':
                    s.rotation.origin[1] = val
                    break;
                    case 'origin_z':
                    s.rotation.origin[2] = val
                    break;

                //
                    case 'moveuv_x':
                    moveUVCoord(0, val, s, i)
                    break;
                    case 'moveuv_y':
                    moveUVCoord(1, val, s, i)
                    break;

                    case 'scaleuv_x':
                    scaleUVCoord(0, val, s, i)
                    break;
                    case 'scaleuv_y':
                    scaleUVCoord(1, val, s, i)
                    break;
                }
            })
        }
    } else {                                //GET
        if (obj == undefined) obj = selected[0]
        switch (key) {
            case 'pos_x':
            return obj.from[0]
            break;
            case 'pos_y':
            return obj.from[1]
            break;
            case 'pos_z':
            return obj.from[2]
            break;

            case 'size_x':
            return obj.size(0)
            break;
            case 'size_y':
            return obj.size(1)
            break;
            case 'size_z':
            return obj.size(2)
            break;

            case 'origin_x':
            if (group_origin) {
                return selected_group.origin[0]
            } else if (obj) {
                try {
                    return obj.rotation.origin[0]
                } catch (err) {
                    return 8;
                }
            }
            break;
            case 'origin_y':
            if (group_origin) {
                return selected_group.origin[1]
            } else if (obj) {
                try {
                    return obj.rotation.origin[1]
                } catch (err) {
                    return 8;
                }
            }
            break;
            case 'origin_z':
            if (group_origin) {
                return selected_group.origin[2]
            } else if (obj) {
                try {
                    return obj.rotation.origin[2]
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
    if (selected[0]) {
        m_pos = selected[0].from

        m_size = [selected[0].size(0), selected[0].size(1), selected[0].size(2)]
    }

    //Origin
    if (Blockbench.entity_mode) {
        if (selected_group) {
            m_origin = selected_group.origin
        }
    } else if (selected.length > 0) {
        if (selected[0].rotation != undefined) {
            m_origin = selected[0].rotation.origin
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

//Selections
function addToSelection(obj, event, isOutlinerClick) {
    if (obj === undefined) return false;
    //Shiftv
    var just_selected = []
    if (event.shiftKey === true && obj.getParentArray().includes(selected[selected.length-1]) && isOutlinerClick) {
        var starting_point;
        var last_selected = selected[selected.length-1]
        obj.getParentArray().forEach(function(s, i) {
            if (s === last_selected || s === obj) {
                if (starting_point) {
                    starting_point = false
                } else {
                    starting_point = true
                }
                if (s.type === 'cube') {
                    if (!selected.includes(s)) {
                        selected.push(s)
                        just_selected.push(s)
                    }
                } else {
                    s.selectLow()
                }
            } else if (starting_point) {
                if (s.type === 'cube') {
                    if (!selected.includes(s)) {
                        selected.push(s)
                        just_selected.push(s)
                    }
                } else {
                    s.selectLow(false)
                }
            }
        })


    //Control
    } else if (event.ctrlKey || event.shiftKey ) {
        if (selected.includes(obj)) {
            selected = selected.filter(function(e) {
                return e !== obj
            })
        } else {
            selected.push(obj)
            just_selected.push(obj)
        }


    //Normal
    } else {
        selected = [obj]
        just_selected.push(obj)
        obj.showInOutliner()
    }
    if (selected_group) {
        selected_group.unselect()
    }
    getAllOutlinerGroups().forEach(function(s) {
        s.display.isselected = false;
    })
    Blockbench.dispatchEvent('added_to_selection', {added: just_selected})
    updateSelection()
    return obj;
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
        return typeof s === 'object' && s.type === 'cube'
    })


    selected.forEach(function(obj) {
        obj.display.isselected = true
        Canvas.buildOutline(obj)
        if (Toolbox.selected.showTransformer && obj.display.visibility === true) {
            Transformer.attach(obj.display.mesh)
        }
    })
    //Canvas.updateAllFaces()

    //Interface
    if (selected.length > 0) {
        $('.selection_only').css('visibility', 'visible')
        main_uv.loadData()
    } else if (selected.length === 0) {
        $('.selection_only').css('visibility', 'hidden')
    }
    if (
        (Blockbench.entity_mode === true && selected_group !== undefined) ||
        (Blockbench.entity_mode === false && (selected_group !== undefined || selected.length > 0))
    ) {
        Rotation.load()
    }
    $('#outliner_stats').text(selected.length+'/'+elements.length)
    $('.uv_mapping_overlay').remove()

    //Misc
    movementAxis = isMovementOnRotatedAxis()
    centerTransformer()
    updateNslideValues()
    if (Blockbench.entity_mode) {
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
            var obj = selected[0]
            if (obj.rotation != undefined) {
                setOriginHelper(obj.rotation)
            } else if (settings.origin.value) {
                setOriginHelper({origin: [8,8,8], axis: 'x', angle: 0})
            }
        }
    }
    Transformer.update()
    Blockbench.dispatchEvent('update_selection')
}
function selectAll() {
    if (selected.length < elements.length) {
        selected.length = 0
        var i = 0; 
        while (elements.length > i) {
            selected.push(elements[i])
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
    elements.forEach(function(s) {
        if (selected.includes(s)) {
            selected.splice(selected.indexOf(s), 1)
        } else {
            selected.push(s)
        }
    })
    updateSelection()
    Blockbench.dispatchEvent('invert_selection')
}
function createSelection() {
    if ($('#selgen_new').is(':checked')) {
        selected.length = 0
    }
    if (selected_group) {
        selected_group.unselect()
    }
    var name_seg = $('#selgen_name').val().toUpperCase()
    var rdm = $('#selgen_random').val()/100

    var array = elements
    if ($('#selgen_group').is(':checked') && selected_group) {
        array = selected_group.children
    }

    array.forEach(function(s) {
        if (s.name.toUpperCase().includes(name_seg) === false) return;
        if (Math.random() > rdm) return;
        selected.push(s)
    })
    updateSelection()
    if (selected.length) {
        selected[0].showInOutliner()
    }
    hideDialog()
}
//Undo
var Undo = {
    index: 0,
    history: [],

    add: function(action, isTextureEdit) {
        if (settings.show_actions.value === true) {
            showStatusMessage(action)
        }
        if (isTextureEdit) {
            var entry = new Undo.textureHistoryEntry(action)
        } else {
            var entry = new Undo.historyEntry(action)
        }

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
        if (entry.type == 'texture_edit') {
            Undo.loadTextureEntry(entry)
            return;
        }
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
                selected.push(elements[elements.length-1])
            }
        })

        entry.textures.forEach(function(s) {
            var tex = new Texture(s)

            if (s.mode === 'link') {
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
    loadTextureEntry: function(entry) {

        textures.length = 0
        entry.textures.forEach(function(s) {
            var tex = new Texture(s)

            if (s.mode === 'link') {
                var arr = tex.iconpath.split('?')
                arr[arr.length-1] = tex_version
                tex.iconpath = arr.join('?')
            }

            tex.load(true, true)
            textures.push(tex)
        })
        texturelist.$forceUpdate();
    },
    historyEntry: function(action) {       //Constructor
        var entry = this;

        this.action = action
        this.face = main_uv.face
        this.elements = []
        elements.forEach(function(s) {
            entry.elements.push(new Cube().extend(s))
            entry.elements[entry.elements.length-1].display.isselected = selected.includes(s) === true
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
    },
    textureHistoryEntry: function(action) {       //Constructor
        var entry = this;

        this.action = action
        this.type = 'texture_edit'
        this.textures = []
        textures.forEach(function(s) {
            var tex = {}
            $.extend(true, tex, s)
            delete tex.material
            delete tex.img
            entry.textures.push(tex)
        })
    }
}
var setUndo = Undo.add
//Misc
var Screencam = {
    normalCanvas: function(options, cb) {
        dataUrl = canvas1.toDataURL()

        dataUrl = dataUrl.replace('data:image/png;base64,','')
        Jimp.read(Buffer.from(dataUrl, 'base64'), function() {}).then(function(image) { 
            
            image.autocrop([0, false])
            if (options && options.width && options.height) {
                image.contain(options.width, options.height)
            }

            image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
                Screencam.returnScreenshot(dataUrl, cb)
            })
        });
    },
    cleanCanvas: function(options, cb) {

        scene.remove(three_grid)
        scene.remove(Transformer)
        scene.remove(outlines)
        scene.remove(rot_origin)

        setTimeout(function() {

            Screencam.normalCanvas(options, cb)
            scene.add(three_grid)
            scene.add(Transformer)
            scene.add(outlines)

            if (selected.length === 1 && settings.origin.value) {
                var obj = selected[0]
                if (obj.rotation != undefined) {
                    setOriginHelper(obj.rotation)
                } else if (settings.origin.value) {
                    setOriginHelper({origin: [8,8,8], axis: 'x', angle: 0})
                }
            }

        }, 40)
    },
    fullScreen: function(options, cb) {
        setTimeout(function() {
            $('.context_handler.ctx').removeClass('ctx')
            $('.context_handler.ctx').removeClass('ctx')
            $('.context_handler.ctx').removeClass('ctx')
            $('.context_handler.ctx').removeClass('ctx')
        }, 10)
        setTimeout(function() {
            currentwindow.capturePage(function(screenshot) {
                var dataUrl = screenshot.toDataURL()
                dataUrl = dataUrl.replace('data:image/png;base64,','')
                Jimp.read(Buffer.from(dataUrl, 'base64'), function() {}).then(function(image) { 

                    if (options && options.width && options.height) {
                        image.contain(options.width, options.height)
                    }

                    image.getBase64(Jimp.MIME_PNG, function(a, dataUrl){
                        Screencam.returnScreenshot(dataUrl, cb)
                    })
                });
            })
        }, 40)
    },
    returnScreenshot: function(dataUrl, cb) {
        if (cb) {
            cb(dataUrl)
        } else if (isApp) {
            var screenshot = nativeImage.createFromDataURL(dataUrl)
            Blockbench.showMessageBox({
                title: 'Screenshot',
                icon: 'computer',
                message: 'Screenshot captured.',
                buttons: ['Save', 'Clipboard'],
                confirm: 0,
                cancel: 1
            }, function(result) {
                if (result === 0) {
                    app.dialog.showSaveDialog(currentwindow, {filters: [ {name: 'Image', extensions: ['png']} ]}, function (fileName) {
                        if (fileName === undefined) {
                            return;
                        }
                        fs.writeFile(fileName, screenshot.toPNG(), function (err) {})
                    })
                } else if (result === 1) {
                    clipboard.writeImage(screenshot)
                }
            })
        } else {
            new Dialog({
                title: 'Screenshot - Right Click to copy', 
                id: 'screenie', 
                lines: ['<img src="'+dataUrl+'" width="600px" class="allow_default_menu"></img>'],
                draggable: true,
                singleButton: true
            }).show()
        }
    }
}
var clipbench = {
    cubes: [],
    copy: function(event) {
        var p = Prop.active_panel
        if (open_dialog == 'uv_dialog') {
            uv_dialog.copy(event)
        } else if (display_mode) {
            copyDisplaySlot()
        } else if (p == 'uv' || p == 'preview') {
            main_uv.copy(event)
        } else if (p == 'textures' && isApp) {
            if (textures.selected) {
                clipbench.setTexture(textures.selected)
            }
        } else if (p == 'outliner') {
            clipbench.setCubes()
            clipbench.setGroup()
            if (selected_group) {
                clipbench.setGroup(selected_group)
            } else {
                clipbench.setCubes(selected)
            }
        }
    },
    paste: function(event) {
        var p = Prop.active_panel
        if (open_dialog == 'uv_dialog') {
            uv_dialog.paste(event)
        } else if (display_mode) {
            pasteDisplaySlot()
        } else if (p == 'uv' || p == 'preview') {
            main_uv.paste(event)
        } else if (p == 'textures' && isApp) {
            var img = clipboard.readImage()
            if (img) {
                var dataUrl = img.toDataURL()
                var texture = new Texture({name: 'pasted', folder: 'blocks' }).fromDataURL(dataUrl).add().fillParticle()
                setTimeout(function() {
                    texture.openMenu()
                },40)
            }
        } else if (p == 'outliner') {
            //Group
            var group = 'root'
            if (selected_group) {
                group = selected_group
            } else if (selected[0]) {
                group = selected[0]
            }
            selected.length = 0
            if (isApp) {
                var raw = clipboard.readHtml()
                try {
                    var data = JSON.parse(raw)
                    if (data.type === 'cubes' && data.content) {
                        clipbench.group = undefined
                        clipbench.cubes = data.content
                    } else if (data.type === 'group' && data.content) {
                        clipbench.group = data.content
                        clipbench.cubes = []
                    }
                } catch (err) {}
            }
            if (clipbench.group) {
                clipbench.group.duplicate(group)
            } else {
                clipbench.cubes.forEach(function(obj) {
                    var base_cube = new Cube(obj)

                    base_cube.addTo(group).init()
                    selected.push(elements[elements.length-1])
                })
                updateSelection()
                setUndo('Pasted Cubes')
            }
        }
    },
    setTexture: function(texture) {
        //Sets the raw image of the texture
        if (!isApp) return;

        if (texture.mode === 'bitmap') {
            var img = nativeImage.createFromDataURL(texture.iconpath)
        } else {
            var img = nativeImage.createFromPath(texture.iconpath.split('?')[0])
        }
        clipboard.writeImage(img)
    },
    setGroup: function(group) {
        if (!group) {
            clipbench.group = undefined
            return;
        }
        clipbench.group = group.duplicate('cache')
        if (isApp) {
            clipboard.writeHTML(JSON.stringify({type: 'group', content: clipbench.group}))
        }
    },
    setCubes: function(cubes) {
        if (!cubes) {
            clipbench.cubes = []
            return;
        }
        cubes.forEach(function(obj) {
            var base_cube = new Cube(obj)
            base_cube.display.mesh = undefined;
            clipbench.cubes.push(base_cube)
        })
        if (isApp) {
            clipboard.writeHtml(JSON.stringify({type: 'cubes', content: clipbench.cubes}))
        }
    }
}
TextureAnimator = {
    isPlaying: false,
    interval: false,
    start: function() {
        clearInterval(TextureAnimator.interval)
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
            Canvas.updateUV(elements[i], true)
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
            Canvas.updateUV(elements[i], true)
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
var Vertexsnap = {
    step1: true,
    vertexes: new THREE.Object3D(),
    vertexed_cubes: [],
    hovering: false,
    addVertexes: function(cube) {
        if (Vertexsnap.vertexed_cubes.includes(cube)) return;
        if (cube.display.visibility === false) return;

        canvas1.removeEventListener("mousemove", Vertexsnap.hoverCanvas)
        canvas1.addEventListener("mousemove", Vertexsnap.hoverCanvas)

        var o_vertices = cube.display.mesh.geometry.vertices
        cube.display.mesh.updateMatrixWorld()
        o_vertices.forEach(function(v, id) {
            var outline_color = '0x'+app_colors.accent.hex.replace('#', '')
            var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: parseInt(outline_color)}))
            var pos = mesh.position.copy(v)
            pos.applyMatrix4(cube.display.mesh.matrixWorld)
            pos.addScalar(8)
            mesh.rotation.copy(cube.display.mesh.rotation)
            mesh.cube = cube
            mesh.isVertex = true
            mesh.vertex_id = id
            Vertexsnap.vertexes.add(mesh)
        })
        Vertexsnap.vertexed_cubes.push(cube)
        controls.updateSceneScale()
    },
    removeVertexes: function() {
        var i = Vertexsnap.vertexes.children.length
        while (i >= 0) {
            Vertexsnap.vertexes.remove(Vertexsnap.vertexes.children[i])
            i--;
        }
        Vertexsnap.vertexed_cubes = []
        canvas1.removeEventListener("mousemove", Vertexsnap.hoverCanvas)
    },
    hoverCanvas: function(event) {
        if (Vertexsnap.hovering) {
            Vertexsnap.vertexes.children.forEach(function(v) {
                if (v.type === 'Line') {
                    Vertexsnap.vertexes.remove(v)
                } else {
                    v.material.color.set(parseInt('0x'+app_colors.accent.hex.replace('#', '')))
                }
            })
        }
        let data = Canvas.raycast()
        if (!data || !data.vertex) return;
        var vertex = data.vertex
        vertex.material.color.g = 1
        Vertexsnap.hovering = true

        if (Vertexsnap.step1 === false) {
            var color = '0x'+app_colors.accent.hex.replace('#', '')
            var geometry = new THREE.Geometry();
            geometry.vertices.push(Vertexsnap.vertex_pos);
            geometry.vertices.push(vertex.position);
            var line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: parseInt(color) }));
            line.renderOrder = 900
            line.material.depthTest = false
            Vertexsnap.vertexes.add(line)
        }
    },
    select: function() {
        Vertexsnap.removeVertexes()
        selected.forEach(function(obj) {
            Vertexsnap.addVertexes(obj)
        })
        if (selected.length) {
            $(canvas1).css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
        }
    },
    canvasClick: function(data) {
        if (!data.vertex) return;

        if (Vertexsnap.step1) {
            Vertexsnap.step1 = false
            Vertexsnap.vertex_pos = data.vertex.position
            Vertexsnap.vertex_id = data.vertex.vertex_id
            Vertexsnap.cubes = selected.slice()
            Vertexsnap.removeVertexes()
            $(canvas1).css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
        } else {
            Vertexsnap.snap(data)
            $(canvas1).css('cursor', (Vertexsnap.step1 ? 'copy' : 'alias'))
        }
    },
    snap: function(data) {
        var pos = data.vertex.position
        pos.sub(Vertexsnap.vertex_pos)

        if ($('select#vertex_scale option:selected').attr('id') === 'scale') {
            //Scale

            var m;
            switch (Vertexsnap.vertex_id) {
                case 0: m=[ 1,1,1 ]; break;
                case 1: m=[ 1,1,0 ]; break;
                case 2: m=[ 1,0,1 ]; break;
                case 3: m=[ 1,0,0 ]; break;
                case 4: m=[ 0,1,0 ]; break;
                case 5: m=[ 0,1,1 ]; break;
                case 6: m=[ 0,0,0 ]; break;
                case 7: m=[ 0,0,1 ]; break;
            }

            Vertexsnap.cubes.forEach(function(obj) {
                var cube_pos = new THREE.Vector3().copy(pos).removeEuler(Vertexsnap.cubes[0].display.mesh.rotation)
                for (i=0; i<3; i++) {
                    if (m[i] === 1) {
                        obj.to[i] += cube_pos.getComponent(i)
                    } else {
                        obj.from[i] += cube_pos.getComponent(i)
                    }
                }
            })
        } else {
            Vertexsnap.cubes.forEach(function(obj) {
                var cube_pos = new THREE.Vector3().copy(pos)
                if (Blockbench.entity_mode === false) {
                    if (obj.rotation) {
                        obj.rotation.origin[0] += cube_pos.getComponent(0)
                        obj.rotation.origin[1] += cube_pos.getComponent(1)
                        obj.rotation.origin[2] += cube_pos.getComponent(2)
                    }
                } else {
                    cube_pos.removeEuler(Vertexsnap.cubes[0].display.mesh.rotation)
                }
                obj.from[0] += cube_pos.getComponent(0)
                obj.from[1] += cube_pos.getComponent(1)
                obj.from[2] += cube_pos.getComponent(2)
                obj.to[0] += cube_pos.getComponent(0)
                obj.to[1] += cube_pos.getComponent(1)
                obj.to[2] += cube_pos.getComponent(2)
            })
        }

        Vertexsnap.removeVertexes()
        Canvas.updateAllPositions()
        setUndo('Vertex Snap')
        Vertexsnap.step1 = true
    }
}