const VERSION_REGEX = /^(?<version>[\d.]+)(?:-beta\.(?<beta>[\d\.]+))?$/

interface ParsedVersion {
	string: string
	version: number[]
	beta?: number[]
}

type Operator = '<=' | '==' | '>=' | '>' | '<'

function parse(versionString: string): ParsedVersion {
	const match = versionString.match(VERSION_REGEX)

	if (!match) {
		throw new Error(
			`Invalid version format '${versionString}'.` +
				"Expected a list of dot-separated numbers, optionally followed by '-beta.' " +
				"and another list of dot-separated numbers. E.g. '1.2.3' or '1.2.3-beta.4'"
		)
	}

	const { version, beta } = match.groups
	return {
		string: versionString,
		version: version.split('.').map(v => parseInt(v)),
		beta: beta ? beta.split('.').map(v => parseInt(v)) : undefined,
	}
}

/**
 * Compare two version strings.
 * @returns 0 if equal, -1 if versionA < versionB, 1 if versionA > versionB
 */
function compare(versionA: string, versionB: string): number
/**
 * Compare two version strings with an operator.
 * @returns true if the comparison is true, false otherwise
 */
function compare(versionA: string, operator: Operator, versionB: string): boolean
function compare(versionA: string, operator?: Operator, versionB?: string): boolean | number {
	// If only two arguments are provided, treat the second as versionB and return the comparison result.
	if (versionB === undefined) {
		versionB = operator
		operator = undefined
	}

	let result = 0

	if (versionA !== versionB) {
		const parsedA = parse(versionA)
		const parsedB = parse(versionB)

		const maxLength = Math.max(parsedA.version.length, parsedB.version.length)
		for (let i = 0; i < maxLength; i++) {
			const a = parsedA.version.at(i) ?? 0
			const b = parsedB.version.at(i) ?? 0

			if (a > b) {
				result = 1
				break
			}

			if (a < b) {
				result = -1
				break
			}
		}

		// If the main versions are equal, compare beta versions.
		if (result === 0) {
			if (parsedA.beta && !parsedB.beta) {
				result = 1
			} else if (!parsedA.beta && parsedB.beta) {
				result = -1
			} else if (parsedA.beta && parsedB.beta) {
				result = compare(parsedA.beta.join('.'), parsedB.beta.join('.'))
			}
		}
	}

	switch (operator) {
		case '==':
			return result === 0
		case '<=':
			return result <= 0
		case '>=':
			return result >= 0
		case '<':
			return result === -1
		case '>':
			return result === 1
		// No comparison argument was provided, just return the comparison result
		case undefined:
			return result
		default:
			throw new Error(
				`Invalid version comparison operator '${operator}'. Expected one of '<=', '==', '>=', '>', '<'.`
			)
	}
}

function format(version: string): string {
	return version.replace('-beta.', ' Beta ')
}

// Backwards compatability
window.compareVersions = (versionA: string, versionB: string) => compare(versionA, '>', versionB)

const versionUtil = {
	compare,
	parse,
	format,
}

declare global {
	interface Window {
		versionUtil: typeof versionUtil
	}
}
window.versionUtil = versionUtil

export default versionUtil
