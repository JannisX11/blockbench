import fs from 'fs';
import PathModule from 'path'

/**
 * Convert all auto-generated type definitions to declare globally instead of exporting
 */

let file_count = 0;
let file_delete_count = 0;

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
	for (let line of lines) {
		if (global_scope) {
			if (line.startsWith('}') || line.startsWith('  ')) {
				output_lines.push('    ' + line);
			} else if (line.startsWith('export ') && !line.startsWith('export {}')) {
				output_lines.push('    ' + line.substring(7));
			} else {
				output_lines.push('}');
				global_scope = false;
				output_lines.push(line);
			}

		} else if (line.startsWith('export ') && !line.startsWith('export {}')) {
			output_lines.push('declare global {');
			output_lines.push('    ' + line.substring(7));
			global_scope = true;
		} else {
			output_lines.push(line);
		}
		i++;
	}
	let result = output_lines.join('\n');
	return result;
}

function convertDirectory(path) {
	let files = fs.readdirSync(path)
	for (let file_name of files) {
		let file_path = PathModule.join(path, file_name)
		if (file_name.endsWith('.ts')) {
			let file_content = fs.readFileSync(file_path, {encoding: 'utf-8'});
			let modified_file_content = processFile(file_content, file_path);
			if (!modified_file_content) {
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


