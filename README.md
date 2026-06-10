# Daily TODO

An [Obsidian](https://obsidian.md) community plugin that creates today's daily TODO note and rolls over incomplete tasks from the most recent previous daily note.

## Features

- **One-click rollover** — Use the ribbon icon or command palette to create today's TODO.
- **Smart task extraction** — Finds unchecked `- [ ]` tasks and preserves nested sub-items and blank lines within each task block.
- **Automatic source detection** — Locates the most recent dated TODO file before today in your configured folder.
- **Configurable naming** — Set the vault folder, file name suffix, frontmatter tag, and whether to include a `# TODO` heading.
- **Legacy file support** — Automatically renames older files that used `YYYY-MM-DDtodo.md` naming to the current `YYYY-MM-DD todo.md` format.

## Installation

### From Obsidian Community Plugins (after publishing)

1. Open **Settings → Community plugins**.
2. Turn off **Restricted mode** if needed.
3. Click **Browse**, search for **Daily TODO**, and install.
4. Enable the plugin.

### Manual installation

1. Download `main.js` and `manifest.json` from the [latest GitHub release](https://github.com/aaronarcade/Obsidian-Daily-Todo/releases).
2. Create a folder `{vault}/.obsidian/plugins/dailytodo/`.
3. Copy `main.js` and `manifest.json` into that folder.
4. Reload Obsidian and enable **Daily TODO** under **Settings → Community plugins**.

### Development

```bash
git clone https://github.com/aaronarcade/Obsidian-Daily-Todo.git
cd Obsidian-Daily-Todo
npm install
npm run dev
```

Symlink or copy the plugin folder into your vault's `.obsidian/plugins/` directory. Use `npm run dev` for watch mode during development.

Build for production:

```bash
npm run build
```

## Usage

1. Configure the plugin under **Settings → Daily TODO settings**:
   - **TODO folder** — Where daily notes are stored (default: `TODO`).
   - **File name suffix** — Appended after the date (default: `TODO`, producing `2025-06-09 TODO.md`).
   - **TODO tag** — Frontmatter tag added to new notes (default: `todo`).
   - **Include heading** — Whether to add a `# TODO` heading below the frontmatter.

2. Create today's note using either:
   - The **list-checks** ribbon icon (**Create today's TODO**), or
   - **Command palette → Create today's TODO from previous day**.

3. If today's file already exists, the plugin opens it instead of creating a duplicate.

### Example output

Given incomplete tasks in `TODO/2025-06-08 TODO.md`, running the command on June 9 creates `TODO/2025-06-09 TODO.md`:

```markdown
---
tags: [daily, todo]
date: 2025-06-09
type: daily-todo
rolledOverFrom: "[[2025-06-08 TODO]]"
---

# TODO

- [ ] Finish report
  - [ ] Gather sources
- [ ] Email team

## Notes

```

## File naming

Daily TODO files must start with a date in `YYYY-MM-DD` format:

| Suffix setting | Example file name |
|---|---|
| `TODO` | `2025-06-09 TODO.md` |
| *(empty)* | `2025-06-09.md` |
| `todo` | `2025-06-09 todo.md` |

## Publishing to the Obsidian Community directory

Follow these steps when you are ready to share the plugin publicly.

### Prerequisites

- A public GitHub repository with this source code.
- An [Obsidian account](https://obsidian.md).
- A GitHub account linked to your Obsidian community profile.

### 1. Prepare the repository

Ensure the default branch includes:

- `manifest.json` — accurate `id`, `version`, and `minAppVersion`
- `README.md` — plugin description and usage (this file)
- `LICENSE` — MIT license
- `versions.json` — maps plugin versions to minimum Obsidian versions

The compiled `main.js` is **not** committed to the repo (see `.gitignore`). It is attached to GitHub releases instead.

### 2. Create a GitHub release

1. Run `npm run build` to produce `main.js`.
2. Confirm `manifest.json` `version` matches the release tag (semver `x.y.z`, e.g. `1.0.0`).
3. [Create a GitHub release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release):
   - **Tag**: must match `version` in `manifest.json` (e.g. `1.0.0`)
   - **Assets**: attach `main.js` and `manifest.json` (no `styles.css` needed for this plugin)
4. Optionally bump versions for future releases:

   ```bash
   npm version patch   # or minor / major
   npm run build
   git push && git push --tags
   ```

   The `npm version` script runs `version-bump.mjs`, which updates `manifest.json` and `versions.json`.

### 3. Submit to the community directory

1. Go to [community.obsidian.md](https://community.obsidian.md) and sign in.
2. Link your GitHub account in your profile.
3. Select **Plugins → New plugin**.
4. Enter your repository URL: `https://github.com/aaronarcade/Obsidian-Daily-Todo`
5. Agree to the [developer policies](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) and submit.

The directory reads `manifest.json` from your default branch and downloads plugin assets from the GitHub release whose tag matches `version`. Automated review will flag anything that needs correction.

### 4. After publishing

- Announce in [Share & showcase](https://forum.obsidian.md/c/share-showcase/9) on the Obsidian forum.
- For future updates: bump the version, create a new GitHub release with updated assets, and push the updated `manifest.json` to the default branch.

## License

MIT — see [LICENSE](LICENSE).
