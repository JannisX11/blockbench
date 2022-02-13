console.log("%cOrevilleStudios vscode_hook loaded", "border: 2px solid #3e90ff; padding: 4px 8px; font-size: 1.2em;")

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      const dataUrl = reader.result;
      resolve(dataUrl.substring(dataUrl.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function loadModel(name, path, content) {
  const file = { name, path, content };
  Blockbench.drag_handlers.model.cb([file], {});
}

function loadTexture(name, path, content) {
  const file = { name, path, content };
  Blockbench.drag_handlers.texture.cb([file], {});
}

function loadAnimation(name, path, content) {
  const file = { name, path, content };
  Blockbench.drag_handlers.animation.cb([file], {});
}

window.saveAs = async function (blob, name, options) {
  const base64Data = await blobToBase64(blob);
  const message = { type: "save", content: { name: name, data: base64Data } };
  parent.postMessage(message, "*");
};

Blockbench.export = async function (options, cb) {
  var file_name = options.name +
    (options.extensions ? "." + options.extensions[0] : "");

  if (options.custom_writer) {
    options.custom_writer(options.content, file_name);
  } else if (options.savetype === "image") {
    const dataUrl = options.content;
    const base64Data = dataUrl.substring(dataUrl.indexOf(",") + 1);

    parent.postMessage(
      { type: "save", content: { name: file_name, data: base64Data } },
      "*",
    );
  } else if (
    options.savetype === "zip" || options.savetype === "buffer" ||
    options.savetype === "binary"
  ) {
    saveAs(options.content, file_name);
  } else {
    var blob = new Blob(
      [options.content],
      { type: "text/plain;charset=utf-8" },
    );
    saveAs(blob, file_name, { autoBOM: true });
  }
  if (typeof cb === "function") {
    cb(file_name);
  }
};

async function onMessage({ data }) {
    const { models, textures, animations } = JSON.parse(data);
    models.forEach(({name, path, data}) => loadModel(name, path, atob(data)));
    textures.forEach(({name, path, data}) => loadTexture(name, path, `data:image/png;base64,${data}`));
    animations.forEach(({name, path, data}) => loadAnimation(name, path, atob(data)));
}

window.addEventListener("message", onMessage);