import { execSync } from 'child_process';

export class UvExecutor {
	constructor(public uvPath: string) {}

	execute(args: string[]): string {
		const command = [
			`"${this.uvPath}"`,
			...args.map(arg => JSON.stringify(arg))
		].join(' ');

		return execSync(command, {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'pipe'], // Don't hang on stdin
		});
	}
}
