/// <reference path="./blockbench.d.ts"/>
/**
 * The validator in Blockbench provides feedback about the model and can detect issues in real time, based on a list of checks that can be added. This is a good way to ensure model files are valid, and to teach users about best practices.
 */
declare namespace Validator {
	const checks: ValidatorCheck[]

	const warnings: WarningOrError[]
	const errors: WarningOrError[]
	/**
	 * Run the validator
	 * @param trigger ID of the Blockbench event that triggered the call
	 */
	function validate(trigger?: EventName): void
	/**
	 * Opens the Validator dialog
	 */
	function openDialog(): void

	/**
	 * Cached trigger IDs
	 */
	const triggers: EventName[]
	/**
	 * Update the cached triggers list
	 */
	function updateCashedTriggers(): void
}

interface ValidatorCheckOptions {
	/**
	 * Function that runs when the validator check runs
	 */
	run(): void
	/**
	 * Names of events that automatically trigger this check
	 */
	update_triggers?: EventName[]
	condition?: ConditionResolvable
}
interface WarningOrError {
	message: string
	buttons?: {
		name: string
		icon: IconString
		click(): void
	}[]
}

/**
 * A check for the validator. A check can be triggered by certain things, and updates the list of warnings and errors that can be displayed in the status bar.


### Example:

```javascript
	new ValidatorCheck('special_cube_name_rule', {
		update_triggers: ['update_selection'],
		run() {
			Cube.all.forEach(cube => {
				if (cube.name == 'sphere') {
					this.warn({
						message: `The cube "${cube.name}" has an invalid names. Cubes may not be called "sphere".`,
						buttons: [
							{
								name: 'Select Cube',
								icon: 'fa-cube',
								click() {
									Validator.dialog.hide();
									cube.select();
								}
							}
						]
					})
				}
			})
		}
	})
```
 */
declare class ValidatorCheck extends Deletable {
	id: string
	name: string
	plugin?: string
	constructor(id: string, options: ValidatorCheckOptions)

	/**
	 * Manually run this check
	 */
	update(): void
	/**
	 * Throw a warning. This is intended to be used inside the run() method
	 */
	warn(...warnings: WarningOrError[]): void
	/**
	 * Throw an error. This is intended to be used inside the run() method
	 */
	fail(...warnings: WarningOrError[]): void
}
