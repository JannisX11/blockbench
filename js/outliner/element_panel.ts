import { Blockbench } from "../api";
import { InputForm } from "../interface/form";
import { Interface } from "../interface/interface";
import { Panel } from "../interface/panels";
import { Property } from "../util/property";

Interface.definePanels(function() {
	new Panel('transform', {
		icon: 'arrows_output',
		condition: {
			modes: ['edit', 'pose'],
			method: () => !(Blockbench.isMobile && Settings.get('status_bar_transform_sliders'))
		},
		display_condition: () => Outliner.selected.length || Group.first_selected,
		min_height: 90,
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400,
			sidebar_index: 1,
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
		icon: 'fas.fa-cube',
		condition: {modes: ['edit']},
		display_condition: () => Outliner.selected.length || Group.first_selected,
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400,
			attached_to: 'transform',
			attached_index: 1,
			sidebar_index: 2,
		},
		form: new InputForm({})
	})
	function updateElementForm() {
		const {form_config} = element_properties_panel.form;
		for (let key in form_config) {
			delete form_config[key];
		}
		let onchanges = {};
		let registerInput = (type_id: string, prop_id: string, property: Property<any>) => {
			if (!property?.inputs?.element_panel) return;
			let {input, onChange} = property.inputs.element_panel;
			let input_id = type_id + '__' + prop_id;
			input.condition = {
				selected: {[type_id]: true},
				method: () => Condition(property.condition),
			};
			if (onChange) onchanges[input_id] = onChange;
			form_config[input_id] = input;
		}
		for (let type_id in OutlinerElement.types) {
			let type = OutlinerElement.types[type_id];
			for (let prop_id in type.properties) {
				registerInput(type_id, prop_id, type.properties[prop_id]);
			}
		}
		for (let prop_id in Group.properties) {
			let property = Group.properties[prop_id];
			if (property?.inputs?.element_panel) {
				registerInput('group', prop_id, Group.properties[prop_id]);
			}
		}
		element_properties_panel.form.events?.input?.empty();
		element_properties_panel.form.on('input', ({result, changed_keys}) => {
			// Only one key should be changed at a time
			if (changed_keys[0]?.startsWith('group_')) {
				let groups = Group.multi_selected;
				Undo.initEdit({groups});
				for (let key of changed_keys) {
					for (let group of groups) {
						let property_id = key.replace(group.type+'__', '');
						// @ts-ignore
						if (group.constructor.properties?.[property_id]) {
							group[property_id] = result[key];
						}
					}
					if (onchanges[key]) onchanges[key](result[key], groups)
				}
				Undo.finishEdit('Change group property');
			} else {
				let elements = Outliner.selected.slice();
				Undo.initEdit({elements});
				for (let key of changed_keys) {
					for (let element of elements) {
						let property_id = key.replace(element.type+'__', '');
						// @ts-ignore
						if (element.constructor.properties?.[property_id]) {
							element[property_id] = result[key];
						}
					}
					if (onchanges[key]) onchanges[key](result[key], elements)
				}
				Undo.finishEdit('Change element property');
			}
		})
		element_properties_panel.form.buildForm();
		updateSelection();
	}
	updateElementForm();

	Blockbench.on('register_element_type', () => {
		updateElementForm();
	});
	let timeout: NodeJS.Timeout | undefined;
	Blockbench.on('loaded_plugin', () => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			updateElementForm();
			timeout = undefined;
		}, 50);
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
						let input_id = type_id + '__' + prop_id;
						if (typeof first_element[prop_id] === "object") { // Prevent object properties from using the same objects across elements.
							values[input_id] = {...first_element[prop_id]};
						}
						else {
							values[input_id] = first_element[prop_id];
						}
					}
				}
			}
		}
		if (Group.multi_selected.length) {
			for (let prop_id in Group.properties) {
				let property = Group.properties[prop_id];
				if (property?.inputs?.element_panel) {
					let input_id = 'group__' + prop_id;
					values[input_id] = Group.first_selected[prop_id];
				}
			}
		}
		element_properties_panel.form.setValues(values);
		element_properties_panel.form.update(values);
		element_properties_panel.form.updateLabelWidth(true);
	});
	Toolbars.element_origin.node.after(Interface.createElement('div', {id: 'element_origin_toolbar_anchor'}))
})