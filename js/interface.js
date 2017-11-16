var app_colors, canvas_scenes, active_scene;
scenesSetup()

function colorSettingsSetup(reset) {
    app_colors = {
        back: {hex: '#21252b'},
        dark: {hex: '#17191d'},
        border: {hex: '#181a1f'},
        ui: {hex: '#282c34'},
        accent: {hex: '#3e90ff'},
        grid: {hex: '#495061'},
        button: {hex: '#3a3f4b'},
        hover: {hex: '#495061'},
        text: {hex: '#cacad4'},
        light: {hex: '#f4f3ff'},
        text_acc: {hex: '#000006'},
        main: {font: ''},
        headline: {font: ''},
        css: ''
    }
    if (reset) {
        $('#layout_font_main').val('')
        $('#layout_font_headline').val('')
        changeUIFont('main')
        changeUIFont('headline')
        $('style#bbstyle').text('')
        setScreenRatio()
    }
    if (localStorage.getItem('app_colors') != null && reset != true) {
        var stored_app_colors = JSON.parse(localStorage.getItem('app_colors'))
        $.extend(app_colors, stored_app_colors)
    }
    updateUIColor()
    buildGrid()
}

function showDialog(dialog) {
    var obj = $('.dialog#'+dialog)
    $('.dialog').hide(0)
    $('#blackout').fadeIn(200)
    obj.fadeIn(200)
    setTimeout(function() {
        $('.context_handler.ctx').removeClass('ctx')
    }, 64)
    open_dialog = dialog
    //Draggable
    if (obj.hasClass('draggable')) {
        obj.draggable({
            handle: ".dialog_handle",
            containment: 'body'
        })
        var x = ($(window).width()-obj.width())/2
        obj.css('left', x+'px')
        obj.css('top', '64px')
    }

    //Specific
    if (dialog === 'file_loader') {
        $('#file_upload').val('')
        $('#file_folder').val('')
        $('#web_import_btn').unbind()
    } else if (dialog === 'selection_creator') {
        $('#selection_creator input#selgen_name').select()
    } else if (dialog === 'plugins') {
        $('#plugin_list').css('max-height', ($(window).height() - 320) +'px')
    }
}
function hideDialog() {
    $('#blackout').fadeOut(200)
    $('.dialog').fadeOut(200)
    open_dialog = false;
}
function setSettingsTab(tab) {
    $('#settings .tab.open').removeClass('open')
    $('#settings .tab#'+tab).addClass('open')
    $('#settings .tab_content').addClass('hidden')
    $('#settings .tab_content#'+tab).removeClass('hidden')
    if (tab === 'keybindings') {
        //Keybinds
        $('#keybindlist').css('max-height', ($(window).height() - 320) +'px')
    } else if (tab === 'setting') {
        //Settings
        $('#settingslist').css('max-height', ($(window).height() - 320) +'px')
    } else if (tab === 'layout_settings') {
        $('#layout_font_main').val(app_colors.main.font)
        $('#layout_font_headline').val(app_colors.headline.font)
    }
}
function textPrompt(title, var_string, value, callback) {
    showDialog('text_input')
    $('#text_input h2').text(title)
    if (value === true) {
        //Get Previous Value For Input
        eval('value = '+var_string)
        try {
            eval('value = '+var_string)
        } catch(err) {
            console.error(err)
        }
    }
    $('#text_input input#text_input_field').val(value).select()
    $('#text_input button.confirm_btn').off()
    $('#text_input button.confirm_btn').click(function() {
        var s = $('#text_input input#text_input_field').val()
        if (callback !== undefined) {
            callback(s)
        }
        if (var_string == '') return;
        try {
            eval(var_string + ' = "'+s+'"')
        } catch(err) {
            console.error(err)
        }
    })
    // textPrompt('Texture Name', 'textures[0].name')
}
function renameCubeList(name) {
    selected.forEach(function(s, i) {
        elements[s].name = name.split('%').join(s).split('$').join(i)
    })
}
function randomHelpMessage() {
    var tips = [
        'Go to the Settings menu and select the Keybindings tab to change your keys.',
        'Blockbench works as a Program on Windows, macOS and Linux, or as a web app on any device, including tablets.',
        'Double click in the canvas or hit spacebar to toggle between the scale and the drag tool.',
        'Create groups to manage different parts of your model.',
        'Open the Display tab in the top right corner to change how the model looks in your hands.',
        'Only open textures that are in your resource pack.',
        'Use Fizzy81\'s animation generator to create animated models.',
        'Use blockmodels.com or sketchfab.com to share your models.',
        'Press Ctrl + P to take a screenshot, press Ctrl + V to paste it into a Discord chat or a tweet.',
        'Hold Shift or Ctrl to select multiple cubes',
        'Join the Discord server to ask for help: discord.blockbench.net',
        'You can load a blueprint of your model to make it easier to get the proportions right. Enter a side view and drag the image into the background. Use the menu on the bottom right to adjust it.',
        'There are many useful plugins by the community in the plugin menu. Just click install and go.',
        'Keep Blockbench updated. Updates add new functions to Blockbench, fix bugs and installing them is as easy opening the updates screen from the File menu and clicking the Update button',
        'Check the Move Relative box in the Edit menu to move cubes on their rotated axis.'
    ]
    var message = tips[Math.floor(Math.random()*tips.length)]
    Blockbench.showMessageBox({
        width: 640,
        title: 'Tip',
        icon: 'info',
        message: message,
        cancel: 1,
        confirm: 0,
        buttons: ['Next', 'Close']
    }, function(answer) {
        if (answer === 0) {
            randomHelpMessage()
        }
    })
}

//Scenes
function enterScene(scene) {
    var container = $('div#preview')
    var scene_controls = $('#scene_controls')
    if (scene !== true) {
        active_scene = canvas_scenes[scene]
    } else {
    }
    if (active_scene.background.image !== false) {

        //Background
        container.css('background-image', 'url("'+active_scene.background.image.split('\\').join('/')+'")')
        updateScenePosition()

        //Panel
        scene_controls.fadeIn(100)
        $('#scene_controls_panel').hide(0)
        scene_controls.find('img').attr('src', active_scene.background.image)
        scene_controls.find('#scene_controls_toggle i').text('first_page')

        if (active_scene.background.lock === 'disabled') {
            scene_controls.find('.scene_lock').hide()
        } else {
            scene_controls.find('.scene_lock').show()
        }

    } else {
        container.css('background-image', 'none')
        scene_controls.fadeOut(100)
    }
}
function clearBackgroundImage() {
    active_scene.background.image = false;
    enterScene(true)
}
function updateScenePosition(zoom) {
    if (zoom === undefined) zoom = 1
    if (isOrtho === true && active_scene.background.lock === false) zoom = cameraOrtho.zoom
    if (active_scene.background.lock === true) zoom = 1

    var offset = [0, 0];

    if (isOrtho === true && active_scene.background.lock !== true) {

        offset.forEach(function(s, i) {
            s = cameraOrtho.backgroundHandle[i].n === true ? 1 : -1
            s = s * controls.target[cameraOrtho.backgroundHandle[i].a]
            s = s * zoom * 40;
            offset[i] = s
        })
    }

    var pos_x = offset[0] + (active_scene.background.x * zoom) + c_width/2 - (active_scene.background.size * zoom) / 2
    var pos_y = offset[1] + (active_scene.background.y * zoom) + c_height/2 - ((active_scene.background.size / active_scene.background.ratio) * zoom) / 2

    $('div#preview').css('background-position', pos_x + 'px ' + pos_y+'px')
                    .css('background-size',  active_scene.background.size * zoom +'px')

}
function updateBackgroundRatio() {
    //Update Ratio
    var img = $('#scene_controls img')[0]
    active_scene.background.ratio = img.naturalWidth / img.naturalHeight
    updateScenePosition()
}
function toggleScenePanel() {
    var scene_controls = $('#scene_controls')
    if (scene_controls.find('#scene_controls_panel').is(':visible')) {
        //Hide
        scene_controls.find('#scene_controls_panel').hide(200)
        scene_controls.find('#scene_controls_toggle i').text('first_page')
    } else {
        //Show
        scene_controls.find('#scene_controls_panel').show(200)
        scene_controls.find('#scene_controls_toggle i').text('last_page')

        scene_controls.find('input#scene_size').val(active_scene.background.size)
        scene_controls.find('input#scene_x').val(active_scene.background.x)
        scene_controls.find('input#scene_y').val(active_scene.background.y)
        scene_controls.find('input#scene_fixed').prop('checked', active_scene.background.y === true)
    }
}
function updateScenePanelControls() {
    var scene_controls = $('#scene_controls')
    active_scene.background.size = limitNumber(parseInt( scene_controls.find('input#scene_size').val()) )
    active_scene.background.x    = limitNumber(parseInt( scene_controls.find('input#scene_x').val()) )
    active_scene.background.y    = limitNumber(parseInt( scene_controls.find('input#scene_y').val()) )
    active_scene.background.lock = scene_controls.find('input#scene_fixed').is(':checked')
    updateScenePosition()
}

function scenesSetup(reset) {
    canvas_scenes = {
        normal: {name: 'Normal', background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},
        ortho0: {name: 'Ortho 0', background: {image: false, size: 1000, x: 0, y: 0}},
        ortho1: {name: 'Ortho 1', background: {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: false}},
        ortho2: {name: 'Ortho 2', background: {image: false, size: 1200, x: 0, y: 0, ratio: 1, lock: false}},
        ortho3: {name: 'Ortho 3', background: {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: false}},
        ortho4: {name: 'Ortho 4', background: {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: false}},
        ortho5: {name: 'Ortho 5', background: {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: false}},

        thirdperson_righthand: {name: 'thirdperson_righthand', background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},
        thirdperson_lefthand:  {name: 'thirdperson_lefthand',  background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},
        firstperson_righthand: {name: 'firstperson_righthand', background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},
        firstperson_lefthand:  {name: 'firstperson_lefthand',  background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},

        head:   {name: 'head',   background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},
        ground: {name: 'ground', background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},
        fixed:  {name: 'fixed',  background:  {image: false, size: 1000, x: 0, y: 0, ratio: 1, lock: 'disabled'}},
        gui:    {name: 'gui',    background:  {image: './assets/inventory.png', size: 1020, x: 0, y: 0, ratio: 1, lock: false}}
    }
    if (localStorage.getItem('canvas_scenes') != null && reset != true) {
        var stored_canvas_scenes = JSON.parse(localStorage.getItem('canvas_scenes'))
        $.extend(canvas_scenes, stored_canvas_scenes)
    }
    active_scene = canvas_scenes.normal
}


//Color
function initUIColor(event) {
    var type = $(event.target).attr('id').split('color_')[1]
    $('input#color_'+type).val(app_colors[type].hex)
}
function changeUIColor(event) {
    var type = $(event.target).attr('id').split('color_')[1]

    app_colors[type].hex = $('input#color_'+type).val()
    updateUIColor()
}
function changeUIFont(type) {
    var font = $('#layout_font_'+type).val()
    app_colors[type].font = font
    if (type === 'main') {
        $('body').css('font-family', app_colors[type].font)
    } else {
        $('h1, h2, h3, h4, h5').css('font-family', app_colors[type].font)
    }
}
function updateUIColor() {
    for (var type in app_colors) {
        if (app_colors.hasOwnProperty(type)) {
            if (type === 'css') {
                $('style#bbstyle').text(app_colors.css)
            } else if (app_colors[type].hex) {
                document.body.style.setProperty('--color-'+type, app_colors[type].hex);
            } else if (app_colors[type].font) {
                if (type === 'main') {
                    $('body').css('font-family', app_colors[type].font)
                } else {
                    $('h1, h2, h3, h4, h5').css('font-family', app_colors[type].font)
                }
            }
        }
    }
    var grid_color = '0x'+app_colors.hover.hex.replace('#', '')

    try {
        three_grid.getObjectByName('grid').material.color = new THREE.Color(parseInt(grid_color, 16))
    } catch(err) {}

    localStorage.setItem('app_colors', JSON.stringify(app_colors))
}

function importLayout() {
    Blockbench.import('bbstyle', function(content) {
        applyBBStyle(content)
    })
}
function applyBBStyle(data) {
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data)

        } catch(err) {
            console.log(err)
            return;
        }
    }
    if (typeof data !== 'object') return;
    $.extend(app_colors, data)
    if (data.css) {
        $('style#bbstyle').text(data.css)
        setScreenRatio()
    }
    updateUIColor()
}
function exportLayout() {
    Blockbench.export(autoStringify(app_colors), 'layout', 'bbstyle')
}

function showQuickMessage(message, time) {
    var quick_message_box = $('<div id="quick_message_box" class="hidden"></div>') 
    $('body').append(quick_message_box)
    
    quick_message_box.text(message)
    quick_message_box.fadeIn(100)
    setTimeout(function() {
        quick_message_box.fadeOut(100)
        setTimeout(function() {
            quick_message_box.remove()
        }, 100)
    }, time ? time : 1000)
}
function showStatusMessage(message, time) {           //Shows a quick message in the status bar
    var status_message = $('#status_message')
    var status_name    = $('#status_name')

    status_message.text(message)

    status_name.hide(100)
    status_message.show(100)

    setTimeout(function() {
        status_message.hide(100)
        status_name.show(100)
    }, time ? time : 600)
}
function setProgressBar(id, val, time) {
    $('#'+id+' > .progress_bar_inner').animate({width: val*488}, time-1)
}

//Tooltip

function showShiftTooltip() {
    $(':hover').find('.tooltip_shift').css('display', 'inline')
}
$(document).keyup(function(event) {
    if (event.which === 16) {
        $('.tooltip_shift').hide()
    }
})
/*
function updateCubeList() {
    Vue.nextTick(function() {
        $('.cube_context').on('click', function(event) {
            var ul = $(this).find('ul')
            var pos = $(window).height() - event.clientY
            if (pos < 110) {
                ul.css('top', '-120px');
            } else {
                ul.css('top', '24px');
            }
        })
    })
}*/

function setInterfaceMode(mode) {
    $('.mode_tab').removeClass('open')
    $('.mode_tab#mode_'+mode+'_tab').addClass('open')
    setScreenRatio()
}

//Menu
function updateMenu() {
    //Settings Dependent
    $('header .settings_dependent').each(function(i, o) {
        var set = $(o).attr('setting')
        if (settings[set] && settings[set].value === true) {
            $(o).text('check_box')
        } else {
            $(o).text('check_box_outline_blank')
        }
    })
}




//Mobile
function setMobileTab(mode) {
    $('.mobile_mode_tab').removeClass('open')
    $('#mobile_tab_'+mode).addClass('open')
    //
    $('.sidebar').css('grid-area', '')
    $('#preview').css('grid-area', '')
    $('header').css('grid-area', '')
    switch (mode) {
        case 'preview':
            $('#preview').css('grid-area', 'main')
            break;
        case 'textures':
            $('#left_bar').css('grid-area', 'main')
            break;
        case 'elements':
            $('#right_bar').css('grid-area', 'main')
            break;
        case 'menu':
            $('header').css('grid-area', 'main')
            break;
    }
    setScreenRatio()
}