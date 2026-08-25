import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const localAppData = process.env.LOCALAPPDATA || resolve(homedir(), 'AppData', 'Local');
const cargoTargetDirectory = process.env.CARGO_TARGET_DIR || resolve(localAppData, 'TYANA', 'QFlow', 'cargo-target');
const tauriEntryPoint = resolve(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const args = [tauriEntryPoint, 'build', '--ci', '--bundles', 'nsis', '--target', 'x86_64-pc-windows-msvc', '--', '--locked'];

console.log(`TYANA Q-FLOW derleme önbelleği: ${cargoTargetDirectory}`);

const child = spawn(process.execPath, args, {
  cwd: root,
  env: { ...process.env, CARGO_TARGET_DIR: cargoTargetDirectory },
  stdio: 'inherit',
  windowsHide: true,
  shell: false
});

child.on('error', error => {
  console.error(`Tauri başlatılamadı: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', code => {
  process.exitCode = code ?? 1;
});
