const fs: typeof import("node:fs") = require('node:fs');
const PathModule: typeof import("node:path") = require('node:path');

/**
 * @internal
 */
export class ScopedFS {
	#scope: string
	constructor(scope: string) {
		this.#scope = scope ? PathModule.resolve(scope) : '';
	}
	#checkPath(path: string) {
		path = PathModule.resolve(path);
		if (path.startsWith(this.#scope) == false) {
			throw `Trying to access path "${path}" outside of scoped file system "${this.#scope}"`;
		}
	}
	public Dir = fs.Dir
	public Dirent = fs.Dirent
	copyFile(src: string, dest: string, mode, callback) {
		this.#checkPath(src);
		this.#checkPath(dest);
		return fs.copyFile(src, dest, mode, callback);
	}
	copyFileSync(src: string, dest: string, mode) {
		this.#checkPath(src);
		this.#checkPath(dest);
		return fs.copyFileSync(src, dest, mode);
	}
	readFile(path: string, options, callback) {
		this.#checkPath(path);
		return fs.readFile(path, options, callback);
	}
	readFileSync(path: string, options) {
		this.#checkPath(path);
		return fs.readFileSync(path, options);
	}
	writeFile(path: string, content, options, callback) {
		this.#checkPath(path);
		return fs.writeFile(path, content, options, callback);
	}
	writeFileSync(path: string, content, options) {
		this.#checkPath(path);
		return fs.writeFileSync(path, content, options);
	}
	appendFile(path: string, content, options, callback) {
		this.#checkPath(path);
		return fs.appendFile(path, content, options, callback);
	}
	appendFileSync(path: string, content, options) {
		this.#checkPath(path);
		return fs.appendFileSync(path, content, options);
	}

	existsSync(path) {
		this.#checkPath(path);
		return fs.existsSync(path);
	}
	mkdir(path: string, options, callback) {
		this.#checkPath(path);
		return fs.mkdir(path, options, callback);
	}
	mkdirSync(path: string, options) {
		this.#checkPath(path);
		return fs.mkdirSync(path, options);
	}
	readdir(path: string, options, callback) {
		this.#checkPath(path);
		return fs.readdir(path, options, callback);
	}
	readdirSync(path: string, options) {
		this.#checkPath(path);
		return fs.readdirSync(path, options);
	}
	rename(oldPath: string, newPath: string, callback) {
		this.#checkPath(oldPath);
		this.#checkPath(newPath);
		return fs.rename(oldPath, newPath, callback);
	}
	renameSync(oldPath: string, newPath: string) {
		this.#checkPath(oldPath);
		this.#checkPath(newPath);
		return fs.renameSync(oldPath, newPath);
	}
	rm(path: string, options, callback) {
		this.#checkPath(path);
		return fs.rm(path, options, callback);
	}
	rmSync(path: string, options) {
		this.#checkPath(path);
		return fs.rm(path, options);
	}
	rmdir(path: string, options, callback) {
		this.#checkPath(path);
		return fs.rmdir(path, options, callback);
	}
	rmdirSync(path: string, options) {
		this.#checkPath(path);
		return fs.rmdirSync(path, options);
	}
	unlink(path: string, callback) {
		this.#checkPath(path);
		return fs.unlink(path, callback);
	}
	unlinkSync(path: string) {
		this.#checkPath(path);
		return fs.unlinkSync(path);
	}
	stat(path: string, callback) {
		this.#checkPath(path);
		return fs.stat(path, callback);
	}
	statSync(path: string) {
		this.#checkPath(path);
		return fs.statSync(path);
	}
	//cp: cp(src, dest, options, callback)
	//cpSync: cpSync(src, dest, options)
	//createReadStream: createReadStream(path, options)
	//createWriteStream: createWriteStream(path, options)
	//fchmod: fchmod(fd, mode, callback)
	//fchmodSync: fchmodSync(fd, mode)
	//fchown: fchown(fd, uid, gid, callback)
	//fchownSync: fchownSync(fd, uid, gid)
	//fdatasync: fdatasync(fd, callback)
	//fdatasyncSync: fdatasyncSync(fd)
	//fstat: fstat(fd, options = { bigint: false }, callback)
	//fstatSync: fstatSync(fd, options = { bigint: false })
	//fsync: fsync(fd, callback)
	//fsyncSync: fsyncSync(fd)
	//ftruncate: ftruncate(fd, len = 0, callback)
	//ftruncateSync: ftruncateSync(fd, len = 0)
	//futimes: futimes(fd, atime, mtime, callback)
	//futimesSync: futimesSync(fd, atime, mtime)
	//lchmod: defined
	//lchmodSync: defined
	//lchown: lchown(path, uid, gid, callback)
	//lchownSync: lchownSync(path, uid, gid)
	//link: link(existingPath, newPath, callback)
	//linkSync: linkSync(existingPath, newPath)
	//lstat: ,e,r)=> {…}
	//lstatSync: ,e)=> {…}
	//lutimes: lutimes(path, atime, mtime, callback)
	//lutimesSync: lutimesSync(path, atime, mtime)
	//mkdtemp: mkdtemp(prefix, options, callback)
	//mkdtempSync: mkdtempSync(prefix, options)
	//open: (...n)
	//openAsBlob: openAsBlob(path, options = kEmptyObject)
	//openSync: (...t)
	//opendir: ..)
	//opendirSync: ..)
	//promises: ..)
	//read: read(fd, buffer, offsetOrOptions, length, position, callback)
	//readSync: readSync(fd, buffer, offsetOrOptions, length, position)
	//readlink: readlink(path, options, callback)
	//readlinkSync: readlinkSync(path, options)
	//readv: readv(fd, buffers, position, callback)
	//readvSync: readvSync(fd, buffers, position)
	//realpath: (e,r,s)
	//realpathSync: (e,r)
	//statfs: statfs(path, options = { bigint: false }, callback)
	//statfsSync: statfsSync(path, options = { bigint: false })
	//symlink: symlink(target, path, type_, callback_)
	//symlinkSync: symlinkSync(target, path, type)
	//truncate: truncate(path, len, callback)
	//truncateSync: truncateSync(path, len)
	//unwatchFile: unwatchFile(filename, listener)
	//utimes: utimes(path, atime, mtime, callback)
	//utimesSync: utimesSync(path, atime, mtime)
	//watch: watch(filename, options, listener)
	//watchFile: watchFile(filename, options, listener)
	//write: write(fd, buffer, offsetOrOptions, length, position, callback)
	//writeSync: writeSync(fd, buffer, offsetOrOptions, length, position)
	//writev: writev(fd, buffers, position, callback)
	//writevSync: writevSync(fd, buffers, position)
}