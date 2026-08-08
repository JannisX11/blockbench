import {setTimeout as wait} from 'node:timers/promises'

import {removeHeadlessCLIProfile} from './headless_cli.js'

const profile_path = process.argv[2]
const parent_pid = Number(process.argv[3])

if (!profile_path || !Number.isInteger(parent_pid) || parent_pid <= 0) {
	process.exit(2)
}

function isParentRunning() {
	try {
		process.kill(parent_pid, 0)
		return true
	} catch (error) {
		return false
	}
}

// Chromium releases profile database and cache handles only after its parent
// exits. Bound both waits so a failed cleanup can never become a stray daemon.
for (let attempt = 0; attempt < 300 && isParentRunning(); attempt++) {
	await wait(100)
}

for (let attempt = 0; attempt < 50; attempt++) {
	try {
		removeHeadlessCLIProfile(profile_path)
		process.exit(0)
	} catch (error) {
		await wait(100)
	}
}

process.exit(1)
