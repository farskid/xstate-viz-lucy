import createModule from "./liblucy-debug-browser.mjs";
import init from "./liblucy.mjs";

export let compileXstate;

export let ready = init(createModule).then((exports) => {
  compileXstate = exports.compileXstate;
});
