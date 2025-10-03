interface ParsedVersion {
	string: string
	version: number[]
	beta?: number[]
}

type Operator = '<=' | '==' | '>=' | '>' | '<'

declare namespace VersionUtil {
	function parse(versionString: string): ParsedVersion

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

	/**
	 * Format a version string for display.
	 * E.g. "4.8.0-beta.3" becomes "4.8.0 Beta 3"
	 */
	function format(version: string): string
}

declare interface Window {
	VersionUtil: typeof VersionUtil
}
