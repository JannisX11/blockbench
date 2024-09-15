const fs = require('fs');
const index_path = './index.html';

let package_file = fs.readFileSync(index_path, {encoding: 'utf-8'});

package_file = package_file.replace('manifest.webmanifest', 'manifest-beta.webmanifest');
package_file = package_file.replace('favicon.png', 'icons/favicon_beta.png');

fs.writeFileSync(index_path, package_file, {encoding: 'utf-8'});

console.log('Changed index.html and manifest file to beta');
