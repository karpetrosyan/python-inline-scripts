// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UvExecutor } from './executor';


async function getActivePython(): Promise<string | undefined> {
  const extension = vscode.extensions.getExtension('ms-python.python');
  if (!extension) {
    return;
  }

  await extension.activate();

  const execCommand = extension.exports.environments?.getActiveEnvironmentPath
    ? await extension.exports.environments.getActiveEnvironmentPath(vscode.workspace.workspaceFolders?.[0]?.uri)
    : undefined;

  return execCommand?.path || vscode.workspace.getConfiguration('python').get<string>('pythonPath');
}

function getUvPath(): string | null {
  try {
    const command = os.platform() === 'win32' ? 'where uv' : 'which uv';
    const uvPath = cp.execSync(command, { encoding: 'utf8' }).trim();
    return uvPath;
  } catch {
    return null;
  }
}

export async function getOrInstallUv(context: vscode.ExtensionContext): Promise<UvExecutor> {

  const pythonPath = await getActivePython();
  if (!pythonPath) {
    vscode.window.showWarningMessage('Python interpreter not found.');
    throw new Error('Python interpreter not found.');
  }

  const uvPath = await getUvPath();
  if (uvPath) {
    return new UvExecutor(uvPath);
  }

  const storageDir = context.globalStorageUri.fsPath;
  const uvTargetPath = path.join(storageDir, os.platform() === 'win32' ? 'uv.exe' : 'uv');

  console.log("searching for uv binary in storage dir:", storageDir);
  if (fs.existsSync(uvTargetPath)) {
    console.log("found uv binary in storage dir:", uvTargetPath);
    try {
      cp.execFileSync(uvTargetPath, ['--version'], { stdio: 'ignore' });
      return new UvExecutor(uvTargetPath);
    } catch {
      console.log("uv binary is not healthy, removing it");
      fs.rmSync(uvTargetPath, { force: true });
    }
  }

  console.log("uv binary not found in storage dir, installing with pip");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-uv-'));

  console.log("creating virtualenv in tmp dir:", tmpDir);
  const venvPath = path.join(tmpDir, 'venv');

  cp.execSync(`"${pythonPath}" -m venv "${venvPath}"`, { stdio: 'inherit' });

  const binDir = os.platform() === 'win32'
    ? path.join(venvPath, 'Scripts')
    : path.join(venvPath, 'bin');
  const pipPath = path.join(binDir, 'pip');

  cp.execSync(`"${pipPath}" install --upgrade pip`, { stdio: 'inherit' });
  console.log("installing uv in virtualenv(bin dir):", binDir);
  cp.execSync(`"${pipPath}" install uv`, { stdio: 'inherit' });


  const uvBinary = path.join(binDir, os.platform() === 'win32' ? 'uv.exe' : 'uv');
  console.log("uv binary path:", uvBinary);
  if (!fs.existsSync(uvBinary)) { throw new Error('uv not found in venv'); };

  fs.mkdirSync(storageDir, { recursive: true });

  console.log("copying uv binary to storage dir:", storageDir);
  fs.copyFileSync(uvBinary, uvTargetPath);
  fs.chmodSync(uvTargetPath, 0o755);

  console.log("removing tmp dir:", tmpDir);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return new UvExecutor(uvTargetPath);
}

import CreatePythonScriptCommand from './commands/createPythonScript';
import RunPythonScriptCommand from './commands/runPythonScript';

export async function activate(context: vscode.ExtensionContext) {
  let uvExecutor = await getOrInstallUv(context);
  const createPythonScript = vscode.commands.registerCommand('python-inline-scripts.createPythonScript', async (uri: vscode.Uri) => {
    let command = new CreatePythonScriptCommand(uri, uvExecutor);
    await command.execute();
  });


  const runPythonScriptCommand = vscode.commands.registerCommand('python-inline-scripts.runPythonScript', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const document = editor.document;
      const terminal = vscode.window.createTerminal('Custom Python Run');
      let command = new RunPythonScriptCommand(uvExecutor, document.fileName, terminal);
      await command.execute();
    }
  });

  context.subscriptions.push(createPythonScript);
  context.subscriptions.push(runPythonScriptCommand);
}


// This method is called when your extension is deactivatedx
export function deactivate() { }
