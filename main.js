const Plugin = require("./bas-allory-rewrite/index");
const { readFile, writeFile } = require("fs/promises");

const plugin = new Plugin(/* */);

async function init() {
  plugin.useFingerprint(await readFile("fingerprint.json", "utf8"));
  console.time("Load speed test");
  const chrome = await plugin.spawn({
    headless: false,
    userDataDir: "./testing/",
  });
  console.log(chrome.url);
  console.timeEnd("Load speed test");
  //connect with puppeteer connect.
}
init();
