const fs: typeof import("node:fs") = require('node:fs');
const PathModule: typeof import("node:path") = require('node:path');

/**
 * @internal
 */
export function createScopedFS(scope?: string) {
	const scope_path = scope ? PathModule.resolve(scope) : '';
	function checkPath(path: string) {
		path = PathModule.resolve(path);
		if (path.startsWith(scope_path) == false) {
			throw `Trying to access path "${path}" outside of scoped file system "${scope_path}"`;
		}
	}
	return {
		scope: scope_path,
		access(path: string, mode, callback) {
			checkPath(path);
			return fs.access(path, mode, callback);
		},
		accessSync(path: string, mode) {
			checkPath(path);
			return fs.accessSync(path, mode);
		},
		copyFile(src: string, dest: string, mode, callback) {
			checkPath(src);
			checkPath(dest);
			return fs.copyFile(src, dest, mode, callback);
		},
		copyFileSync(src: string, dest: string, mode) {
			checkPath(src);
			checkPath(dest);
			return fs.copyFileSync(src, dest, mode);
		},
		readFile(path: string, options, callback) {
			checkPath(path);
			return fs.readFile(path, options, callback);
		},
		readFileSync(path: string, options) {
			checkPath(path);
			return fs.readFileSync(path, options);
		},
		writeFile(path: string, content, options, callback) {
			checkPath(path);
			return fs.writeFile(path, content, options, callback);
		},
		writeFileSync(path: string, content, options) {
			checkPath(path);
			return fs.writeFileSync(path, content, options);
		},
		appendFile(path: string, content, options, callback) {
			checkPath(path);
			return fs.appendFile(path, content, options, callback);
		},
		appendFileSync(path: string, content, options) {
			checkPath(path);
			return fs.appendFileSync(path, content, options);
		},
		existsSync(path) {
			checkPath(path);
			return fs.existsSync(path);
		},
		mkdir(path: string, options, callback) {
			checkPath(path);
			return fs.mkdir(path, options, callback);
		},
		mkdirSync(path: string, options) {
			checkPath(path);
			return fs.mkdirSync(path, options);
		},
		readdir(path: string, options, callback) {
			checkPath(path);
			return fs.readdir(path, options, callback);
		},
		readdirSync(path: string, options) {
			checkPath(path);
			return fs.readdirSync(path, options);
		},
		rename(oldPath: string, newPath: string, callback) {
			checkPath(oldPath);
			checkPath(newPath);
			return fs.rename(oldPath, newPath, callback);
		},
		renameSync(oldPath: string, newPath: string) {
			checkPath(oldPath);
			checkPath(newPath);
			return fs.renameSync(oldPath, newPath);
		},
		rm(path: string, options, callback) {
			checkPath(path);
			return fs.rm(path, options, callback);
		},
		rmSync(path: string, options) {
			checkPath(path);
			return fs.rm(path, options);
		},
		rmdir(path: string, options, callback) {
			checkPath(path);
			return fs.rmdir(path, options, callback);
		},
		rmdirSync(path: string, options) {
			checkPath(path);
			return fs.rmdirSync(path, options);
		},
		unlink(path: string, callback) {
			checkPath(path);
			return fs.unlink(path, callback);
		},
		unlinkSync(path: string) {
			checkPath(path);
			return fs.unlinkSync(path);
		},
		stat(path: string, options, callback) {
			checkPath(path);
			return fs.stat(path, options, callback);
		},
		statSync(path: string, options) {
			checkPath(path);
			return fs.statSync(path, options);
		},

		promises: {
			access(path: string, mode) {
				checkPath(path);
				return fs.access(path, mode);
			},
			copyFile(src: string, dest: string, mode) {
				checkPath(src);
				checkPath(dest);
				return fs.promises.copyFile(src, dest, mode);
			},
			readFile(path: string, options) {
				checkPath(path);
				return fs.promises.readFile(path, options);
			},
			writeFile(path: string, content, options) {
				checkPath(path);
				return fs.promises.writeFile(path, content, options);
			},
			appendFile(path: string, content, options) {
				checkPath(path);
				return fs.promises.appendFile(path, content, options);
			},
			mkdir(path: string, options) {
				checkPath(path);
				return fs.promises.mkdir(path, options);
			},
			readdir(path: string, options) {
				checkPath(path);
				return fs.promises.readdir(path, options);
			},
			rename(oldPath: string, newPath: string) {
				checkPath(oldPath);
				checkPath(newPath);
				return fs.promises.rename(oldPath, newPath);
			},
			rm(path: string, options) {
				checkPath(path);
				return fs.promises.rm(path, options);
			},
			rmdir(path: string, options) {
				checkPath(path);
				return fs.promises.rmdir(path, options);
			},
			unlink(path: string) {
				checkPath(path);
				return fs.promises.unlink(path);
			},
			stat(path: string, options) {
				checkPath(path);
				return fs.promises.stat(path, options);
			}
		}
	}
}
