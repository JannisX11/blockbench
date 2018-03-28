class Tool {
	constructor(options) {

		this.id = ''
		this.label = ''
		this.icon = ''
		this.cursor = false
		this.showTransformer = true
		this.navigate = true
		this.selectElement = true
		this.selectFace = true
		this.optionBar = 'transform'

		this.extend(options)
		return this;
	}
	select() {
		if (Toolbox.selected.onUnselect) {
			Toolbox.selected.onUnselect()
		}
		Toolbox.selected = this
		Toolbox.updateSelected()
		$('.tool_options').hide()
		$('.tool_options#tool_options_'+this.optionBar).show()

		//Settings
		if (this.transformerMode) {
			Transformer.setMode(this.transformerMode)
		}
		$(canvas1).css('cursor', (this.cursor ? this.cursor : 'default'))

		controls.enabled = this.navigate !== false
		updateSelection()

		if (this.onSelect) {
			this.onSelect()
		}
		return this;
	}
	extend(options) {
		if (options) {
			$.extend(this, options)
		}
		return this;
	}
	getButton() {
		var scope = this
		var fa_icon = this.icon.length > 2 && this.icon.substr(0,3) == 'fa-'
		var button = $('<div class="tool bbtool m_edit" id="tool_'+this.id+'"></div>')
		button.click(function() {
			scope.select()
		})
		button.append('<i class="' + (fa_icon ? 'fa fa_big '+ this.icon : 'material-icons') + '">' + (fa_icon ? '' : this.icon ) + '</i>')
		button.append('<div class="tooltip">'+this.label+'</div>')
		if (this.id === Toolbox.selected.id) {
			button.addClass('sel')
		}
		return button
	}
}

var Toolbox = {
	tools: [
		new Tool({
			id: 'translate',
			label: 'Move',
			icon: 'fa-hand-paper-o',
			transformerMode: 'translate'
		}),
		new Tool({
			id: 'scale',
			label: 'Resize',
			icon: 'open_with',
			transformerMode: 'scale'
		}),
		new Tool({
			id: 'paint_brush',
			label: 'Paint Brush',
			icon: 'fa-paint-brush',
			showTransformer: false,
			optionBar: 'brush',
			onCanvasClick: function(data) {
				Painter.startBrush(data.cube, data.intersects[0], data.event)
			}
		}),
		new Tool({
			id: 'vertex_snap',
			label: 'Vertex Snap',
			icon: 'fa-magnet',
			showTransformer: false,
			optionBar: 'vertex_snap',
			select_cubes: true,
			cursor: 'copy',
			onCanvasClick: function(data) {
				Vertexsnap.canvasClick(data)
			},
			onSelect: function() {
				Blockbench.addListener('update_selection', Vertexsnap.select)
				Vertexsnap.select()
			},
			onUnselect: function() {
				Vertexsnap.removeVertexes()
				Vertexsnap.step1 = true
				Blockbench.removeListener('update_selection', Vertexsnap.select)
			}
		}),
	],
	selected: false,
	updateBar: function() {
		$('#toolbox').html('')
		Toolbox.tools.forEach(function(t) {
			$('#toolbox').append(t.getButton())
		})
		if (Toolbox.selected === false) {
			Toolbox.tools[0].select()
		}
	},
	addTool: function(tool, position) {
		if (position) {
			position = limitNumber(position, 0, 256)
		} else {
			position = Toolbox.tools.length
		}
		Toolbox.tools.splice(position, 0, tool)
		Toolbox.updateBar()

	},
	removeTool: function(id) {
		var changes = false
		Toolbox.tools.forEach(function(t, ti) {
			if (t.id === id || ti === id || t === id) {
				Toolbox.tools.splice(ti, 1)
				changes = true
			}
		})
		if (changes) {
			Toolbox.updateBar()
			if (!Toolbox.tools.includes(Toolbox.selected)) {
				Toolbox.tools[0].select()
			}
		}
	},
	updateSelected: function() {
		$('#toolbox > div.tool').removeClass('sel')
		$('#toolbox > div.tool#tool_'+Toolbox.selected.id).addClass('sel')
	},
	set(id) {
		var i = 0;
		while (i < Toolbox.tools.length) {
			if (Toolbox.tools[i].id === id) {
				Toolbox.tools[i].select()
				i = 255
			}
			i++;
		}
	}
}