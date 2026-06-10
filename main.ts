import { Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	DailyTodoSettingTab,
	type DailyTodoSettings,
} from "./settings";
import { rolloverTodos } from "./todo-rollover";

export default class DailyTodoPlugin extends Plugin {
	settings: DailyTodoSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("list-checks", "Create today's TODO", () => {
			void this.createTodaysTodo();
		});

		this.addCommand({
			id: "create-todays-todo",
			name: "Create today's TODO from previous day",
			callback: () => {
				void this.createTodaysTodo();
			},
		});

		this.addSettingTab(new DailyTodoSettingTab(this.app, this));
	}

	onunload(): void {
		// No cleanup required.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async createTodaysTodo(): Promise<void> {
		try {
			await rolloverTodos(this.app, this.settings);
		} catch (error) {
			console.error("Daily TODO rollover failed:", error);
			new Notice("Failed to create today's TODO. Check the developer console for details.");
		}
	}
}
