import {
	App,
	FuzzySuggestModal,
	Modal,
	Notice,
	Setting,
	TFolder,
	normalizePath,
} from "obsidian";
import type DailyTodoPlugin from "./main";
import type { DailyTodoSettings } from "./settings";
import {
	buildFileName,
	ensureFolderExists,
	formatDate,
	rolloverTodos,
} from "./todo-rollover";

export const DEFAULT_SETUP_FOLDER = "_TODO";

export function todoFolderExists(app: App, folderPath: string): boolean {
	const trimmed = folderPath.trim();
	if (!trimmed) {
		return false;
	}

	const entry = app.vault.getAbstractFileByPath(normalizePath(trimmed));
	return entry instanceof TFolder;
}

export function needsFirstRunSetup(app: App, settings: DailyTodoSettings): boolean {
	if (!settings.setupComplete) {
		return true;
	}

	if (!settings.todoFolder.trim()) {
		return true;
	}

	return !todoFolderExists(app, settings.todoFolder);
}

export async function markSetupComplete(plugin: DailyTodoPlugin): Promise<void> {
	plugin.settings.setupComplete = true;
	await plugin.saveSettings();
}

function getVaultFolderPaths(app: App): string[] {
	return app.vault
		.getAllFolders()
		.map((folder) => folder.path)
		.sort((a, b) => a.localeCompare(b));
}

export function buildExampleYesterdayContent(
	settings: DailyTodoSettings,
	date: string
): string {
	const tags = ["daily", settings.todoTag].filter(Boolean);
	const uniqueTags = [...new Set(tags)];

	const frontmatterLines = [
		"---",
		`tags: [${uniqueTags.join(", ")}]`,
		`date: ${date}`,
		"type: daily-todo",
		"---",
		"",
	];

	const bodyLines: string[] = [];
	if (settings.includeHeading) {
		bodyLines.push("# TODO", "");
	}

	bodyLines.push(
		"- [ ] Connect todo folder",
		"\t- [ ] check the rolled over link in page properties",
		"\t- [ ] speed up daily todo creation",
		"- [ ] Follow up with team",
		"\t- [x] Draft email to George P. Burdell",
		"\t- [ ] Review standup notes",
		"- [ ] Try the Daily TODO rollover",
		"\t- [ ] Have fun!"
	);

	bodyLines.push("");
	bodyLines.push(settings.includeHeading ? "## Notes" : "# Notes", "");
	bodyLines.push("Example note from first-run setup. Incomplete items above will roll over.");

	return [...frontmatterLines, ...bodyLines].join("\n");
}

export async function setupDefaultTodoFolder(plugin: DailyTodoPlugin): Promise<void> {
	const folderPath = DEFAULT_SETUP_FOLDER;
	await ensureFolderExists(plugin.app, folderPath);
	plugin.settings.todoFolder = folderPath;
	await markSetupComplete(plugin);

	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayStr = formatDate(yesterday);
	const fileName = buildFileName(yesterdayStr, plugin.settings.fileNameSuffix);
	const filePath = normalizePath(`${folderPath}/${fileName}`);

	if (!plugin.app.vault.getAbstractFileByPath(filePath)) {
		const content = buildExampleYesterdayContent(plugin.settings, yesterdayStr);
		await plugin.app.vault.create(filePath, content);
	}
}

class TodoFolderSuggestModal extends FuzzySuggestModal<string> {
	private folders: string[];
	private onChooseFolder: (folder: string) => void;
	private onCancel: () => void;
	private chosen = false;

	constructor(
		app: App,
		folders: string[],
		onChooseFolder: (folder: string) => void,
		onCancel: () => void
	) {
		super(app);
		this.folders = folders;
		this.onChooseFolder = onChooseFolder;
		this.onCancel = onCancel;
	}

	getItems(): string[] {
		return this.folders;
	}

	getItemText(item: string): string {
		return item || "/ (vault root)";
	}

	onChooseItem(item: string): void {
		this.chosen = true;
		this.onChooseFolder(item);
	}

	onClose(): void {
		super.onClose();
		if (!this.chosen) {
			this.onCancel();
		}
	}
}

type FirstRunSetupHandlers = {
	onBrowseFolder: (folder: string) => void;
	onCreateDefault: () => void;
	onDismiss: () => void;
};

class FirstRunSetupModal extends Modal {
	private handlers: FirstRunSetupHandlers;
	closingForAction = false;

	constructor(app: App, handlers: FirstRunSetupHandlers) {
		super(app);
		this.handlers = handlers;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		titleEl.setText("Set up Daily TODO");

		contentEl.createEl("p", {
			text: "Before creating today's list, choose where your daily TODO notes should live.",
		});

		new Setting(contentEl)
			.setName("Browse folders")
			.setDesc("Pick an existing folder in your vault for daily TODO notes.")
			.addButton((button) =>
				button
					.setButtonText("Browse folders")
					.setCta()
					.onClick(() => {
						const folders = getVaultFolderPaths(this.app);
						if (folders.length === 0) {
							new Notice("No folders found in your vault. Try creating _TODO instead.");
							return;
						}

						this.closingForAction = true;
						this.close();
						new TodoFolderSuggestModal(
							this.app,
							folders,
							(folder) => this.handlers.onBrowseFolder(folder),
							() => this.handlers.onDismiss()
						).open();
					})
			);

		new Setting(contentEl)
			.setName(`Create ${DEFAULT_SETUP_FOLDER}`)
			.setDesc(
				`Create a ${DEFAULT_SETUP_FOLDER} folder with a sample yesterday note so you can test rollover right away.`
			)
			.addButton((button) =>
				button
					.setButtonText(`Create ${DEFAULT_SETUP_FOLDER}`)
					.setCta()
					.onClick(() => {
						this.closingForAction = true;
						this.close();
						this.handlers.onCreateDefault();
					})
			);

		new Setting(contentEl).addButton((button) =>
			button.setButtonText("Cancel").onClick(() => this.close())
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function showFirstRunSetup(plugin: DailyTodoPlugin): Promise<void> {
	return new Promise((resolve) => {
		let finished = false;

		const finish = (): void => {
			if (!finished) {
				finished = true;
				resolve();
			}
		};

		const runRollover = async (): Promise<void> => {
			try {
				await rolloverTodos(plugin.app, plugin.settings);
			} catch (error) {
				console.error("Daily TODO rollover failed after setup:", error);
				new Notice(
					"Setup saved, but creating today's TODO failed. Check the developer console for details."
				);
			} finally {
				finish();
			}
		};

		const modal = new FirstRunSetupModal(plugin.app, {
			onBrowseFolder: (folder) => {
				void (async () => {
					plugin.settings.todoFolder = folder;
					await markSetupComplete(plugin);
					await runRollover();
				})();
			},
			onCreateDefault: () => {
				void (async () => {
					await setupDefaultTodoFolder(plugin);
					await runRollover();
				})();
			},
			onDismiss: finish,
		});

		const originalOnClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			originalOnClose();
			if (!modal.closingForAction) {
				finish();
			}
		};

		modal.open();
	});
}
