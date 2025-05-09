import { Command } from "./abc";
import * as vscode from "vscode";
import { UvExecutor } from "../executor";

export default class RunPythonScriptCommand implements Command {
    private uvExecutor: UvExecutor;
    private fileName: string;
    private terminal: vscode.Terminal;

    constructor(uvExecutor: UvExecutor, fileName: string, terminal: vscode.Terminal) {
        this.uvExecutor = uvExecutor;
        this.fileName = fileName;
        this.terminal = terminal;
    }
    
    async execute(): Promise<void> {
        this.terminal.show();
        this.terminal.sendText(`${this.uvExecutor.uvPath} run --script "${this.fileName}"`);
    }
}