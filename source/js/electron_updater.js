showDialog('updater')
$('#updater h2').text('Updating Electron. Please wait...')
var received_bytes = 0;
var total_bytes = 0;

$('.uc_btn').attr('disabled', true)

var installer_path = __dirname
installer_path = installer_path.replace('app.asar', 'bbstp.exe')

var file = originalFs.createWriteStream(installer_path)

var request = http.get("http://blockbench.net/api/bbstp.exe", function(response) {
    response.pipe(file);

    total_bytes = parseInt(response.headers['content-length']);

    response.on('data', function(chunk) {
        received_bytes += chunk.length;
        setProgressBar('update_bar', received_bytes / total_bytes, 1);
    })
    response.on('end', function() {
        $('#updater h2').text('Painting cubes...')
        setProgressBar('update_bar', 0, 1);
        setProgressBar('update_bar', 1, 12000);

        setTimeout(function() {
            exec(installer_path)
            preventClosing = false
            app.getCurrentWindow().close()
        }, 11111)
    })
});