import fs from 'fs';
import PathModule from 'path'

/**
 * Convert all auto-generated type definitions to declare globally instead of exporting
 * Removes empty files and excluded files
 */

let file_count = 0;
let file_delete_count = 0;

const config = JSON.parse(fs.readFileSync('./types/type_config.json', 'utf-8'));

function isComment(line) {
	return line.startsWith('/*') || line.startsWith(' *') || line.startsWith('//');
}

/**
 * 
 * @param {string} content 
 * @param {string} path 
 */
function processFile(content, path) {
	// TODO: Handle comments
	let lines = content.split(/\r?\n/);
	let output_lines = [];
	let i = 0;
	let global_scope = false;
	let comment_stash = [];
	for (let line of lines) {
		if (global_scope) {
			if (line.startsWith('}') || line.startsWith('  ')) {
				output_lines.push('    ' + line);
			} else if (line.startsWith('export ') && !line.startsWith('export {}')) {
				for (let comment of comment_stash) {
					output_lines.push('    ' + comment);
				}
				comment_stash.length = 0;
				let shorter_line = line.replace(/^export (default )?/, '');
				output_lines.push('    ' + shorter_line);
				
			} else if (isComment(line)) {
				// Comment
				comment_stash.push(line);
			 } else {
				output_lines.push('}');
				global_scope = false;
				output_lines.push(line);
			}

		} else if (line.startsWith('export ') && !line.startsWith('export {}')) {
			output_lines.push('declare global {');
			for (let comment of comment_stash) {
				output_lines.push('    ' + comment);
			}
			comment_stash.length = 0;
			let shorter_line = line.replace(/^export (default )?/, '');
			output_lines.push('    ' + shorter_line);
			global_scope = true;

		} else if (isComment(line)) {
			// Comment
			comment_stash.push(line);

		} else {
			if (comment_stash.length) {
				output_lines.push(...comment_stash);
				comment_stash.length = 0;
			}
			if (line) output_lines.push(line);
		}
		i++;
	}
	if (output_lines.includes('export {};') == false) {
		output_lines.push('export {};');
	}
	output_lines.push('');
	let result = output_lines.join('\n');
	return result;
}

function convertDirectory(path) {
	let files = fs.readdirSync(path)
	for (let file_name of files) {
		let file_path = PathModule.join(path, file_name)
		let simple_file_path = file_path.replace(/[\\\/]/g, '/').replace(/\.d\.ts$/, '');

		if (file_name.endsWith('.ts')) {
			let file_content = fs.readFileSync(file_path, {encoding: 'utf-8'});
			let modified_file_content = processFile(file_content, file_path);
			if (
				!modified_file_content ||
				modified_file_content.replace('export {};', '').length < 5 ||
				config.exclude.find(exclusion => simple_file_path.endsWith(exclusion))
			) {
				fs.unlinkSync(file_path);
				file_delete_count++;
			} else if (modified_file_content != file_content) {
				fs.writeFileSync(file_path, modified_file_content, {encoding: 'utf-8'});
				console.log('Update '+file_path)
				file_count++;
			}
		} else {
			convertDirectory(file_path);
		}
	}
}
convertDirectory('./types/generated');


console.log(`Converted ${file_count} type definition files, deleted ${file_delete_count} empty files`);


