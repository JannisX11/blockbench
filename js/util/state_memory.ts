const StateMemory = {
	/**
	 * Initialize a memorized property
	 */
	init(key: string, type: 'string' | 'number' | 'boolean' | 'object' | 'array') {
		let saved: any = localStorage.getItem(`StateMemory.${key}`)
		if (typeof saved == 'string') {
			try {
				saved = JSON.parse(saved)
			} catch (err) {
				localStorage.removeItem(`StateMemory.${key}`)
			}
		}
		if (
			saved !== null &&
			(typeof saved == type || (type == 'array' && saved instanceof Array))
		) {
			StateMemory[key] = saved
		} else {
			StateMemory[key] = (() => {
				switch (type) {
					case 'string':
						return ''
						break
					case 'number':
						return 0
						break
					case 'boolean':
						return false
						break
					case 'object':
						return {}
						break
					case 'array':
						return []
						break
				}
			})()
		}
	},
	set(key: string, value) {
		if (StateMemory[key] instanceof Array) {
			StateMemory[key].replace(value)
		} else {
			StateMemory[key] = value
		}
		StateMemory.save(key)
	},
	save(key: string) {
		let serialized = JSON.stringify(StateMemory[key])
		localStorage.setItem(`StateMemory.${key}`, serialized)
	},
	get(key: string): string | number | [] | boolean | any {
		return StateMemory[key]
	},
}
export default StateMemory

Object.assign(window, {
	StateMemory,
})
