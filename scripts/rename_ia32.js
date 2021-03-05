const fs = require('fs');
const package_path = './package.json';

let package_file = fs.readFileSync(package_path, {encoding: 'utf-8'});
let package = JSON.parse(package_file);

package.build.artifactName = "${productName}_32bit_${version}.${ext}";

package_file = JSON.stringify(package, null, '\t');
fs.writeFileSync(package_path, package_file, {encoding: 'utf-8'});

console.log('Changed artifactName for 32bit build');
