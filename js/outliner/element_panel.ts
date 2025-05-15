import { Blockbench } from "../api";
import { Interface } from "../interface/interface";
import { Panel } from "../interface/panels";

Interface.definePanels(function() {
	let element_panel = new Panel('transform', {
		icon: 'fas.fa-cube',
		condition: {modes: ['edit', 'pose']},
		display_condition: () => Outliner.selected.length || Group.first_selected,
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: [
			Toolbars.element_position,
			Toolbars.element_size,
			Toolbars.element_stretch,
			Toolbars.element_origin,
			Toolbars.element_rotation,
		],
	})
	let element_properties_panel = new Panel('element', {
		icon: 'format_list_bulleted',
		condition: !Blockbench.isMobile && {modes: ['edit']},
		display_condition: () => Outliner.selected.length || Group.first_selected,
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400,
			attached_to: 'transform',
			attached_index: 1
		},
		form: new InputForm({})
	})
	function updateElementForm() {
		const {form_config} = element_properties_panel.form;
		for (let key in form_config) {
			delete form_config[key];
		}
		let onchanges = [];
		for (let type_id in OutlinerElement.types) {
			let type = OutlinerElement.types[type_id];
			for (let prop_id in type.properties) {
				let property = type.properties[prop_id];
				if (property?.inputs?.element_panel) {
					let {input, onChange} = property?.inputs?.element_panel;
					let input_id = type_id + '_' + prop_id;
					input.condition = {
						selected: {[type_id]: true},
						method: () => Condition(property.condition),
					};
					if (onChange) onchanges.push(onChange);
					form_config[input_id] = input;
				}
			}
		}
		element_properties_panel.form.on('input', ({result}) => {
			let elements = Outliner.selected.slice();
			Undo.initEdit({elements});
			for (let element of elements) {
				for (let key in result) {
					let property_id = key.replace(element.type+'_', '');
					if (element.constructor.properties[property_id]) {
						element[property_id] = result[key];
					}
				}
			}
			Undo.finishEdit('Change element property');
			onchanges.forEach(onchange => onchange(result));
		})
		element_properties_panel.form.buildForm();
	}
	updateElementForm();

	Blockbench.on('register_element_type', () => {
		updateElementForm();
	});
	Blockbench.on('update_selection', () => {
		let values = {};
		for (let type_id in OutlinerElement.types) {
			let type = OutlinerElement.types[type_id];
			let first_element = type.selected[0];
			if (first_element) {
				for (let prop_id in type.properties) {
					let property = type.properties[prop_id];
					if (property?.inputs?.element_panel) {
						let input_id = type_id + '_' + prop_id;
						values[input_id] = first_element[prop_id];
					}
				}
			}
		}
		element_properties_panel.form.setValues(values);
		element_properties_panel.form.update();
	});
	Toolbars.element_origin.node.after(Interface.createElement('div', {id: 'element_origin_toolbar_anchor'}))
})