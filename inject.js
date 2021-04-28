function injectScript(file_path, tag, type = "text/javascript", text) {
  var node = document.getElementsByTagName(tag)[0];
  var script = document.createElement("script");
  script.setAttribute("type", type);
  if (file_path) {
    script.setAttribute("src", file_path);
  }
  if (text) {
    script.textContent = text;
  }
  node.appendChild(script);
}

injectScript(
  null,
  "body",
  "module",
  `import { compileXstate, ready } from '${chrome.extension.getURL(
    "lucy/main-browser-dev.js"
  )}';
  import {createMachine, Machine, interpret, assign} from 'https://cdn.skypack.dev/xstate@latest';
  import debounce from '${chrome.extension.getURL("debounce.js")}';


const editorMachine = Machine(
  {
    initial: "setup",
    context: {
      lucy: "",
      js: "",
      editor: null,
      editorSession: null,
      updateBtn: null,
      dd: null,
    },
    on: {
      SWITCH_TO_JS: ".js",
      SWITCH_TO_LUCY: ".lucy",
      VIZ: { actions: ["updateViz"] },
    },
    states: {
      setup: {
        entry: ["insertSourceButton", "registerEditorEvents"],
        always: 'js'
      },
      js: {
        entry: ["insertOldCodeButton", "printJS", "setJSToDD"],
        on: {
          CODE: {
            actions: "saveJS",
          },
        }
      },
      lucy: {
        entry: ["insertNewCodeButton", "printLucy", "setLucyToDD"],
        on: {
          COMPILE: {
            target: "js",
            actions: ["compileCode"],
          },
          VIZ: {
            actions: ['updateViz']
          },
          CODE: {
            actions: ["saveLucy"],
          },
        },
      },
    },
  },
  {
    actions: {
      insertOldCodeButton,
      insertNewCodeButton,
      insertSourceButton: assign({
        dd: () => {
          return insertSourceButton();
        }
      }),
      registerEditorEvents,
      saveLucy: assign({
        lucy: (ctx) => ctx.editorSession.getValue(),
      }),
      saveJS: assign({
        js: (ctx) => ctx.editorSession.getValue(),
      }),
      printLucy: (ctx) => {
        ctx.editorSession.setValue(ctx.lucy);
      },
      printJS: (ctx) => {
        ctx.editorSession.setValue(ctx.js);
      },
      compileCode: assign({
        js: (ctx) => compile(ctx.lucy) || '',
      }),
      updateViz: assign((ctx) => {
        console.log(ctx)
        ctx.updateBtn.click();
        const {editor, editorSession} = createEditor();
        const updateBtn = getUpdateBtnRef()
        return { updated: (ctx.updated || 0) + 1, editor, editorSession, updateBtn };
      }),
      setJSToDD: (ctx) => {
        ctx.dd.value = "js";
      },
      setLucyToDD: (ctx) => {
        ctx.dd.value = "lucy";
      },
      saveDDRef: assign({
        dd: () => {
          console.log(document.getElementById("dd"));
          return document.getElementById("dd");
        },
      }),
    },
  }
);

const editor = ace.edit("brace-editor");
const editorSession = editor.getSession();
// editorSession.setValue();
var editorService = interpret(
  editorMachine.withContext({
    editor,
    editorSession,
    updateBtn: document.querySelector("button[data-variant=secondary]")
  }),
  {devTools: true}
);
window.debug = () => editorService.state;
const send = (duration = 300) => debounce(editorService.send, duration);

async function run() {
  await ready;

  editorService.onEvent((evt) => {
    console.log(evt);
  });
  editorService.start();
}

const onEditorChange = () => {
  editorService.send('CODE');
}
function createEditor() {
  editorService.state.context.editorSession.off('change', onEditorChange);
  const editor = window.ace.edit("brace-editor");
  const editorSession = editor.getSession();
  editorSession.on('change', onEditorChange);
  return {editor, editorSession}
}

function getUpdateBtnRef() {
  return document.querySelector('[data-variant=secondary]')
}

function registerEditorEvents() {
  const s = send(500);
  editorSession.on("change", () => {
    editorService.send({ type: "CODE" });
  });
}

function insertSourceButton() {
  const hideBtn = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent.toLowerCase() == "hide"
  );
  const select = document.createElement("select");
  select.id = "dd";
  const options = ["js", "lucy"];
  options.forEach((lang) => {
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = lang;
    select.appendChild(opt);
  });

  const langToEvent = {
    js: "SWITCH_TO_JS",
    lucy: "SWITCH_TO_LUCY",
  };
  select.addEventListener("change", () => {
    editorService.send(langToEvent[options[select.selectedIndex]]);
  });

  select.setAttribute(
    "style",
    "position: absolute;top: 100px;right: 0px;width: 70px;z-index: 2;display: inline-block;height: 30px;background-color: white;opacity: 0.7;text-transform: uppercase;font-weight: bold;"
  );

  hideBtn.parentNode.appendChild(select);
  return select;
}

function insertOldCodeButton() {
  console.log("insertOldCodeButton run");
  const btn = document.getElementById("new-code-button");
  if (!btn) {
    return;
  }
  const originalBtn = Array.from(btn.parentNode.children).find(
    (b) => b.textContent.toLowerCase() == "update"
  );

  btn.remove();
  originalBtn.style.opacity = 1;
  originalBtn.style.position = "relative";
}

function insertNewCodeButton() {
  console.log("insertNewCodeButton run");
  const btn = document.querySelector("button[data-variant=secondary]");
  const cloned = btn.cloneNode(true);
  cloned.id = "new-code-button";
  cloned.textContent = "Compile";

  btn.style.opacity = 0;
  btn.style.position = "absolute";

  cloned.addEventListener("click", () => {
    editorService.send("COMPILE");
    setTimeout(() => {
      editorService.send('VIZ');
    }, 0)
  });

  btn.parentNode.insertBefore(cloned, btn.parentNode.firstChild);
  console.log("update button should be inserted now");
}

function compile(input) {
  console.log({ input });
  try {
    const js = compileXstate(input, "input.lucy");
    console.log(removeImports(js));
    return removeImports(js);
  } catch (err) {
    console.log('COMPILE ERROR', err);
    return '// Compile error'
  }
}

function removeImports(code) {
  return code.replace(/import.+\\n/, "").replaceAll('export default ', '').replaceAll("export ", "");
}

run();`
);
