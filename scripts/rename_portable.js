import fs from 'fs';
const package_path = './package.json';

let package_file = fs.readFileSync(package_path, {encoding: 'utf-8'});
let pkg = JSON.parse(package_file);

pkg.build.win.artifactName = "${productName}_${version}_portable.${ext}";

package_file = JSON.stringify(pkg, null, '\t');
fs.writeFileSync(package_path, package_file, {encoding: 'utf-8'});

console.log('Changed artifactName for portable build');
