import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";

const isWindows = process.platform === "win32";
const projectRoot = process.cwd();
const HOST = "127.0.0.1";
const FIRST_PORT = 1421;
const LAST_PORT = 1440;

function spawnNpmRun(scriptName, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  if (isWindows) {
    const comspec = process.env.ComSpec || process.env.COMSPEC || "C:\\Windows\\System32\\cmd.exe";
    return spawn(comspec, ["/d", "/s", "/c", `npm run ${scriptName}`], {
      cwd: projectRoot,
      stdio: "inherit",
      env,
      windowsHide: false,
    });
  }

  return spawn("npm", ["run", scriptName], {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });
}

function electronExecutable() {
  if (isWindows) {
    return path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe");
  }

  if (process.platform === "darwin") {
    return path.join(
      projectRoot,
      "node_modules",
      "electron",
      "dist",
      "Electron.app",
      "Contents",
      "MacOS",
      "Electron",
    );
  }

  return path.join(projectRoot, "node_modules", "electron", "dist", "electron");
}

async function runProcess(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
      windowsHide: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Processo terminou com codigo ${code ?? "desconhecido"}.`));
    });
  });
}

async function ensureElectronBinary() {
  const exe = electronExecutable();
  if (fs.existsSync(exe)) return exe;

  const installer = path.join(projectRoot, "node_modules", "electron", "install.js");
  if (!fs.existsSync(installer)) {
    throw new Error(
      `Pacote Electron nao encontrado em:\n${installer}\n\nExecute "npm install" dentro de ${projectRoot}.`,
    );
  }

  console.log("Electron esta instalado, mas o motor nativo ainda nao foi baixado.");
  console.log("Baixando o binario oficial do Electron agora...");
  await runProcess(process.execPath, [installer, "--no"]);

  if (!fs.existsSync(exe)) {
    throw new Error(
      `O download terminou, mas Electron ainda nao foi encontrado em:\n${exe}`,
    );
  }

  return exe;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: HOST, port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function choosePort() {
  for (let port = FIRST_PORT; port <= LAST_PORT; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`Nenhuma porta livre encontrada entre ${FIRST_PORT} e ${LAST_PORT}.`);
}

async function waitForVite(devUrl, viteChild) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (viteChild?.exitCode != null) {
      throw new Error(`Vite encerrou antes de ficar pronto (codigo ${viteChild.exitCode}).`);
    }
    try {
      const response = await fetch(devUrl, { cache: "no-store" });
      if (response.ok) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Vite nao iniciou em ${devUrl} em 60 segundos.`);
}

function stopChild(child) {
  if (!child || child.killed) return;

  try {
    if (isWindows && child.pid) {
      spawn(
        process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
        ["/d", "/s", "/c", `taskkill /pid ${child.pid} /t /f >nul 2>nul`],
        { stdio: "ignore", windowsHide: true },
      );
    } else {
      child.kill("SIGTERM");
    }
  } catch {}
}

let vite = null;
let electron = null;
let shuttingDown = false;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  stopChild(electron);
  stopChild(vite);

  setTimeout(() => process.exit(code), 150);
}

try {
  const exe = await ensureElectronBinary();
  const port = await choosePort();
  const devUrl = `http://${HOST}:${port}`;

  if (port !== FIRST_PORT) {
    console.log(`Porta ${FIRST_PORT} ocupada; usando ${port} sem interromper outros programas.`);
  }

  vite = spawnNpmRun("dev:web", {
    MARSHMALLOW_VITE_PORT: String(port),
  });
  vite.on("error", (error) => {
    console.error("Falha ao iniciar o Vite:", error);
    void shutdown(1);
  });

  await waitForVite(devUrl, vite);

  electron = spawn(exe, ["."], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      MARSHMALLOW_DEV_URL: devUrl,
    },
    windowsHide: false,
  });

  electron.on("error", async (error) => {
    console.error("Falha ao iniciar o Electron:", error);
    await shutdown(1);
  });

  electron.on("exit", async (code) => {
    await shutdown(code ?? 0);
  });
} catch (error) {
  console.error(error);
  await shutdown(1);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
