const fs = require("fs");
const pather = require("path");
const crypto = require("crypto");
const mutex = require("./mutex");
const cleaner = require("./cleaner");
const launcher = require("./launcher");
const { configure, synchronize } = require("./config");
const { setup, fetch, versions, setEngineOptions } = require("./connector");
const {
  defaultArgs,
  getProfilePath,
  validateConfig,
  validateLauncher,
} = require("./utils");

module.exports = class FingerprintPlugin {
  static create(launcher) {
    validateLauncher(launcher);
    return new this(launcher);
  }

  constructor(launcher) {
    this.launcher = launcher;
    this.version = "default";
  }

  useFingerprint(value = "", options = {}) {
    validateConfig("fingerprint", value, options);

    this.fingerprint = { value, options };
    return this;
  }

  useProfile(value = "", options = {}) {
    validateConfig("profile", value, options);

    this.profile = { value, options };
    return this;
  }

  useProxy(value = "", options = {}) {
    validateConfig("proxy", value, options);

    this.proxy = { value, options };
    return this;
  }

  useBrowserVersion(version = null) {
    this.version = version;
    return this;
  }

  setProxyFromArguments(args = []) {
    if (this.proxy == null) {
      for (const arg of args) {
        if (arg.includes("--proxy-server")) {
          return this.useProxy(arg.slice(15));
        }
      }
    }

    return this;
  }

  setRequestTimeout(timeout = 0) {
    setEngineOptions({ timeout });
  }

  setWorkingFolder(folder = "") {
    setEngineOptions({ folder });
  }

  loadDetails(filePath) {
    if (fs.existsSync(filePath)) {
      // Read the JSON file and parse its contents
      const data = fs.readFileSync(filePath, "utf8");
      const details = JSON.parse(data);
      return details;
    } else {
      console.log("No Allory FPT file found at", filePath);
      return null;
    }
  }

  async #run(spawn, options = {}) {
    const { proxy, fingerprint } = this.setProxyFromArguments(options.args);
    let pid,
      id,
      path,
      bounds,
      pwd,
      config = undefined;

    const basePath = getProfilePath(options);
    const savePath = pather.join(basePath, "fptAlloryDetails.json");

    if (!fs.existsSync(savePath)) {
      let details = await setup(proxy, fingerprint, {
        version: this.version,
        profile: this.profile ?? {
          options: {
            loadProxy: true,
            loadFingerprint: true,
          },
          value: getProfilePath(options),
        },
        pid: crypto.randomUUID(),
        key: options.key,
      });
      fs.writeFileSync(savePath, JSON.stringify(details, null, 2), "utf8");
      ({ id, pid, pwd, path, bounds, ...config } = details);
    } else {
      let details = this.loadDetails(savePath);
      ({ id, pid, pwd, path, bounds, ...config } = details);
    }

    await cleaner.run(path).ignore(pid, id);
    mutex.create(`BASProcess${pid}`);

    const launc = launcher;
    // console.log(launc.launch);
    // //let options = { headless: false, userDataDir: './testing/' }

    // console.log(options);
    // console.log(bounds);
    // console.log(pwd);
    // console.log(config);
    // console.log(path);
    const browser = await launc.launch({
      ...options,
      headless: false,
      userDataDir: null,
      defaultViewport: null,
      executablePath: `${path}/worker.exe`,
      args: [
        `--parent-process-id=${pid}`,
        `--unique-process-id=${id}`,
        ...defaultArgs({ ...options, ...config }),
      ],
    });

    await (spawn ? configure : this.configure.bind(this))(
      () => cleaner.include(pid, id),
      browser,
      bounds,
      synchronize.bind(null, id, pwd, bounds)
    );

    return browser;
  }

  async versions(format = "default") {
    return await versions(format /* value */);
  }

  async fetch(key, options = {}) {
    const config = { version: this.version };
    return await fetch(key, options, config);
  }

  async launch(options = {}) {
    return await this.#run(false, options);
  }

  async spawn(options = {}) {
    return await this.#run(true, options);
  }
};
