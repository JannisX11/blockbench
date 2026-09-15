import { Dialog } from './interface/dialog';
import { Action } from './interface/actions';
import { Animation } from './animations/animation';

BARS.defineActions(() => {
	let find_replace_dialog = new Dialog({
		id: 'find_replace',
		title: 'action.find_replace',
		form: {
			target: {label: 'dialog.find_replace.target', type: 'select', options: {
				element_names: 'dialog.find_replace.target.element_names',
				group_names: 'dialog.find_replace.target.group_names',
				animation_names: 'dialog.find_replace.target.animation_names',
				keyframe_values: 'dialog.find_replace.target.keyframe_values',
			}},
			find: {label: 'dialog.find_replace.find', type: 'text'},
			replace: {label: 'dialog.find_replace.replace', type: 'text'},
			regex: {label: 'dialog.find_replace.regex', type: 'checkbox', value: false},
		},
		onConfirm(form) {
			if (!form.find) return;
			function replace(name) {
				if (form.regex) {
					let regex = new RegExp(form.find, 'g');
					return name.replace(regex, form.replace);
				} else {
					return name.split(form.find).join(form.replace);
				}
			}
			if (form.target == 'element_names') {
				let elements = (Outliner.selected.length ? Outliner.selected : Outliner.elements);
				Undo.initEdit({elements});
				elements.forEach(element => {
					element.name = replace(element.name);
					element.sanitizeName();
					if (Condition(element.getTypeBehavior('unique_name'))) {
						element.createUniqueName();
					}
				})
			}
			if (form.target == 'group_names') {
				let groups = Group.first_selected ? Group.all.filter(g => g.selected) : Group.all;
				Undo.initEdit({groups});
				groups.forEach(group => {
					group.name = replace(group.name);
					group.sanitizeName();
					if (Condition(group.getTypeBehavior('unique_name'))) {
						group.createUniqueName();
					}
				})
			}
			if (form.target == 'animation_names') {
				let animations = Animation.all;
				Undo.initEdit({animations});
				animations.forEach(animation => {
					animation.name = replace(animation.name);
					animation.createUniqueName();
				})
			}
			if (form.target == 'keyframe_values') {
				let keyframes = [];
				if (Timeline.selected.length) {
					keyframes = Timeline.selected;
				
				} else if (Animation.selected) {
					for (let key in Animation.selected.animators) {
						keyframes.push(...Animation.selected.animators[key].keyframes);
					}
				}
				Undo.initEdit({keyframes});
				keyframes.forEach(keyframe => {
					keyframe.data_points.forEach(datapoint => {
						if (datapoint.x != undefined) datapoint.x = replace(datapoint.x.toString());
						if (datapoint.y != undefined) datapoint.y = replace(datapoint.y.toString());
						if (datapoint.z != undefined) datapoint.z = replace(datapoint.z.toString());

						if (datapoint.effect) datapoint.effect = replace(datapoint.effect);
						if (datapoint.locator) datapoint.locator = replace(datapoint.locator);
						if (datapoint.script) datapoint.script = replace(datapoint.script);
					})
				})
			}
			Undo.finishEdit('Find/replace')
		}
	})
	new Action('find_replace', {
		icon: 'find_replace',
		category: 'edit',
		click: function () {
			find_replace_dialog.show();
		}
	})
})

declare global {
	interface BarItemRegistry {
		find_replace: Action
	}
}