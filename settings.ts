import { App, PluginSettingTab, Setting, TFolder } from "obsidian";
import type DailyTodoPlugin from "./main";

export function getVaultFolderPaths(app: App): string[] {
	const folders: string[] = [];

	const visit = (folder: TFolder): void => {
		if (folder.path) {
			folders.push(folder.path);
		}
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				visit(child);
			}
		}
	};

	visit(app.vault.getRoot());
	return folders.sort((a, b) => a.localeCompare(b));
}

export interface DailyTodoSettings {
	todoFolder: string;
	fileNameSuffix: string;
	todoTag: string;
	includeHeading: boolean;
	setupComplete: boolean;
}

export const DEFAULT_SETTINGS: DailyTodoSettings = {
	todoFolder: "",
	fileNameSuffix: "TODO",
	todoTag: "todo",
	includeHeading: true,
	setupComplete: false,
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

		new Setting(containerEl).setName("General").setHeading();

		const folderPaths = getVaultFolderPaths(this.app);
		const currentFolder = this.plugin.settings.todoFolder.trim();
		if (currentFolder && !folderPaths.includes(currentFolder)) {
			folderPaths.unshift(currentFolder);
		}

		new Setting(containerEl)
			.setName("TODO folder")
			.setDesc("Vault folder where daily TODO notes are stored.")
			.addDropdown((dropdown) => {
				if (!currentFolder) {
					dropdown.addOption("", "Not configured — use the ribbon icon to set up");
				}
				if (folderPaths.length === 0 && !currentFolder) {
					dropdown.addOption("TODO", "TODO (will be created)");
				} else {
					for (const path of folderPaths) {
						dropdown.addOption(path, path || "/");
					}
				}

				dropdown
					.setValue(currentFolder || "")
					.onChange(async (value) => {
						this.plugin.settings.todoFolder = value;
						this.plugin.settings.setupComplete = true;
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
