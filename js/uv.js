function getTextureById(id) {
    if (id === undefined) return;
    if (id == '$transparent') {
        return {material: transparentMaterial};
    }
    id = id.split('#').join('');
    return $.grep(textures, function(e) {return e.id == id})[0];
}
function getTexturesById(id) {
    if (id === undefined) return;
    id = id.split('#').join('');
    return $.grep(textures, function(e) {return e.id == id});
}
class UVEditor {
    constructor(id, headline, toolbar) {
        this.face = 'north';
        this.size = 320;
        this.grid = 16;
        this.id = id
        this.autoGrid = true;
        this.texture = false;
        this.headline = headline
        this.jquery = {}
        this.uuid = guid()

        this.buildDom(toolbar)
    }
    buildDom(toolbar) {
        var scope = this
        if (this.jquery.main) {
            this.jquery.main.remove()
        }
        this.jquery.main = $('<div class="UVEditor" id="UVEditor_'+scope.id+'"></div>')
        if (this.headline) {
            this.jquery.main.append('<div class="uv_headline"><div class="uv_title">'+capitalizeFirstLetter(scope.id)+'</div><div class="tool"><i class="material-icons">fullscreen</i><div class="tooltip">Fullscreen</div></div></div>')
            this.jquery.main.find('div.uv_headline > .tool').click(function() {
                uv_dialog.openTab(scope.id)
            })
            this.jquery.main.find('div.uv_headline').click(function(event) {
                event.stopPropagation()
                uv_dialog.select(scope.id, event)
            })
        }
        this.jquery.frame = $('<div id="uv_frame" style="background-repeat: no-repeat;"><div id="uv_size"></div></div>')
        this.jquery.size  = this.jquery.frame.find('div#uv_size')
        this.jquery.main.append(this.jquery.frame)
        this.jquery.frame.append('<div class="uv_transform_info" title="Transform indicators"></div>')
        this.jquery.frame.css('background-repeat', 'no-repeat')
        this.jquery.transform_info = this.jquery.frame.find('.uv_transform_info')

        this.jquery.nslides = $(
            '<div class="bar">'+
                '<div class="tool wide nslide_tool"><div class="nslide" n-action="moveuv_x"></div><div class="tooltip">Move X</div></div>' +
                '<div class="tool wide nslide_tool"><div class="nslide" n-action="moveuv_y"></div><div class="tooltip">Move Y</div></div>' +
                (Blockbench.entity_mode ? '' : '<div class="tool wide nslide_tool"><div class="nslide" n-action="scaleuv_x"></div><div class="tooltip">Scale X</div></div>') +
                (Blockbench.entity_mode ? '' : '<div class="tool wide nslide_tool"><div class="nslide" n-action="scaleuv_y"></div><div class="tooltip">Scale Y</div></div>') +
                '<button class="large" id="entity_mode_resolution_button" onclick="showDialog(\'project_settings\');">Resolution</button>'+
            '</div>'
        )
        this.jquery.main.append(this.jquery.nslides)
        setupNslides(this.jquery.nslides)
        this.jquery.nslides.find('.nslide_tool').on('change', function() {
            //dummy function, sets the global variable nslide.editor to the current uv editor
            nslide.editor = scope;
        })

        this.jquery.size.mouseenter(function() {
            scope.displayMappingOverlay()
        })
        this.jquery.size.mouseleave(function() {
            $(this).find('.uv_mapping_overlay').remove()
        })

        if (toolbar) {
            this.jquery.bar = $(
                '<div class="bar">' +
                    '<select class="tool" id="uv_snap" name="grid_snap" style="width: 50px;">' +
                        '<option id="auto" selected>Auto</option>' +
                        '<option id="16">16x16</option>' +
                        '<option id="32">32x32</option>' +
                        '<option id="64">64x64</option>' +
                        '<option id="none">Free</option>' +
                    '</select>' +
                    '<div class="tool" id="maximize"><i class="material-icons">zoom_out_map</i><div class="tooltip">Maximize<div class="tooltip_shift"> All</div></div></div>' +
                    '<div class="tool" id="auto_size"><i class="material-icons">brightness_auto</i><div class="tooltip">Auto Size<div class="tooltip_shift"> All</div></div></div>' +
                    '<div class="tool" id="applyAll"><i class="material-icons">format_color_fill</i><div class="tooltip">Apply To All Sides</div></div>' +
                    '<div class="tool" id="clear"><i class="material-icons">clear</i><div class="tooltip">Clear<div class="tooltip_shift"> All</div></div></div>' +
                    '<div class="tool" id="reset"><i class="material-icons">replay</i><div class="tooltip">Reset<div class="tooltip_shift"> All</div></div></div>' +
                    '<input class="tool" id="uv_rotation" title="Rotation" type="range" min="0" max="270" step="90" value="0" style="width: 60px;">' +
                '</div>'
            )

            //Click Bindings
                this.jquery.bar.find('#maximize').click(function(event) {
                    scope.maximize(event)
                })
                this.jquery.bar.find('#auto_size').click(function(event) {scope.setAutoSize(event)})
                this.jquery.bar.find('#applyAll').click(function(event) {scope.applyAll(event)})
                this.jquery.bar.find('#clear').click(function(event) {scope.clear(event)})

                this.jquery.bar.find('#uv_rotation').on('input', function(event) {scope.rotate(true)})
                this.jquery.bar.find('#grid_snap').change(function(event) {scope.selectGridSize(event)})

                this.jquery.bar.find('#reset').click(function(event) {scope.reset(event)}) //onclick

                this.jquery.bar.find('#uv_snap').on('change', function(event) {scope.setGrid()})
            this.jquery.main.append(this.jquery.bar)
        } else {
            this.jquery.bar = $('')
        }


        if (Blockbench.entity_mode === false) {
            this.jquery.size.resizable({
                handles: "all",
                maxHeight: 320,
                maxWidth: 320,
                containment: 'parent',
                resize: function(event, ui) {
                    scope.save()
                    scope.displayNslides()
                    scope.disableAutoUV()
                },
                stop: function(event, ui) {
                    setUndo('Changed UV')
                },
                grid: [20,20]
            })
        }
        this.jquery.size.draggable({
            containment: 'parent',
            stop: function(event, ui) {
                scope.save()
                setUndo('Changed UV')
            },
            drag: function( event, ui ) {
                var snapTolerance = 200//$(this).draggable('option', 'snapTolerance');
                var topRemainder = ui.position.top % (scope.size/scope.grid);
                var leftRemainder = ui.position.left % (scope.size/scope.grid);
                
                if (topRemainder <= snapTolerance) {
                    ui.position.top = ui.position.top - topRemainder;
                }
                
                if (leftRemainder <= snapTolerance) {
                    ui.position.left = ui.position.left - leftRemainder;
                }
                scope.save()
                scope.displayNslides()
            } 
        })

        this.jquery.frame.droppable({
            accept: 'li.texture',
            tolerance: 'pointer',
            drop: function(event, ui) {
                if (selected.length == 0) {
                    return
                }
                var id = $(ui.helper).attr('texid')
                scope.applyTexture(id)
            }
        })

        this.jquery.frame.contextmenu(function(event) {
            scope.contextMenu()
        })
        return this;
    }
    message(msg) {
        var box = $('<div class="uv_message_box">' + msg + '</div>')
        this.jquery.frame.append(box)
        setTimeout(function() {
            box.fadeOut(200)
            setTimeout(function() {
                box.remove()
            }, 300)
        }, 1000)
    }
    //Get
    getPixelSize() {
        return this.size/this.grid
    }
    getFaces(event) {
        if (event && event.shiftKey) {
            return ['north', 'east', 'south', 'west', 'up', 'down']
        } else {
            return [this.face]
        }
    }
    getUVTag(obj) {
        if (!obj) obj = selected[0]
        if (Blockbench.entity_mode) {
            return [obj.uv_offset[0], obj.uv_offset[1], 0, 0];
        } else {
            return obj.faces[this.face].uv;
        }
    }
    forCubes(cb) {
        var i = 0;
        while (i < selected.length) {
            cb(selected[i], selected[i].index())
            i++;
        }
    }
    //Set
    setSize(size, cancel_load) {
        this.size = size
        this.jquery.frame.width(size)
        if (uv_dialog.editors !== undefined && this === uv_dialog.editors.single) {
            this.jquery.main.width(size)
        }

        if (Blockbench.entity_mode) {
            this.jquery.frame.height(size / (Project.texture_width/Project.texture_height))
            $('.ui#textures').css('top', 133+(size / (Project.texture_width/Project.texture_height))+'px')
        } else {
            this.jquery.frame.height(size)

            this.jquery.size.resizable('option', 'maxHeight', size)
            this.jquery.size.resizable('option', 'maxWidth', size)
            this.jquery.size.resizable('option', 'grid', [size/this.grid, size/this.grid])
        }
        var nslide_width = (size / 4) - (size % 4 > 0 ? 1 : 0)
        this.jquery.nslides.find('.nslide_tool').css('width', (size/4-2)+'px')
        this.jquery.nslides.find('.nslide').css('width', (size/4-2)+'px')
        if (!cancel_load) {
            this.loadData()
        }
        return this;
    }
    setGrid(grid, load) {
        if (Blockbench.entity_mode) {
            this.autoGrid = false;
            grid = Project.texture_width
        } else if (grid === undefined || grid === 'dialog') {
            this.autoGrid = false;
            if (grid === undefined) {
                grid = this.jquery.bar.find('#uv_snap option:selected').attr('id')
            } else {
                grid = $('#uv_dialog_toolbar #uv_snap option:selected').attr('id')
            }
            if (grid === 'auto') {
                if (this.texture) {
                    grid = this.texture.res
                } else {
                    grid = 16
                }
                this.autoGrid = true
            } else if (grid === 'none') {
                grid = 512
            } else {
                grid = parseInt(grid)
            }
        }
        this.grid = grid
        if (Blockbench.entity_mode === false) {
            this.jquery.size.resizable('option', 'grid', [this.getPixelSize(), this.getPixelSize()])
        }
        if (load !== false) this.loadData()
    }
    setFace(face) {
        this.face = face
        this.loadData()
        if (this.id === 'main_uv') {
            $('input#'+face+'_radio').prop("checked", true)
        }
        return this;
    }
    setFrameColor(black) {
        if (black) {
            this.jquery.size.css('box-shadow', '0 0 6px black')
        } else {
            this.jquery.size.css('box-shadow', '0 0 6px white')
        }
    }
    setToMainSlot() {
        var scope = this;
        $('.ui#uv').append(this.jquery.main)
        this.jquery.main.on('mousewheel', function() {

            if (Blockbench.entity_mode) return;

            var faceIDs = {'north': 0, 'south': 1, 'west': 2, 'east': 3, 'up': 4, 'down': 5}
            var id = faceIDs[scope.face]
            event.deltaY > 0 ? id++ : id--;
            if (id === 6) id = 0
            if (id === -1) id = 5
            $('input#'+getKeyByValue(faceIDs, id)+'_radio').prop("checked", true)
            scope.loadSelectedFace()
        })
        this.jquery.frame.on('dblclick', function() {
            uv_dialog.openFull()
        })
        return this;
    }
    appendTo(selector) {
        $(selector).append(this.jquery.main)
        return this;
    }
    //Load
    loadSelectedFace() {
        this.face = $('#texture_bar input:checked').attr('id').replace('_radio', '')
        this.loadData()
        return false;
    }
    loadData() {
        if (selected.length === 0) return;
        var face = selected[0].faces[this.face]
        
        //Set Rotation
        if (face.rotation) {
            this.jquery.bar.find('#uv_rotation').val(face.rotation)
        } else {
            this.jquery.bar.find('#uv_rotation').val(0)
        }

        this.displayTexture(face.texture)
        this.displayFrame()//and transform info
        this.displayNslides()

        if (this.id !== 'main_uv') {
            this.displayTools()
        }
        if (this !== main_uv && this.face === main_uv.face) {
            main_uv.loadData()
        }
    }
    save() {
        var scope = this;
        //Save UV from Frame to object!!

        if (Blockbench.entity_mode) {

            selected.forEach(function(obj) {
                obj.uv_offset = [
                    Math.round(scope.jquery.size.position().left / (scope.size/Project.texture_width) * 8) / 8,
                    Math.round(scope.jquery.size.position().top  / (scope.size/Project.texture_width) * 8) / 8
                ]
                Canvas.updateUV(obj)
            })

        } else {

            var pixelSize = this.size/16
            var left = this.jquery.size.position().left / pixelSize
            var top  = this.jquery.size.position().top / pixelSize * (Project.texture_width/Project.texture_height)
            var left2 = (this.jquery.size.width()) / pixelSize + left
            var top2 = (this.jquery.size.height()) / pixelSize + top
            var uvTag = this.getUVTag()

            if (uvTag[0] > uvTag[2]) {
                left2 = [left, left = left2][0];
            }
            if (uvTag[1] > uvTag[3]) {
                top2 = [top, top = top2][0];
            }
            var uvArr = [left, top, left2, top2]
            uvArr.forEach(function(s, i) {
                if (s === 15.9) {
                    uvArr[i] = 16
                }
            })
            selected.forEach(function(obj) {
                obj.faces[scope.face].uv = uvArr.slice()
                Canvas.updateUV(obj)
            })
        }

        if (this !== main_uv && this.face === main_uv.face) {
            main_uv.loadData()
        }
    }
    applyTexture(id) {
        var scope = this;
        this.forCubes(function(obj) {
            obj.faces[scope.face].texture = '#'+id
        })
        this.loadData()
        Canvas.updateSelectedFaces()
        setUndo('Applied Texture')
    }
    displayTexture(id) {
        if (!id || id === '$transparent') {
            this.displayEmptyTexture()
        } else {
            var tex = getTextureById(id+'')
            if (tex === undefined || tex.error) {
                this.displayEmptyTexture()
                return;
            }
            this.setFrameColor(tex.dark_box)
            var css = 'url("'+tex.iconpath.split('\\').join('\\\\').replace(/ /g, '%20')+'")'
            this.jquery.frame.css('background-image', css)
            if (Blockbench.entity_mode) {
                this.jquery.frame.css('background-size', 'contain')
            } else {
                this.jquery.frame.css('background-size', 'cover')
            }
            this.texture = tex;
            if (this.autoGrid || Blockbench.entity_mode) {
                this.setGrid(tex.res, false)
            }
        }
        if (Blockbench.entity_mode) {
            this.setSize(this.size, true)
        }
    }
    displayTransformInfo() {
        var ref = selected[0].faces[this.face]
        this.jquery.transform_info.text('')
        if (Blockbench.entity_mode) return;

        if (ref.uv[0] > ref.uv[2]) {
            this.jquery.transform_info.append('<b>X</b>')
        }
        if (ref.uv[1] > ref.uv[3]) {
            this.jquery.transform_info.append('<b>Y</b>')
        }
        if (ref.rotation) {
            this.jquery.transform_info.append('<b>'+ref.rotation+'</b>')
        }
    }
    displayEmptyTexture() {
        this.jquery.frame.css('background-color', 'var(--color-back)').css('background-image', 'none')
        this.texture = false;
        this.setFrameColor()
        if (this.autoGrid) {
            this.grid = 16
        }
    }
    displayFrame() {
        /*
        var uvTag = this.getUVTag(selected[0])
        var pixels = this.size/16

        //X
        if (Blockbench.entity_mode) {
            var width = (selected[0].size(0) + selected[0].size(2))*2
            width = limitNumber(width/Project.texture_width * 16, 0, 16)
        } else {
            var width = limitNumber(uvTag[2]-uvTag[0], -16, 16)
        }
        var x = limitNumber(uvTag[0], 0, 16)
        if (width < 0) {
            width *= -1
            x = x - width
        }
        this.jquery.size.width(width * pixels)
        this.jquery.size.css('left', x*pixels+'px')

        //Y
        if (Blockbench.entity_mode) {
            var height = selected[0].size(2) + selected[0].size(1)
            height = limitNumber(height/Project.texture_width * 16, 0, 16)
        } else {
            var height = limitNumber(uvTag[3]-uvTag[1], -16, 16)
        }
        var y = limitNumber(uvTag[1], 0, 16)
        if (height < 0) {
            height *= -1
            y = y - height
        }
        if (Blockbench.entity_mode) {
            y *= (Project.texture_height/Project.texture_width)
        }
        this.jquery.size.height(height * pixels)
        this.jquery.size.css('top', y*pixels+'px')
        this.displayTransformInfo()
        */
        var scope = this;
        if (Blockbench.entity_mode) {
            var uvTag = this.getUVTag(selected[0])

            var width = (selected[0].size(0) + selected[0].size(2))*2
                width = limitNumber(width, 0, Project.texture_width)
                width = width/Project.texture_width*scope.size

            var x = limitNumber(uvTag[0], 0, Project.texture_width)
                x *= scope.size/Project.texture_width

            this.jquery.size.width(width)
            this.jquery.size.css('left', x+'px')


            var height = selected[0].size(2) + selected[0].size(1)
                height = limitNumber(height, 0, Project.texture_height)
                height = height/Project.texture_height*scope.size
                height *= Project.texture_height/Project.texture_width

            var y = limitNumber(uvTag[1], 0, Project.texture_height)
                y *= scope.size/Project.texture_height
                y *= Project.texture_height/Project.texture_width

            this.jquery.size.height(height)
            this.jquery.size.css('top', y+'px')


        } else {

            var uvTag = this.getUVTag(selected[0])
            var pixels = this.size/16

            //X
            var width = limitNumber(uvTag[2]-uvTag[0], -16, 16)
            var x = limitNumber(uvTag[0], 0, 16)
            if (width < 0) {
                width *= -1
                x = x - width
            }
            this.jquery.size.width(width * pixels)
            this.jquery.size.css('left', x*pixels+'px')

            //Y
            var height = limitNumber(uvTag[3]-uvTag[1], -16, 16)
            var y = limitNumber(uvTag[1], 0, 16)
            if (height < 0) {
                height *= -1
                y = y - height
            }
            this.jquery.size.height(height * pixels)
            this.jquery.size.css('top', y*pixels+'px')
        }
        this.displayTransformInfo()
    }
    displayMappingOverlay() {
        if (!Blockbench.entity_mode) return this;
        var scope = this;
        var size = scope.getPixelSize()
        function addElement(x,y,width, height, n, color) {
            scope.jquery.size.append('<div class="uv_mapping_overlay" '+
                'style="left: '+x*size+'px; top: '+y*size+'px;'+
                'height: '+height*size+'px; width: '+width*size+'px;'+
                'background: '+color+';"></div>')
        }
        var obj = selected[0]
        addElement(obj.size(2), 0, obj.size(0), obj.size(2),                            '#b4d4e1', '#ecf8fd')
        addElement(obj.size(2)+obj.size(0), 0, obj.size(0), obj.size(2),                '#536174', '#6e788c')
        addElement(0, obj.size(2), obj.size(2), obj.size(1),                            '#43e88d', '#7BFFA3')
        addElement(obj.size(2), obj.size(2), obj.size(0), obj.size(1),                  '#5bbcf4', '#7BD4FF')
        addElement(obj.size(2)+obj.size(0), obj.size(2), obj.size(2), obj.size(1),      '#f48686', '#FFA7A4')
        addElement(2*obj.size(2)+obj.size(0), obj.size(2), obj.size(0), obj.size(1),    '#f8dd72', '#FFF899')
    }
    displayNslides() {
        if (Blockbench.entity_mode) {
            var values = [
                trimFloatNumber(selected[0].uv_offset[0] ),
                trimFloatNumber(selected[0].uv_offset[1] ),
                0,
                0
            ]
        } else {
            var face_uv = selected[0].faces[this.face].uv
            var values = [
                trimFloatNumber(face_uv[0] * (Blockbench.entity_mode ? Project.texture_width / 16 : 1)),
                trimFloatNumber(face_uv[1] * (Blockbench.entity_mode ? Project.texture_height / 16 : 1)),
                trimFloatNumber(face_uv[2] - face_uv[0]),
                trimFloatNumber(face_uv[3] - face_uv[1])
            ]
        }
        this.jquery.nslides.find('div.nslide[n-action="moveuv_x"]:not(".editing")').text(values[0])
        this.jquery.nslides.find('div.nslide[n-action="moveuv_y"]:not(".editing")').text(values[1])
        this.jquery.nslides.find('div.nslide[n-action="scaleuv_x"]:not(".editing")').text(values[2])
        this.jquery.nslides.find('div.nslide[n-action="scaleuv_y"]:not(".editing")').text(values[3])
    }
    displayTools() {
        //Cullface
        var face = selected[0].faces[this.face]
        if (face.cullface) {
            $('#uv_dialog_toolbar select#cullface').val(face.cullface)
        } else {
            $('#uv_dialog_toolbar select#cullface').val('off')
        }

        //Tint
        if (face.tintindex != undefined) {
            $('#uv_dialog_toolbar input#tint').prop('checked', true)
        } else {
            $('#uv_dialog_toolbar input#tint').prop('checked', false)
        }
    }
    contextMenu() {
        var scope = this;
        if (Blockbench.entity_mode) return;
        var ref = selected[0].faces[scope.face]
        ContextMenu(event, [
            {icon: 'content_copy', name: 'Copy', click: function(event) {scope.copy(event)}},
            {icon: 'content_paste', name: 'Paste', click: function(event) {scope.paste(event)}},
            {icon: 'photo_size_select_large', name: 'UV Mapping', children: [
                {icon: ref.enabled!==false ? 'check_box' : 'check_box_outline_blank', name: 'Export', click: function(event) {scope.toggleUV(event)}},
                {icon: 'zoom_out_map', name: 'Maximize', click: function(event) {scope.maximize(event)}},
                {icon: 'brightness_auto', name: 'Auto UV', click: function(event) {scope.setAutoSize(event)}},
                {icon: 'brightness_auto', name: 'Rel. Auto UV', click: function(event) {scope.setRelativeAutoSize(event)}},
                {icon: 'rotate_90_degrees_ccw', name: 'Rotation', children: function() {
                    var off = 'radio_button_unchecked'
                    var on = 'radio_button_checked'
                    return [
                        {icon: (!ref.rotation ? on : off), name: '0', click: function(event) {scope.setRotation(0)}},
                        {icon: (ref.rotation === 90 ? on : off), name: '90', click: function(event) {scope.setRotation(90)}},
                        {icon: (ref.rotation === 180 ? on : off), name: '180', click: function(event) {scope.setRotation(180)}},
                        {icon: (ref.rotation === 270 ? on : off), name: '270', click: function(event) {scope.setRotation(270)}}
                    ]
                }},
                {icon: (ref.uv[0] > ref.uv[2] ? 'check_box' : 'check_box_outline_blank'), name: 'Mirror X', click: function(event) {scope.mirrorX(event)}},
                {icon: (ref.uv[1] > ref.uv[3] ? 'check_box' : 'check_box_outline_blank'), name: 'Mirror Y', click: function(event) {scope.mirrorY(event)}},
            ]},
            {
                icon: (ref.tintindex === 0 ? 'check_box' : 'check_box_outline_blank'),
                name: 'Tint', click: function(event) {scope.switchTint(selected[0].faces[scope.face].tintindex !== 0)}
            },
            {icon: 'collections', name: 'Texture', children: function() {
                var arr = [
                    {icon: 'clear', name: 'Transparent', click: function(event) {scope.clear(event)}},
                ]
                textures.forEach(function(s) {
                    arr.push({
                        name: s.name,
                        icon: s.img,
                        click: function(event) {scope.applyTexture(s.id)}
                    })
                })
                return arr;
            }}
        ])
    }
    //Nslide
    slider(action, difference, obj) {
        var before;
        switch (action) {
            case 'moveuv_x':
                before = this.getUVTag(obj)[0];
                break;
            case 'moveuv_y':
                before = this.getUVTag(obj)[1];
                break;
            case 'scaleuv_x':
                before = this.getUVTag(obj)[2] - this.getUVTag(obj)[0];
                break;
            case 'scaleuv_y':
                before = this.getUVTag(obj)[3] - this.getUVTag(obj)[1];
                break;
        }

        difference += before
        switch (action) {
            case 'moveuv_x':
            this.moveCoord(0, difference, obj)
            break;
            case 'moveuv_y':
            this.moveCoord(1, difference, obj)
            break;

            case 'scaleuv_x':
            this.scaleCoord(0, difference, obj)
            break;
            case 'scaleuv_y':
            this.scaleCoord(1, difference, obj)
            break;
        }
        $('#nslide_head #nslide_offset').text('Offset: '+difference)
    }
    nslideInput(action, difference) {
        var scope = this;
        selected.forEach(function(obj) {
            switch (action) {
                case 'moveuv_x':
                scope.moveCoord(0, difference, obj)
                break;
                case 'moveuv_y':
                scope.moveCoord(1, difference, obj)
                break;

                case 'scaleuv_x':
                scope.scaleCoord(0, difference, obj)
                break;
                case 'scaleuv_y':
                scope.scaleCoord(1, difference, obj)
                break;
            }
        })
    }
    moveCoord(index, val, obj) {
        if (Blockbench.entity_mode === false) {
            var uvTag = this.getUVTag(obj)
            var size = uvTag[index + 2] - uvTag[index]
            val = limitNumber(val, 0, 16)
            val = limitNumber(val + size, 0, 16) - size

            uvTag[index] = val
            uvTag[index + 2] = size + val
        } else {
            if (index === 0) {
                var size = (selected[0].size(0) + selected[0].size(2))*2
                var limit = Project.texture_width
            } else {
                var size = selected[0].size(2) + selected[0].size(1)
                var limit = Project.texture_height
            }
            val = limitNumber(val, 0, limit)
            val = limitNumber(val + size, 0, limit) - size
            obj.uv_offset[index] = val
        }

        this.displayNslides()
        this.displayFrame()
    }
    scaleCoord(index, val, obj) {

        var uvTag = this.getUVTag(obj)

        uvTag[index + 2] = limitNumber(uvTag[index] + val, 0, 16)

        this.displayNslides()
        this.displayFrame()
    }

    //Events
    disableAutoUV() {
        this.forCubes(function(obj) {
            obj.display.autouv = 0
        })
    }
    toggleUV() {
        var scope = this
        var state = selected[0].faces[this.face].enabled === false
        this.forCubes(function(obj) {
            obj.faces[scope.face].enabled = state
        })
    }
    maximize(event) {
        var scope = this;
        this.forCubes(function(obj) {
            scope.getFaces(event).forEach(function(side) {
                obj.faces[side].uv = [0, 0, 16, 16]
            })
            obj.display.autouv = 0
            Canvas.updateUV(obj)
        })
        this.message('Maximized')
        this.loadData()
        setUndo('Maximized UV')
    }
    setAutoSize(event) {
        var scope = this;
        var top, left, top2, left2;
        this.forCubes(function(obj, i) {
            scope.getFaces(event).forEach(function(side) {
                left = top = 0;
                if (side == 'north' || side == 'south') {
                    left2 = limitNumber(obj.size('0'), 0, 16)
                    top2 = limitNumber(obj.size('1'), 0, 16)
                } else if (side == 'east' || side == 'west') {
                    left2 = limitNumber(obj.size('2'), 0, 16)
                    top2 = limitNumber(obj.size('1'), 0, 16)
                } else if (side == 'up' || side == 'down') {
                    left2 = limitNumber(obj.size('0'), 0, 16)
                    top2 = limitNumber(obj.size('2'), 0, 16)
                }
                obj.faces[side].uv = [left, top, left2, top2]
            })
            obj.display.autouv = 0
            Canvas.updateUV(obj)
        })
        this.message('Auto Size')
        this.loadData()
        setUndo('Used Auto UV')
    }
    setRelativeAutoSize(event) {
        var scope = this;
        this.forCubes(function(obj, i) {
            scope.getFaces(event).forEach(function(side) {
                var uv = obj.faces[side].uv
                switch (side) {
                    case 'north':
                    uv = [
                        16 - obj.to[0],
                        16 - obj.to[1],
                        16 - obj.from[0],
                        16 - obj.from[1],
                    ];
                    break;
                    case 'south':
                    uv = [
                        obj.from[0],
                        16 - obj.to[1],
                        obj.to[0],
                        16 - obj.from[1],
                    ];
                    break;
                    case 'west':
                    uv = [
                        obj.from[2],
                        16 - obj.to[1],
                        obj.to[2],
                        16 - obj.from[1],
                    ];
                    break;
                    case 'east':
                    uv = [
                        16 - obj.from[2],
                        16 - obj.from[1],
                        16 - obj.to[2],
                        16 - obj.to[1],
                    ];
                    break;
                    case 'up':
                    uv = [
                        obj.from[0],
                        obj.from[2],
                        obj.to[0],
                        obj.to[2],
                    ];
                    break;
                    case 'down':
                    uv = [
                        obj.from[0],
                        16 - obj.to[2],
                        obj.to[0],
                        16 - obj.from[2],
                    ];
                    break;
                }
                uv.forEach(function(s, uvi) {
                    uv[uvi] = limitNumber(s, 0, 16)
                })
                obj.faces[side].uv = uv
            })
            obj.display.autouv = 0
            Canvas.updateUV(obj)
        })
        this.message('Auto Size')
        this.loadData()
        setUndo('Used Auto UV')
    }
    mirrorX(event) {
        var scope = this;
        this.forCubes(function(obj, i) {
            scope.getFaces(event).forEach(function(side) {
                var proxy = obj.faces[side].uv[0]
                obj.faces[side].uv[0] = obj.faces[side].uv[2]
                obj.faces[side].uv[2] = proxy
            })
            obj.display.autouv = 0
            Canvas.updateUV(obj)
        })
        this.message('Mirrored')
        this.loadData()
        setUndo('Mirrored UV')
    }
    mirrorY(event) {
        var scope = this;
        this.forCubes(function(obj, i) {
            scope.getFaces(event).forEach(function(side) {
                var proxy = obj.faces[side].uv[1]
                obj.faces[side].uv[1] = obj.faces[side].uv[3]
                obj.faces[side].uv[3] = proxy
            })
            obj.display.autouv = 0
            Canvas.updateUV(obj)
        })
        this.message('Mirrored')
        this.loadData()
        setUndo('Mirrored UV')
    }
    applyAll(event) {
        var scope = this;
        this.forCubes(function(obj, i) {
            uv_dialog.allFaces.forEach(function(side) {
                $.extend(true, obj.faces[side], obj.faces[scope.face]) 
            })
            obj.display.autouv = 0
            Canvas.updateUV(obj)
        })
        this.message('Applied To All Faces')
        this.loadData()
        setUndo('Applied UV to all faces')
    }
    clear(event) {
        var scope = this;
        this.forCubes(function(obj, i) {
            scope.getFaces(event).forEach(function(side) {
                obj.faces[side].uv = [0, 0, 0, 0]
                obj.faces[side].texture = '$transparent';
            })
            Canvas.updateUV(obj)
        })
        this.loadData()
        this.message('Cleared')
        setUndo('Cleared Faces')
        Canvas.updateSelectedFaces()
    }
    switchCullface(event) {
        var scope = this;
        var val = $('#uv_dialog_toolbar #cullface option:selected').attr('id')
        if (val === 'off') val = false
        this.forCubes(function(obj) {
            if (val) {
                obj.faces[scope.face].cullface = val
            } else {
                delete obj.faces[scope.face].cullface
            }
        })
        if (val) {
            this.message('Cullface On')
        } else {
            this.message('Cullface Off')
        }
        setUndo('Set Cullface')
    }
    switchTint(event) {
        var scope = this;
        var val = $('#uv_dialog_toolbar #tint').is(':checked')
        if (event === true || event === false) val = event
        this.forCubes(function(obj) {
            if (val) {
                obj.faces[scope.face].tintindex = 0
            } else {
                delete obj.faces[scope.face].tintindex
            }
        })
        if (val) {
            this.message('Tint On')
        } else {
            this.message('Tint Off')
        }
        setUndo('Set Tint')
    }
    rotate(main) {
        if (main === true) {
            var value = this.jquery.bar.find('#uv_rotation').val()
        } else {
            var value = $('#uv_dialog_toolbar #uv_rotation').val()
        }
        var scope = this;
        this.forCubes(function(obj, i) {
            if (value == 0) {
                delete obj.faces[scope.face].rotation
            } else {
                obj.faces[scope.face].rotation = parseInt(value)
            }
            Canvas.updateUV(obj)
        })
        this.displayTransformInfo()
        this.message('Rotated')
        setUndo('Rotated')
    }
    setRotation(value) {
        var scope = this;
        this.forCubes(function(obj, i) {
            if (value == 0) {
                delete obj.faces[scope.face].rotation
            } else {
                obj.faces[scope.face].rotation = parseInt(value)
            }
            Canvas.updateUV(obj)
        })
        this.loadData()
        this.message('Rotated')
        setUndo('Rotated')
    }
    selectGridSize(event) {
    }
    autoCullface(event) {
        var scope = this;
        this.forCubes(function(obj) {
            scope.getFaces(event).forEach(function(side) {
                obj.faces[side].cullface = side
            })
        })
        this.loadData()
        this.message('Cullface To Self')
        setUndo('Set Cullface')
    }
    copy(event) {
        this.select()
        if (selected.length === 0) return;

        var scope = this;
        uv_dialog.clipboard = []

        function addToClipboard(face) {
            var tag = selected[0].faces[face]
            var new_tag = {
                uv: tag.uv.slice(),
                face: face
            }
            if (tag.texture) new_tag.texture = tag.texture
            if (tag.cullface) new_tag.cullface = tag.cullface
            if (tag.rotation) new_tag.rotation = tag.rotation
            if (tag.enabled !== undefined) new_tag.enabled = tag.enabled
            if (tag.tintindex !== undefined) new_tag.tintindex = tag.tintindex
            uv_dialog.clipboard.push(new_tag)
        }
        if (event.shiftKey) {
            uv_dialog.allFaces.forEach(function(s) {
                addToClipboard(s)
            })
        } else {
            addToClipboard(this.face)
        }
        this.message('Copied '+uv_dialog.clipboard.length+' faces')
    }
    paste(event) {
        this.select()
        if (uv_dialog.clipboard === null || selected.length === 0) return;

        function applyFace(tag, face) {
            if (!face) face = tag.face
            selected.forEach(function(obj) {
                var target = obj.faces[face]
                target.uv = tag.uv.slice()

                if (tag.texture || target.texture) target.texture = tag.texture
                if (tag.cullface || target.cullface) target.cullface = tag.cullface
                if (tag.rotation || target.rotation) target.rotation = tag.rotation
                if (tag.enabled !== undefined || target.enabled !== undefined) target.enabled = tag.enabled
                if (tag.tintindex !== undefined || target.texture !== undefined) target.tintindex = tag.tintindex

                Canvas.updateUV(obj)
            })
        }

        if (this.id === 'main_uv' && event) {
            if (event.shiftKey) {
                uv_dialog.allFaces.forEach(function(s) {
                    applyFace(uv_dialog.clipboard[0], s)
                })
            } else {
                if (uv_dialog.clipboard.length === 1) {
                    applyFace(uv_dialog.clipboard[0], main_uv.face)
                } else {
                    uv_dialog.clipboard.forEach(function(s) {
                        applyFace(s)
                    })
                }
            }
        } else {
            if (uv_dialog.selection.length === 1) {
                applyFace(uv_dialog.clipboard[0], uv_dialog.selection[0])
            } else {
                if (uv_dialog.clipboard.length === 1) {
                    uv_dialog.selection.forEach(function(s) {
                        applyFace(uv_dialog.clipboard[0], s)
                    })
                } else {
                    uv_dialog.clipboard.forEach(function(s) {
                        if (uv_dialog.selection.includes(s.face)) {
                            applyFace(s)
                        }
                    })
                }
            }
        }
        this.loadData()
        Canvas.updateSelectedFaces()
        setUndo('Pasted UV')
        this.message('Pasted face')
    }
    reset(event) {
        var scope = this;
        this.forCubes(function(obj, i) {
            scope.getFaces(event).forEach(function(side) {
                obj.faces[side].uv = [0, 0, 1, 1]
                delete obj.faces[side].texture;
                delete obj.faces[side].rotation;
                delete obj.faces[side].tintindex;
                delete obj.faces[side].enabled;
                delete obj.faces[side].cullface;
            })
            Canvas.updateUV(obj)
        })
        this.loadData()
        this.message('Reset')
        setUndo('Reset Face')
        Canvas.updateSelectedFaces()
    }
    select() {
        if (uv_dialog.allFaces.includes(this.id) === false) return;
        uv_dialog.selection = [this.id]
        uv_dialog.updateSelection()
    }
}

var uv_dialog = {
    isSetup: false,
    single: false,
    clipboard: null,
    allFaces: ['north', 'south', 'west', 'east', 'up', 'down'],
    selection: [],
    selection_all: [],
    hoveredSide: false,
    setup: function() {
        uv_dialog.editors = {
            single:new UVEditor('single').appendTo('#uv_dialog_single'),
            north: new UVEditor('north', true).appendTo('#uv_dialog_all'),
            south: new UVEditor('south', true).appendTo('#uv_dialog_all'),
            west:  new UVEditor('west', true).appendTo('#uv_dialog_all'),
            east:  new UVEditor('east', true).appendTo('#uv_dialog_all'),
            up:    new UVEditor('up', true).appendTo('#uv_dialog_all'),
            down:  new UVEditor('down', true).appendTo('#uv_dialog_all')
        }
        var size = $(window).height() - 200
        size = size - (size % 16)
        uv_dialog.editors.single.setSize(size)
        uv_dialog.editors.single.jquery.main.css('margin-left', 'auto').css('margin-right', 'auto').css('width', size+'px')
        uv_dialog.editors.up.jquery.main.css('margin-left', '276px').css('clear', 'both')
        uv_dialog.isSetup = true

        var single_size = size / 2 - 72
        single_size = limitNumber(single_size - (single_size % 16), 80, 256)
        for (var key in uv_dialog.editors) {
            if (uv_dialog.editors[key] && key !== 'single') {
                uv_dialog.editors[key].setFace(key, false)
                uv_dialog.editors[key].setSize(single_size)
                uv_dialog.editors[key].jquery.main.mouseenter(function(event) {
                    uv_dialog.hoveredSide = $(this).attr('id').replace('UVEditor_', '')
                })
                uv_dialog.editors[key].jquery.main.mouseleave(function() {
                    uv_dialog.hoveredSide = false
                })
            }
        }
        $('.dialog#uv_dialog').resizable({
            minWidth: 200,
            minHeight: 464,
            resize: function() {
                uv_dialog.updateSize()
            },
            containment: 'document',
            handles: 'all'
        })
    },
    select: function(id, event) {
        if (event.shiftKey) {
            uv_dialog.selection.push(id)
        } else {
            if (uv_dialog.selection.includes(id) && uv_dialog.selection.length === 1) {
                uv_dialog.selection = []
            } else {
                uv_dialog.selection = [id]
            }
        }
        uv_dialog.updateSelection()
    },
    selectAll: function() {
        uv_dialog.selection = ['north', 'south', 'west', 'east', 'up', 'down']
        uv_dialog.updateSelection()
    },
    selectNone: function() {
        uv_dialog.selection = []
        uv_dialog.updateSelection()
    },
    forSelection: function(cb) {
        if (uv_dialog.single) {
            uv_dialog.editors.single[cb]()
        } else {
            if (uv_dialog.selection.length > 0) {
                uv_dialog.selection.forEach(function(s) {
                    uv_dialog.editors[s][cb]()
                })
            } else {
                uv_dialog.allFaces.forEach(function(s) {
                    uv_dialog.editors[s][cb]()
                })
            }
        }
    },
    updateSelection: function() {
        $('#uv_dialog_all .UVEditor .uv_headline').removeClass('selected')
        uv_dialog.selection.forEach(function(id) {
            $('#uv_dialog_all #UVEditor_'+id+' .uv_headline').addClass('selected')
        })
    },
    openDialog: function() {
        var obj = $('.dialog#uv_dialog')
        showDialog('uv_dialog')

        if (!uv_dialog.isSetup) uv_dialog.setup()
    },
    centerDialog: function() {
        var obj = $('.dialog#uv_dialog')
        obj.css('left', (($(window).width()-obj.width())/2) +'px')
        obj.css('top', (($(window).height() - obj.height()) / 2) + 'px')
    },
    openAll: function() {
        uv_dialog.openDialog()
        uv_dialog.openTab('all')
        uv_dialog.centerDialog()
    },
    openFull: function() {
        uv_dialog.openDialog()
        uv_dialog.openTab(main_uv.face)
        uv_dialog.centerDialog()
    },
    openTab: function(tab) {
        $('#uv_tab_bar .tab').removeClass('open')
        $('#uv_tab_bar .tab#'+tab).addClass('open')
        if (tab === 'all') {
            uv_dialog.single = false
            $('#uv_dialog_single').hide()
            $('.uv_dialog_all_only').show()
            for (var key in uv_dialog.editors) {
                if (uv_dialog.editors[key] && key !== 'single') {
                    uv_dialog.editors[key].loadData()
                }
            }
            uv_dialog.selection = uv_dialog.selection_all.splice(0, 10)
            uv_dialog.updateSelection()
            $('#uv_dialog_toolbar #grid_snap').val(uv_dialog.editors.north.gridSelectOption)
        } else {
            uv_dialog.single = true
            $('#uv_dialog_single').show()
            $('.uv_dialog_all_only').hide()
            uv_dialog.editors.single.setFace(tab)
            uv_dialog.selection_all = uv_dialog.selection.splice(0, 10)
            uv_dialog.selection = [tab]
            $('#uv_dialog_toolbar #grid_snap').val(uv_dialog.editors.single.gridSelectOption)

            var max_size = $(window).height() - 200
            max_size = max_size - (max_size % 16)
            if (max_size < uv_dialog.editors.single.size ) {
                uv_dialog.editors.single.setSize(max_size)
                uv_dialog.editors.single.jquery.main.css('margin-left', 'auto').css('margin-right', 'auto').css('width', max_size+'px')
            }
        }
        uv_dialog.hoveredSide = false;
        uv_dialog.updateSize()
    },
    updateSize: function() {
        var obj = $('.dialog#uv_dialog')
        var size = {
            x: obj.width(),
            y: obj.height()
        }
        if (uv_dialog.single) {
            var menu_gap = Blockbench.entity_mode ? 66 : 130
            var editor_size = size.x
            size.y = (size.y - menu_gap) * (Blockbench.entity_mode ? Project.texture_width/Project.texture_height : 1)
            if (size.x > size.y) {
                editor_size =  size.y
            }
            editor_size = editor_size - (editor_size % 16)
            uv_dialog.editors.single.setSize(editor_size)

        } else {
            var centerUp = false
            if (size.x < size.y/1.2) {
                //2 x 3     0.83 - 7.2
                if (size.y*1.4 > size.x) {
                    var editor_size = limitNumber(size.x / 2 - 20, 80, $(window).height()/3-120)
                } else {
                    var editor_size = size.y / 3 - 96 - 48
                }
            } else {
                //4 x 2
                if (size.y - 250 > size.x / 2) {
                    var editor_size = size.x / 4 - 20
                } else {
                    var editor_size = size.y / 2 - 130
                }
                centerUp = true
            }
            editor_size = editor_size - (editor_size % 16)
            uv_dialog.setEditorSize(editor_size)
            if (centerUp) {
                uv_dialog.editors.up.jquery.main.css('margin-left', (editor_size+20)+'px').css('clear', 'both')
            }
        }
    },
    setEditorSize: function(size) {
        for (var key in uv_dialog.editors) {
            if (uv_dialog.editors[key] && key !== 'single') {
                uv_dialog.editors[key].jquery.main.css('margin-left', '0')
                uv_dialog.editors[key].setSize(size)
            }
        }
    },
    changeGrid: function() {
        if (uv_dialog.single) {
            uv_dialog.editors.single.setGrid('dialog')
            uv_dialog.editors.single.gridSelectOption = $('#uv_dialog_toolbar #grid_snap option:selected').attr('id')
        } else {
            uv_dialog.allFaces.forEach(function(s) {
                uv_dialog.editors[s].setGrid('dialog')
            })
            uv_dialog.editors.north.gridSelectOption = $('#uv_dialog_toolbar #grid_snap option:selected').attr('id')
        }
    },
    copy: function() {
        if (selected.length === 0) return;
        uv_dialog.clipboard = []

        function addToClipboard(face) {
            var tag = selected[0].faces[face]
            var new_tag = {
                uv: tag.uv.slice(),
                face: face
            }
            if (tag.texture) new_tag.texture = tag.texture
            if (tag.cullface) new_tag.cullface = tag.cullface
            if (tag.rotation) new_tag.rotation = tag.rotation
            if (tag.enabled !== undefined) new_tag.enabled = tag.enabled
            if (tag.tintindex !== undefined) new_tag.tintindex = tag.tintindex
            uv_dialog.clipboard.push(new_tag)
        }
        if (uv_dialog.hoveredSide) {
            addToClipboard(uv_dialog.hoveredSide)

        } else if (uv_dialog.selection.length > 0) {
            uv_dialog.selection.forEach(function(s) {
                addToClipboard(s)
            })
        } else {
            uv_dialog.allFaces.forEach(function(s) {
                addToClipboard(s)
            })
        }
    },
    paste: function() {
        if (uv_dialog.clipboard === null || selected.length === 0) return;

        function applyFace(tag, face) {
            if (!face) face = tag.face
            selected.forEach(function(obj) {
                var target = obj.faces[face]
                target.uv = tag.uv.slice()

                if (tag.texture || target.texture) target.texture = tag.texture
                if (tag.cullface || target.cullface) target.cullface = tag.cullface
                if (tag.rotation || target.rotation) target.rotation = tag.rotation
                if (tag.enabled !== undefined || target.enabled !== undefined) target.enabled = tag.enabled
                if (tag.tintindex !== undefined || target.texture !== undefined) target.tintindex = tag.tintindex

                Canvas.updateUV(obj)
            })
        }

        if (uv_dialog.hoveredSide) {
            uv_dialog.editors[uv_dialog.hoveredSide].paste({shiftKey: false})

        } else if (uv_dialog.selection.length === 1) {
            applyFace(uv_dialog.clipboard[0], uv_dialog.selection[0])
        } else {
            if (uv_dialog.clipboard.length === 1) {
                uv_dialog.selection.forEach(function(s) {
                    applyFace(uv_dialog.clipboard[0], s)
                })
            } else {
                uv_dialog.clipboard.forEach(function(s) {
                    if (uv_dialog.selection.includes(s.face)) {
                        applyFace(s)
                    }
                })
            }
        }

        for (var key in uv_dialog.editors) {
            if (uv_dialog.editors[key]) {
                uv_dialog.editors[key].loadData()
            }
        }
    }
}
