var keybinds, settings, display_presets;

var Project = new Object()
projectTagSetup()
keybindSetup()
settingSetup()
displayPresetsSetup()

$(document).keydown(function(e) {
    holding_shift = e.shiftKey;
});

$(document).keyup(function(e) {
    holding_shift = false;
});
//Setup
function keybindSetup(get) {
    var obj = {
        headline1:    {is_title: true, title: "Misc"}, 
        canvas_rotate: {shift: false, ctrl: false, alt: false, code: 1, name: 'Rotate View', char: 'Left-Click', update: true},
        canvas_drag:{shift: false, ctrl: false, alt: false, code: 3, name: 'Drag View', char: 'Right-Click', update: true},
        confirm:    {shift: false, ctrl: false, alt: false, code: 13, name: 'Confirm', char: 'ENTER'},
        cancel:     {shift: false, ctrl: false, alt: false, code: 27, name: 'Cancel', char: 'ESCAPE'},
        screenshot_clean:{shift: false, ctrl: true, alt: false, code: 80, name: 'Screenshot', char: 'Ctrl + P'},
        plugin_reload:{shift: false, ctrl: true, alt: false, code: 74, name: 'Reload Dev Plugins', char: 'Ctrl + J'},

        headline2:  {is_title: true, title: "File"}, 
        open_file:  {shift: false, ctrl: true, alt: false, code: 79, name: 'Open File', char: 'Ctrl + O'},
        save:       {shift: false, ctrl: true, alt: false, code: 83, name: 'Save', char: 'Ctrl + S'},
        save_as:    {shift: true,  ctrl: true, alt: false, code: 83, name: 'Save As', char: 'Ctrl + Shift + S'},
        open_texture: {shift: false, ctrl: true, alt: false, code: 84, name: 'Import Texture', char: 'Ctrl + T'},
        toggle_mode:{shift: false, ctrl: true, alt: false, code: 9, name: 'Toggle Mode', char: 'Ctrl + TAB'},
        settings:   {shift: false, ctrl: true, alt: false, code: 69, name: 'Settings', char: 'Ctrl + E'},

        headline3:  {is_title: true, title: "Edit"}, 
        undo:       {shift: false, ctrl: true, alt: false, code: 90, name: 'Undo', char: 'Ctrl + Z'},
        redo:       {shift: false, ctrl: true, alt: false, code: 89, name: 'Redo', char: 'Ctrl + Y'},
        create_selection:{shift: false, ctrl: true, alt: false, code: 70, name: 'Create Selection', char: 'Ctrl + F'},
        select_all: {shift: false, ctrl: true, alt: false, code: 65, name: 'Select All', char: 'Ctrl + A'},
        invert_select:{shift:false,ctrl: true, alt: false, code: 65, name: 'Select All', char: 'Ctrl + A'},
        add_cube:   {shift: false, ctrl: true, alt: false, code: 78, name: 'Add Cube', char: 'Ctrl + N'},
        new_group:  {shift: false, ctrl: true, alt: false, code: 71, name: 'Add Group', char: 'Ctrl + G'},
        duplicate:  {shift: false, ctrl: true, alt: false, code: 68, name: 'Duplicate Cube', char: 'Ctrl + D'},
        delete:     {shift: false, ctrl: false, alt: false,code: 46, name: 'Delete Selected', char: 'DELETE'},
        rename:     {shift: false, ctrl: false, alt: false,code: 113,name: 'Rename', char: 'F2'},

        headline4:  {is_title: true, title: "Textures"}, 
        uv_copy:    {shift: false, ctrl: true, alt: false, code: 67, name: 'Copy UV', char: 'Ctrl + C'},
        uv_copy_all:{shift: true,  ctrl: true, alt: false, code: 67, name: 'Copy UV All', char: 'Ctrl + Shift + C'},
        uv_paste:   {shift: false, ctrl: true, alt: false, code: 86, name: 'Paste UV', char: 'Ctrl + V'},
        uv_paste_all:{shift: true, ctrl: true, alt: false, code: 86, name: 'Paste UV All', char: 'Ctrl + Shift + V'},

        headline5:  {is_title: true, title: "Display Mode"}, 
        copy_disp:  {shift: false, ctrl: true, alt: false, code: 67, name: 'Copy Display Settings', char: 'Ctrl + C'},
        paste_disp: {shift: false, ctrl: true, alt: false, code: 86, name: 'Paste Display Settings', char: 'Ctrl + V'},
        reload_tex: {shift: false, ctrl: true, alt: false, code: 82, name: 'Reload Textures', char: 'Ctrl + R'},

        headline6:     {is_title: true, title: "Tool"}, 
        tool_translate:{shift: false, ctrl: false, alt: false, code: 86, name: 'Move Tool', char: 'V'},
        tool_scale:    {shift: false, ctrl: false, alt: false, code: 83, name: 'Scale Tool', char: 'S'},
        tool_brush:    {shift: false, ctrl: false, alt: false, code: 66, name: 'Brush', char: 'B'},
        tool_swap:    {shift: false, ctrl: false, alt: false, code: 32, name: 'Swap Move and Scale', char: 'SPACE'},

        headline7:  {is_title: true, title: "Movement"}, 
        move_north: {shift: false, ctrl: false, alt: false, code: 38, name: 'Move South', char: 'ARROWUP'},
        move_south: {shift: false, ctrl: false, alt: false, code: 40, name: 'Move North', char: 'ARROWDOWN'},
        move_west:  {shift: false, ctrl: false, alt: false, code: 37, name: 'Move West', char: 'ARROWLEFT'},
        move_east:  {shift: false, ctrl: false, alt: false, code: 39, name: 'Move East', char: 'ARROWRIGHT'},
        move_up:    {shift: false, ctrl: false, alt: false, code: 33, name: 'Move Up', char: 'PAGEUP'},
        move_down:  {shift: false, ctrl: false, alt: false, code: 34, name: 'Move Down', char: 'PAGEDOWN'},

        headline8:   {is_title: true, title: "View"}, 
        wireframe:   {shift: false, ctrl: false, alt: false, code: 90,  name: 'Toggle Wireframe', char: 'Z'},
        reset_view:  {shift: false, ctrl: false, alt: false, code: 96,  name: 'Reset View', char: 'NUMPAD 0'},
        view_normal: {shift: false, ctrl: false, alt: false, code: 101, name: 'Normal View', char: 'NUMPAD 5'},
        view_0:      {shift: false, ctrl: false, alt: false, code: 104, name: 'Top View', char: 'NUMPAD 8'},
        view_1:      {shift: false, ctrl: false, alt: false, code: 98,  name: 'Bottom View', char: 'NUMPAD 2'},
        view_2:      {shift: false, ctrl: false, alt: false, code: 100, name: 'South View', char: 'NUMPAD 4'},
        view_3:      {shift: false, ctrl: false, alt: false, code: 102, name: 'North View', char: 'NUMPAD 6'},
        view_4:      {shift: false, ctrl: false, alt: false, code: 103, name: 'East View', char: 'NUMPAD 7'},
        view_5:      {shift: false, ctrl: false, alt: false, code: 105, name: 'West View', char: 'NUMPAD 9'}
    }
    if (get !== true) {
        keybinds = obj
        if (localStorage.getItem('keybinds') != null) {
            var stored_keys = JSON.parse(localStorage.getItem('keybinds'))
            for (var key in stored_keys) {
                if (stored_keys.hasOwnProperty(key) && !stored_keys[key].is_title && keybinds.hasOwnProperty(key)) {
                    keybinds[key].shift = stored_keys[key].shift
                    keybinds[key].ctrl = stored_keys[key].ctrl
                    keybinds[key].alt = stored_keys[key].alt
                    keybinds[key].code = stored_keys[key].code
                    keybinds[key].char = stored_keys[key].char
                }
            }
        }
    } else {
        return obj;
    }
}
function settingSetup() {
    settings = {
        //Preview
        headline2:    {is_title: true, title: "Preview"}, 
        origin:       {value: true,  name: 'Rotation Origin', desc: 'Show object origin'},
        control_size: {value: 10, is_number: true, name: 'Axis Control Size', desc: 'Size of the 3 axis control tool'},
        shading:      {value: true,  name: 'Shading', desc: 'Enable shading'},
        transparency: {value: true,  name: 'Transparency', desc: 'Render transparent textures transparent'},
        texture_fps:  {value: 2, is_number: true, name: 'Animated Texture FPS', desc: 'Frames per second for animated textures'},
        status_bar:   {value: true,  name: 'Status Bar', desc: 'Show the status bar that displays fps etc.'},
        swap_sidebar: {value: false, name: 'Swap Sidebars', desc: 'Swaps the right and the left sidebar'},
        //Grid
        headline1:    {is_title: true, title: "Grid"}, 
        base_grid:    {value: true,  name: 'Small Grid', desc: 'Show small grid and axes'},
        large_grid:   {value: false, name: 'Large Grid', desc: 'Show 3x3 block grid'},
        full_grid:    {value: false, name: 'Full Large Grid', desc: 'Show 3x3 precise grid'},
        large_box:    {value: false, name: 'Large Box', desc: 'Show 3x3 block boundaries'},
        display_grid: {value: true, name: 'Display Mode', desc: 'Show grid in display mode'},
        //Edit
        headline3:    {is_title: true, title: "Edit"}, 
        entity_mode:  {value: false, name: 'Entity Model Mode', desc: 'Unrestricted editing mode for Bedrock and Optifine models'},
        undo_limit:   {value: 20, is_number: true, name: 'Undo Limit', desc: 'Number of steps you can undo'},
        restricted_canvas:{value: true, name: 'Restricted Canvas', desc: 'Move rotated elements on their own axes if possible'},
        move_origin:  {value: false, name: 'Move on Relative Axes', desc: 'Move rotated elements on their own axes if possible'},
        autouv:       {value: true,  name: 'Auto UV', desc: 'Enable AutoUV by default'},
        create_rename:{value: false, name: 'Rename new Cube', desc: 'Focus name field when creating new element or group'},
        canvas_unselect:{value: false, name: 'Canvas Click Unselect', desc: 'Unselects all elements when clicking on the canvas background'},
        show_actions: {value: false, name: 'Tell Actions', desc: 'Display every action in the status bar'},
        //Snapping
        headline4:    {is_title: true, title: "Snapping"},
        edit_size:    {value: 16, is_number: true, name: 'Grid Resolution', desc: 'Resolution of the grid that cubes snap to'},
        shift_size:   {value: 64, is_number: true, name: 'Shift Resolution', desc: 'Resolution of the grid while holding shift'},
        ctrl_size:    {value: 160, is_number: true, name: 'Control Resolution', desc: 'Resolution of the grid while holding control'},
        //rotation_snap:{value: true, name: 'Rotation Snap', desc: 'Snap Rotations to 22.5° (limit of the Minecraft model format)'},
        snapnslide:   {value: false, name: 'Snap Slider', desc: 'Snaps combo-sliders to their valid positions'},
        //Export
        headline5:    {is_title: true, title: "Export"}, 
        minifiedout:  {value: false,name: 'Minified Export', desc: 'Write JSON file in one line'},
        max_json_length:{value: 56, is_number: true, name: 'Maximum Line Length', desc: 'Break JSON lines after this number'},
        round_digits: {value: 4, is_number: true, name: 'Round numbers', desc: 'Round numbers'},
        export_groups:{value: true, name: 'Export Groups', desc: 'Save groups in blockmodel files'},
        obj_textures: {value: true,  name: 'Export Textures', desc: 'Export textures when exporting OBJ file'},
        comment:      {value: true,  name: 'File Comment', desc: 'Add a credit comment to file'},
        comment_text: {value: 'Made with Blockbench, a free, modern block model editor by JannisX11', is_string: true},
        default_path: {value: false, hidden: true}
    }
    if (localStorage.getItem('settings') != null) {
        var stored_settings = JSON.parse(localStorage.getItem('settings'))
        for (var key in stored_settings) {
            if (stored_settings.hasOwnProperty(key) && !stored_settings[key].is_title && settings.hasOwnProperty(key)) {
                settings[key].value = stored_settings[key].value
            }
        }
        if (settings.edit_size.value < 3) {
            settings.edit_size.value = 16
        }
    }
}
function projectTagSetup() {
    Project.name              = "";
    Project.parent            = "";
    Project.description       = "";
    Project.texture_width     = 64;
    Project.texture_height    = 64;
    Project.ambientocclusion  = true;
}
function displayPresetsSetup() {
    display_presets = [
        {name: 'Vanilla Item', fixed: true, areas: {
            ground: {
                rotation: [ 0, 0, 0 ],
                translation: [ 0, 2, 0],
                scale:[ 0.5, 0.5, 0.5 ]
            },
            head: {
                rotation: [ 0, 180, 0 ],
                translation: [ 0, 13, 7],
                scale:[ 1, 1, 1]
            },
            thirdperson_righthand: {
                rotation: [ 0, 0, 0 ],
                translation: [ 0, 3, 1 ],
                scale: [ 0.55, 0.55, 0.55 ]
            },
            thirdperson_lefthand: {
                rotation: [ 0, 0, 0 ],
                translation: [ 0, 3, 1 ],
                scale: [ 0.55, 0.55, 0.55 ]
            },
            firstperson_righthand: {
                rotation: [ 0, -90, 25 ],
                translation: [ 1.13, 3.2, 1.13],
                scale: [ 0.68, 0.68, 0.68 ]
            },
            firstperson_lefthand: {
                rotation: [ 0, -90, 25 ],
                translation: [ 1.13, 3.2, 1.13],
                scale: [ 0.68, 0.68, 0.68 ]
            },
            fixed: {
                rotation: [ 0, 180, 0 ],
                translation: [ 0, 0, 0 ],
                scale: [ 1, 1, 1 ],
            }
        }
        },
        {name: 'Vanilla Block', fixed: true, areas: {
            gui: {
                rotation: [ 30, 225, 0 ],
                translation: [ 0, 0, 0],
                scale:[ 0.625, 0.625, 0.625 ]
            },
            ground: {
                rotation: [ 0, 0, 0 ],
                translation: [ 0, 3, 0],
                scale:[ 0.25, 0.25, 0.25 ]
            },
            fixed: {
                rotation: [ 0, 0, 0 ],
                translation: [ 0, 0, 0],
                scale:[ 0.5, 0.5, 0.5 ]
            },
            thirdperson_righthand: {
                rotation: [ 75, 45, 0 ],
                translation: [ 0, 2.5, 0],
                scale: [ 0.375, 0.375, 0.375 ]
            },
            thirdperson_lefthand: {
                rotation: [ 75, 45, 0 ],
                translation: [ 0, 2.5, 0],
                scale: [ 0.375, 0.375, 0.375 ]
            },
            firstperson_righthand: {
                rotation: [ 0, 45, 0 ],
                translation: [ 0, 0, 0 ],
                scale: [ 0.40, 0.40, 0.40 ]
            },
            firstperson_lefthand: {
                rotation: [ 0, 225, 0 ],
                translation: [ 0, 0, 0 ],
                scale: [ 0.40, 0.40, 0.40 ]
            }
        }
        },
        {name: 'Vanilla Handheld', fixed: true, areas: {
            thirdperson_righthand: {
                rotation: [ 0, -90, 55 ],
                translation: [ 0, 4.0, 0.5 ],
                scale: [ 0.85, 0.85, 0.85 ]
            },
            thirdperson_lefthand: {
                rotation: [ 0, 90, -55 ],
                translation: [ 0, 4.0, 0.5 ],
                scale: [ 0.85, 0.85, 0.85 ]
            },
            firstperson_righthand: {
                rotation: [ 0, -90, 25 ],
                translation: [ 1.13, 3.2, 1.13 ],
                scale: [ 0.68, 0.68, 0.68 ]
            },
            firstperson_lefthand: {
                rotation: [ 0, 90, -25 ],
                translation: [ 1.13, 3.2, 1.13 ],
                scale: [ 0.68, 0.68, 0.68 ]
            }
        }
        },
        {name: 'Vanilla Handheld Rod', fixed: true, areas: {
            thirdperson_righthand: {
                rotation: [ 0, 90, 55 ],
                translation: [ 0, 4.0, 2.5 ],
                scale: [ 0.85, 0.85, 0.85 ]
            },
            thirdperson_lefthand: {
                rotation: [ 0, -90, -55 ],
                translation: [ 0, 4.0, 2.5 ],
                scale: [ 0.85, 0.85, 0.85 ]
            },
            firstperson_righthand: {
                rotation: [ 0, 90, 25 ],
                translation: [ 0, 1.6, 0.8 ],
                scale: [ 0.68, 0.68, 0.68 ]
            },
            firstperson_lefthand: {
                rotation: [ 0, -90, -25 ],
                translation: [ 0, 1.6, 0.8 ],
                scale: [ 0.68, 0.68, 0.68 ]
            }
        }
        }
    ]
    if (localStorage.getItem('display_presets') != null) {
        var stored_display_presets = JSON.parse(localStorage.getItem('display_presets'))
        $.extend(display_presets, stored_display_presets)
    }
}
$(document).keydown(function(e) {
    if (e.which === 16) {
        showShiftTooltip()
    }
    if (e.ctrlKey === true && e.which == 73 && isApp) {
        app.getCurrentWindow().toggleDevTools()
    }

    if (open_dialog !== false) {
        if (open_dialog === 'uv_dialog') {   
            if (compareKeys(e, keybinds.uv_copy)) {
                uv_dialog.copy(e)
            }
            if (compareKeys(e, keybinds.uv_paste)) {
                uv_dialog.paste(e)
            }
        }
        if (compareKeys(e, keybinds.confirm)) {
            $('.dialog#'+open_dialog).find('.confirm_btn:not([disabled])').click()
        } else if (compareKeys(e, keybinds.cancel) === true) {
            $('.dialog#'+open_dialog).find('.cancel_btn:not([disabled])').click()
        }
        return;
    }
    if (currently_renaming === true) {
        if (compareKeys(e, keybinds.confirm)) {
            stopRenameCubes()
        }
        return;
    }

    if ($('input[type="text"]:focus, input[type="number"]:focus, div[contenteditable="true"]:focus').length > 0) {
        if (compareKeys(e, keybinds.confirm)) {
            $(document).click()
        }
        return;
    }

    if (compareKeys(e, keybinds.screenshot_clean)) {
        Screencam.cleanCanvas()
    }

    if (compareKeys(e, keybinds.open_file)) {
        openFile(true)
    }
    if (compareKeys(e, keybinds.save)) {
        saveFile()
    }
    if (compareKeys(e, keybinds.save_as)) {
        saveFileBlock()
    }
    if (compareKeys(e, keybinds.open_texture)) {
        openTexture()
    }
    if (compareKeys(e, keybinds.toggle_mode)) {
        display_mode ? exitDisplaySettings() : enterDisplaySettings()
    }
    if (compareKeys(e, keybinds.settings)) {
        showDialog('settings');setSettingsTab('setting')
    }
    if (compareKeys(e, keybinds.wireframe)) {
        toggleWireframe()
    }
    if (display_mode === false) {
        //Edit Mode

        if (compareKeys(e, keybinds.undo)) {
            Undo.undo()
        } else if (compareKeys(e, keybinds.redo)) {
            Undo.redo()
        }
        if (compareKeys(e, keybinds.add_cube)) {
            addCube()
        }
        if (compareKeys(e, keybinds.new_group)) {
            addGroup()
        }
        if (compareKeys(e, keybinds.duplicate)) {
            duplicateCubes()
        }
        if (compareKeys(e, keybinds.rename)) {
            renameCubes()
        }
        if (compareKeys(e, keybinds.select_all)) {
            e.preventDefault()
            selectAll()
        }
        if (compareKeys(e, keybinds.delete)) {
            if ($(':focus, .editing').length == 0) {
                deleteCubes()
            }
        }
        if (compareKeys(e, keybinds.reload_tex) === true && isApp) {
            reloadTextures()
        }
        if (compareKeys(e, keybinds.create_selection)) {
            showDialog('selection_creator')
        }
        if (compareKeys(e, keybinds.tool_translate)) {
            setTool('translate')
        } else if (compareKeys(e, keybinds.tool_scale)) {
            setTool('scale')
        } else if (compareKeys(e, keybinds.tool_brush)) {
            setTool('brush')
        } else if (compareKeys(e, keybinds.tool_swap)) {
            toggleTools()
        }


        if (selected.length > 0) {
            //Selected
            if (compareKeys(e, keybinds.uv_copy)) {
                main_uv.copy({shiftKey: false})
            }
            if (compareKeys(e, keybinds.uv_copy_all)) {
                main_uv.copy({shiftKey: true})
            }
            if (compareKeys(e, keybinds.uv_paste)) {
                main_uv.paste({shiftKey: false})
            }
            if (compareKeys(e, keybinds.uv_paste_all)) {
                main_uv.paste({shiftKey: true})
            }
            if (compareKeys(e, keybinds.move_north)) {
                moveCubesRelative(-1, 2)
            }
            if (compareKeys(e, keybinds.move_south)) {
                moveCubesRelative(1, 2)
            }
            if (compareKeys(e, keybinds.move_west)) {
                moveCubesRelative(-1, 0)
            }
            if (compareKeys(e, keybinds.move_east)) {
                moveCubesRelative(1, 0)
            }
            if (compareKeys(e, keybinds.move_up)) {
                moveCubesRelative(-1, 1)
            }
            if (compareKeys(e, keybinds.move_down)) {
                moveCubesRelative(1, 1)
            }
        }

    //View
        if (compareKeys(e, keybinds.view_normal)) {
            setCameraType('pers')
        } else if (compareKeys(e, keybinds.reset_view)) {
            resetCamera()
        //Ortho
        } else if (compareKeys(e, keybinds.view_0)) {
            setCameraType('ortho', 0)
        } else if (compareKeys(e, keybinds.view_1)) {
            setCameraType('ortho', 1)
        } else if (compareKeys(e, keybinds.view_2)) {
            setCameraType('ortho', 2)
        } else if (compareKeys(e, keybinds.view_3)) {
            setCameraType('ortho', 3)
        } else if (compareKeys(e, keybinds.view_4)) {
            setCameraType('ortho', 4)
        } else if (compareKeys(e, keybinds.view_5)) {
            setCameraType('ortho', 5)
        }

    } else if (display_mode === true) {    //Display Mode
        if (compareKeys(e, keybinds.copy_disp)) {
            copyDisplaySlot()
        }
        if (compareKeys(e, keybinds.paste_disp)) {
            pasteDisplaySlot()
        }
    }
})

function saveLocalStorages() {
    localStorage.setItem('canvas_scenes', JSON.stringify(canvas_scenes))
    localStorage.setItem('settings', JSON.stringify(omitKeys(settings, ['name', 'desc'], true)) )
}
function saveSettings() {
    updateMenu()
    for (var mat in Canvas.materials) {
        if (Canvas.materials.hasOwnProperty(mat))
            Canvas.materials[mat].transparent = settings.transparency.value
    }
    setScreenRatio()
    canvasGridSize()
    buildGrid()
    setShading()
    if (settings.snapnslide.value === true) {
        $('.nslide').draggable( "option", "grid", [ 50, 100 ] );
    } else {
        $('.nslide').draggable( "option", "grid", false );
    }
    if (settings.swap_sidebar.value === true) {
        $('body').addClass('rtl')
    } else {
        $('body').removeClass('rtl')
    }
    if (settings.status_bar.value) {
        $('body').css('grid-template-rows', '32px calc(100% - 58px) 26px')
    } else {
        $('body').css('grid-template-rows', '32px calc(100% - 32px) 0px')
    }
    if (entityMode.state !== settings.entity_mode.value) {
        entityMode.state = settings.entity_mode.value
        settings.entity_mode.value ? entityMode.join() : entityMode.leave()
    }
    TextureAnimator.updateSpeed()
    hideDialog()
    updateUIColor()
    updateSelection()
    if (settings.entity_mode.value) {
        main_uv.setGrid()
        if (uv_dialog.editors) {
            uv_dialog.editors.single.setGrid()
        }
    }
    Blockbench.dispatchEvent( 'update_settings')
}
function toggleSetting(setting) {
    if (settings[setting].value === true) {
        settings[setting].value = false
    } else {
        settings[setting].value = true
    }
    saveSettings()
}
function toggleWireframe() {
    Prop.wireframe = !Prop.wireframe
    Canvas.updateAll()
}
var entityMode = {
    state: false,
    join: function() {
        if (display_mode) {
           exitDisplaySettings() 
        }
        settings.entity_mode.value = true
        $('body').addClass('entity_mode')
        $('label[for="project_parent"]').text('Mob Geometry Name')

        //Rotation Menu
        $('#cube_rescale_tool div').text('Reset Bone')
        $('#rotation_function_button i').text('settings')
        $('#rotation_function_button .tooltip').text('Rotation Menu')
        $('.ui#options h3').text('Bone Settings')
        $('#rotation_origin_label').text('Pivot')
        $('input#cube_rotate').attr('min', '-180').attr('max', '180').attr('step', '5.625').addClass('entity_mode')

        main_uv.buildDom().setToMainSlot().setFace('north')
        main_uv.autoGrid = true
        $('.block_mode_only').hide()
        buildGrid()
        Blockbench.dispatchEvent('join_entity_mode')
    },
    leave: function() {
        settings.entity_mode.value = false
        $('body').removeClass('entity_mode')
        $('label[for="project_parent"]').text('Parent Model')

        //Rotation Menu
        $('#cube_rescale_tool div').text('Rescale')
        $('#rotation_function_button i').text('clear')
        $('#rotation_function_button .tooltip').text('Remove Rotation')
        $('.ui#options h3').text('Rotation')
        $('#rotation_origin_label').text('Origin')
        $('input#cube_rotate').attr('min', '-67.5').attr('max', '67.5').attr('step', '22.5').removeClass('entity_mode')

        $('.block_mode_only').show()
        $('.ui#textures').css('top', 514+'px')
        main_uv.buildDom(true).setToMainSlot()
        buildGrid()
        elements.forEach(function(s, i) {
            //Push elements into 3x3 block box
            [0, 1, 2].forEach(function(ax) {
                var overlap = s.from[ax] + s.to[ax] - 32
                if (overlap > 0) {
                    //If positive site overlaps
                    s.from[ax] -= overlap
                    s.to[ax] -= overlap

                    overlap = 16 + s.from[ax]
                    if (overlap < 0) {
                        s.from[ax] = -16
                    }
                } else {
                    overlap = s.from[ax] + 16
                    if (overlap < 0) {
                        s.from[ax] -= overlap
                        s.to[ax] -= overlap

                        if (s.from[ax] + s.to[ax] > 32) {
                            s.to[ax] = 32
                        }
                    }
                }
            })
        })
        Blockbench.dispatchEvent('leave_entity_mode')
    }
}