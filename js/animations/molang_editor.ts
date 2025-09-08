import { MolangAutocomplete } from './molang'

interface MolangEditorOptions {
	autocomplete_context: MolangAutocomplete.Context
	text: string
}
export function openMolangEditor(options: MolangEditorOptions, callback: (result: string) => void) {
	interface VueData {
		text: string
	}
	let dialog = new Dialog('expression_editor', {
		title: 'menu.text_edit.expression_editor',
		resizable: true,
		width: 800,
		component: {
			components: { VuePrismEditor },
			data: {
				text: options.text,
			},
			methods: {
				prettyPrint(this: VueData) {
					this.text = this.text.replace(/;\s*(?!\n)/g, ';\n')
				},
				minify(this: VueData) {
					this.text = this.text.replace(/\n/g, '').replace(/\s{2,}/g, ' ')
				},
				findReplace(this: VueData) {
					this
					let scope = this
					new Dialog({
						id: 'find_replace',
						title: 'action.find_replace',
						form: {
							find: { label: 'dialog.find_replace.find', type: 'text' },
							replace: { label: 'dialog.find_replace.replace', type: 'text' },
							regex: {
								label: 'dialog.find_replace.regex',
								type: 'checkbox',
								value: false,
							},
						},
						onConfirm(form) {
							if (!form.find) return
							function replace(text: string) {
								if (form.regex) {
									let regex = new RegExp(form.find, 'g')
									return text.replace(regex, form.replace)
								} else {
									return text.split(form.find).join(form.replace)
								}
							}
							scope.text = replace(scope.text)
						},
					}).show()
				},
				autocomplete(text: string, position: number) {
					if (Settings.get('autocomplete_code') == false) return []
					let test = options.autocomplete_context.autocomplete(text, position)
					return test
				},
			},
			template: `
				<div>
					<div class="dialog_bar">
						<button @click="prettyPrint()">${tl('dialog.expression_editor.pretty_print')}</button>
						<button @click="minify()">${tl('dialog.expression_editor.minify')}</button>
						<button @click="findReplace()">${tl('dialog.expression_editor.find_replace')}</button>
					</div>
					<vue-prism-editor
						class="molang_input"
						id="expression_editor_prism"
						v-model="text"
						language="molang"
						:autocomplete="autocomplete"
						:ignoreTabKey="false"
						:line-numbers="true"
					/>
				</div>
			`,
		},
		onOpen() {
			let element = document.querySelector(
				'#expression_editor_prism.molang_input'
			) as HTMLElement
			element.style.height = dialog.object.clientHeight - 50 + 'px'
		},
		onResize() {
			let element = document.querySelector(
				'#expression_editor_prism.molang_input'
			) as HTMLElement
			element.style.height = dialog.object.clientHeight - 50 + 'px'
		},
		onConfirm() {
			callback(dialog.content_vue.$data.text)
		},
	})
	dialog.show()
}
