import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { DailyTodoSettings } from "./settings";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const UNCHECKED_TASK_PATTERN = /^\s*[-*+]\s+\[\s\]\s+/;
const LIST_ITEM_PATTERN = /^\s*(?:[-*+]\s+(?:\[[\sxX]\]\s+)?|\d+\.\s+)/;
const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

function getIndent(line: string): number {
	const match = line.match(/^(\s*)/);
	return match ? match[1].replace(/\t/g, "    ").length : 0;
}

function isBlockListItem(line: string): boolean {
	return LIST_ITEM_PATTERN.test(line);
}

function findNextNonEmptyLine(lines: string[], start: number): number {
	for (let i = start; i < lines.length; i++) {
		if (lines[i].trim() !== "") {
			return i;
		}
	}
	return -1;
}

export interface RolloverResult {
	created: boolean;
	file: TFile;
	sourceDate: string | null;
	itemCount: number;
}

export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function sanitizeFolderPath(folder: string): string {
	const trimmed = folder.trim().replace(/\\/g, "/");
	if (!trimmed) {
		return "TODO";
	}

	const normalized = normalizePath(trimmed);
	if (!normalized || normalized === "." || normalized === ".." || normalized.includes("..")) {
		return "TODO";
	}

	return normalized;
}

export function parseDateFromBasename(basename: string): string | null {
	const match = basename.match(DATE_PATTERN);
	if (!match) {
		return null;
	}

	const [, year, month, day] = match;
	const monthNum = Number(month);
	const dayNum = Number(day);
	const yearNum = Number(year);

	if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
		return null;
	}

	const parsed = new Date(yearNum, monthNum - 1, dayNum);
	if (
		parsed.getFullYear() !== yearNum ||
		parsed.getMonth() !== monthNum - 1 ||
		parsed.getDate() !== dayNum
	) {
		return null;
	}

	return `${year}-${month}-${day}`;
}

export function buildFileName(date: string, suffix: string): string {
	const safeSuffix = suffix.replace(/[<>:"/\\|?*]/g, "").trim();
	return safeSuffix ? `${date} ${safeSuffix}.md` : `${date}.md`;
}

function buildLegacyFileName(date: string, suffix: string): string {
	const safeSuffix = suffix.replace(/[<>:"/\\|?*]/g, "").trim();
	return safeSuffix ? `${date}${safeSuffix}.md` : `${date}.md`;
}

function collectIncompleteTodoBlocks(content: string): { lines: string[]; todoCount: number } {
	const withoutFrontmatter = content.replace(FRONTMATTER_PATTERN, "");
	const lines = withoutFrontmatter.split(/\r?\n/);
	const incomplete: string[] = [];
	let todoCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!UNCHECKED_TASK_PATTERN.test(line)) {
			continue;
		}

		todoCount++;
		const parentIndent = getIndent(line);
		incomplete.push(line);

		let j = i + 1;
		while (j < lines.length) {
			const nextLine = lines[j];

			if (nextLine.trim() === "") {
				const nextContentIdx = findNextNonEmptyLine(lines, j + 1);
				if (nextContentIdx === -1 || getIndent(lines[nextContentIdx]) > parentIndent) {
					incomplete.push(nextLine);
					j++;
					continue;
				}
				break;
			}

			const nextIndent = getIndent(nextLine);
			if (nextIndent > parentIndent) {
				incomplete.push(nextLine);
				j++;
				continue;
			}

			if (nextIndent <= parentIndent && isBlockListItem(nextLine)) {
				break;
			}

			break;
		}

		i = j - 1;
	}

	return { lines: incomplete, todoCount };
}

export function extractIncompleteTodoLines(content: string): string[] {
	return collectIncompleteTodoBlocks(content).lines;
}

export function countIncompleteTodos(content: string): number {
	return collectIncompleteTodoBlocks(content).todoCount;
}

function findTodoFilesInFolder(app: App, folderPath: string): TFile[] {
	const folder = app.vault.getAbstractFileByPath(folderPath);
	if (!folder) {
		return [];
	}

	const files: TFile[] = [];

	const visit = (path: string): void => {
		const folderEntry = app.vault.getAbstractFileByPath(path);
		if (!folderEntry || !(folderEntry instanceof TFolder)) {
			return;
		}

		for (const child of folderEntry.children) {
			if (child instanceof TFile && child.extension === "md") {
				if (parseDateFromBasename(child.basename)) {
					files.push(child);
				}
			} else if (child instanceof TFolder) {
				visit(child.path);
			}
		}
	};

	visit(folderPath);
	return files;
}

export function findMostRecentTodoFile(
	app: App,
	folderPath: string,
	beforeDate?: string
): TFile | null {
	const files = findTodoFilesInFolder(app, folderPath);
	if (files.length === 0) {
		return null;
	}

	const datedFiles = files
		.map((file) => ({
			file,
			date: parseDateFromBasename(file.basename) as string,
		}))
		.filter((entry) => entry.date !== null);

	if (beforeDate) {
		const filtered = datedFiles.filter((entry) => entry.date < beforeDate);
		if (filtered.length === 0) {
			return null;
		}
		filtered.sort((a, b) => b.date.localeCompare(a.date));
		return filtered[0].file;
	}

	datedFiles.sort((a, b) => b.date.localeCompare(a.date));
	return datedFiles[0]?.file ?? null;
}

function buildNoteContent(
	settings: DailyTodoSettings,
	today: string,
	sourceBasename: string | null,
	incompleteLines: string[]
): string {
	const tags = ["daily", settings.todoTag].filter(Boolean);
	const uniqueTags = [...new Set(tags)];

	const frontmatterLines = [
		"---",
		`tags: [${uniqueTags.map((tag) => tag).join(", ")}]`,
		`date: ${today}`,
		"type: daily-todo",
	];

	if (sourceBasename) {
		frontmatterLines.push(`rolledOverFrom: "[[${sourceBasename}]]"`);
	}

	frontmatterLines.push("---", "");

	const bodyLines: string[] = [];
	if (settings.includeHeading) {
		bodyLines.push("# TODO", "");
	}

	if (incompleteLines.length > 0) {
		bodyLines.push(...incompleteLines);
	} else {
		bodyLines.push("- [ ] ");
	}

	bodyLines.push("");
	bodyLines.push(settings.includeHeading ? "## Notes" : "# Notes", "");
	return [...frontmatterLines, ...bodyLines].join("\n");
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(folderPath);
	if (existing) {
		return;
	}

	const parts = folderPath.split("/").filter(Boolean);
	let current = "";

	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

export async function rolloverTodos(
	app: App,
	settings: DailyTodoSettings
): Promise<RolloverResult | null> {
	const folderPath = sanitizeFolderPath(settings.todoFolder);
	const today = formatDate(new Date());
	const todayFileName = buildFileName(today, settings.fileNameSuffix);
	const todayFilePath = normalizePath(`${folderPath}/${todayFileName}`);

	let existingToday = app.vault.getAbstractFileByPath(todayFilePath);
	if (!(existingToday instanceof TFile)) {
		const legacyFileName = buildLegacyFileName(today, settings.fileNameSuffix);
		if (legacyFileName !== todayFileName) {
			const legacyFilePath = normalizePath(`${folderPath}/${legacyFileName}`);
			const legacyFile = app.vault.getAbstractFileByPath(legacyFilePath);
			if (legacyFile instanceof TFile) {
				await app.vault.rename(legacyFile, todayFilePath);
				existingToday = app.vault.getAbstractFileByPath(todayFilePath);
			}
		}
	}

	if (existingToday instanceof TFile) {
		new Notice(`Today's TODO already exists: ${todayFileName}`);
		await app.workspace.getLeaf(false).openFile(existingToday);
		return {
			created: false,
			file: existingToday,
			sourceDate: null,
			itemCount: 0,
		};
	}

	const sourceFile = findMostRecentTodoFile(app, folderPath, today);
	let incompleteLines: string[] = [];
	let sourceDate: string | null = null;
	let sourceBasename: string | null = null;
	let todoCount = 0;

	if (sourceFile) {
		sourceBasename = sourceFile.basename;
		sourceDate = parseDateFromBasename(sourceFile.basename);
		const sourceContent = await app.vault.read(sourceFile);
		const blocks = collectIncompleteTodoBlocks(sourceContent);
		incompleteLines = blocks.lines;
		todoCount = blocks.todoCount;
	}

	await ensureFolderExists(app, folderPath);

	const content = buildNoteContent(settings, today, sourceBasename, incompleteLines);
	const newFile = await app.vault.create(todayFilePath, content);

	await app.workspace.getLeaf(false).openFile(newFile);

	const itemLabel = todoCount === 1 ? "item" : "items";
	const sourceLabel = sourceDate ? ` from ${sourceDate}` : "";
	new Notice(
		`Created ${todayFileName} with ${todoCount} rolled-over ${itemLabel}${sourceLabel}.`
	);

	return {
		created: true,
		file: newFile,
		sourceDate,
		itemCount: todoCount,
	};
}
