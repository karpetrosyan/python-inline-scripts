import { Command } from "./abc";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { UvExecutor } from "../executor";

export default class CreatePythonScriptCommand implements Command {
    private uri: vscode.Uri | undefined;
    private uvExecutor: UvExecutor;

    constructor(uri: vscode.Uri | undefined, uvExecutor: UvExecutor) {
        this.uri = uri;
        this.uvExecutor = uvExecutor;
    }

    async execute(): Promise<void> {

        let fileName: string;
        let dirName: string;

        // If we just call the command without UI, we are opening a file in a temporary directory
        const tempDirPath = path.join(require('os').tmpdir(), 'vscode-python-script' + Date.now());

        // Create the temporary directory
        fs.mkdirSync(tempDirPath, { recursive: true });
        console.log('uri', this.uri);
        if (!this.uri) {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(tempDirPath));

            this.uvExecutor.execute(
                ["venv", path.join(tempDirPath, ".venv")],
            );

            // create settings.json file
            const settingsPath = path.join(tempDirPath, ".vscode", "settings.json");
            
            console.log("creating settings.json", settingsPath);
            fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
            
            // add default interpreter path
            const settings = {
                "python.defaultInterpreterPath": path.join(tempDirPath, ".venv", "bin", "python"),
            };

            console.log("writing settings.json", settingsPath, JSON.stringify(settings, null, 4));
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));

            // In this case we wont ask for a file name
            fileName = "script.py";
            dirName = tempDirPath;
        }
        else {
            console.log("found uri", this.uri);
            // If we are opening a file from the UI, we will ask for a file name
            let fileNameInput = await vscode.window.showInputBox({
                prompt: "Enter the name of the Python script (e.g., script.py)",
                value: "script.py",
                validateInput: (value) => {
                    if (!value.endsWith(".py")) {
                        return "File name must end with .py";
                    }
                    return null;
                },
            });
            if (!fileNameInput) {
                // User canceled the input
                return;
            }
            fileName = fileNameInput.trim();
            dirName = this.uri.fsPath;
        }

        // Create the file in the target directory
        if (fs.existsSync(vscode.Uri.file(path.join(dirName, fileName)).fsPath)) {
            vscode.window.showErrorMessage(`A file named "${fileName}" already exists in this folder.`);
            return;
        }

        let result = this.uvExecutor.execute(
            ["init", "--script", path.join(dirName, fileName)],
        );
        console.log("uv init result:", result);

        // Open the newly created file in the editor
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(dirName, fileName)));
        await vscode.window.showTextDocument(document);
    }


}