import { App, PluginSettingTab, Setting } from "obsidian";
import type DailyTodoPlugin from "./main";

function getVaultFolderPaths(app: App): string[] {
	const paths = app.vault
		.getAllFolders()
		.map((folder) => folder.path)
		.sort((a, b) => a.localeCompare(b));

	return paths;
}

export interface DailyTodoSettings {
	todoFolder: string;
	fileNameSuffix: string;
	todoTag: string;
	includeHeading: boolean;
}

export const DEFAULT_SETTINGS: DailyTodoSettings = {
	todoFolder: "TODO",
	fileNameSuffix: "TODO",
	todoTag: "todo",
	includeHeading: true,
};

export class DailyTodoSettingTab extends PluginSettingTab {
	plugin: DailyTodoPlugin;

	constructor(app: App, plugin: DailyTodoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Daily TODO settings" });

		const folderPaths = getVaultFolderPaths(this.app);
		const currentFolder =
			this.plugin.settings.todoFolder.trim() || DEFAULT_SETTINGS.todoFolder;
		if (currentFolder && !folderPaths.includes(currentFolder)) {
			folderPaths.unshift(currentFolder);
		}

		new Setting(containerEl)
			.setName("TODO folder")
			.setDesc("Vault folder where daily TODO notes are stored.")
			.addDropdown((dropdown) => {
				if (folderPaths.length === 0) {
					dropdown.addOption("TODO", "TODO (will be created)");
				} else {
					for (const path of folderPaths) {
						dropdown.addOption(path, path || "/");
					}
				}

				dropdown
					.setValue(currentFolder)
					.onChange(async (value) => {
						this.plugin.settings.todoFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("File name suffix")
			.setDesc('Optional suffix after the date (e.g. "TODO" produces "2025-06-09 TODO.md"). A space is added automatically. Leave blank for "YYYY-MM-DD.md".')
			.addText((text) =>
				text
					.setPlaceholder("TODO")
					.setValue(this.plugin.settings.fileNameSuffix)
					.onChange(async (value) => {
						this.plugin.settings.fileNameSuffix = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("TODO tag")
			.setDesc("Tag added to the frontmatter of new daily TODO notes.")
			.addText((text) =>
				text
					.setPlaceholder("todo")
					.setValue(this.plugin.settings.todoTag)
					.onChange(async (value) => {
						this.plugin.settings.todoTag = value.trim() || DEFAULT_SETTINGS.todoTag;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Include heading")
			.setDesc("Add a '# TODO' heading below the frontmatter in new notes.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeHeading)
					.onChange(async (value) => {
						this.plugin.settings.includeHeading = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
