# Time Tracker

Extension for tracking time spent on coding and logging time to Jira.

## Disclaimer

The reason for creating this extension is simple laziness. Laziness in logging time in Jira. I am not an expert in developing extensions for VSCode and others, and I am also not an expert in TypeScript, this is my first such project. Most of the code is written by DeepSeek and using a big file. If this is useful to someone, then welcome.

## Overview

This extension helps developers track the time they spend on coding and automatically log it to Jira. It provides features like:

## Features

- Start/stop/reset timer for tracking work time
- Automatic time logging based on activity
- Configuration options for:
  - Jira URL
  - Access token
  - Inactivity timeout
  - Auto-logging settings

## Usage

For using rules:

- You must use a Git branch name in the format branch_name_user_JIRA_ID. Exp: `tracker/feat/add_timer_PROJ-6666` or `tracker/feat/add_timer_PROJ_6666`
- Shift+Ctr+P -> Time Tracker. Configure Time Tracker.
- Enter Access Token Jira.

## Installation

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/kededg/jira_time_tracker.git
cd jira_time_tracker
npm install
```

2. Open in VS Code and compile:
```bash
npm run compile
```

3. Install from the VS Code marketplace (when available)

## Configuration

1. Open VS Code settings
2. Search for "Time Tracker" settings
3. Configure:
   - `timeTracker.jiraUrl`: Your Jira instance URL (default: `https://jira.com`)
   - `timeTracker.accessToken`: Your Jira personal access token
   - `timeTracker.inactivityTimeout`: Inactivity timeout in minutes (default: 10)
   - `timeTracker.autoLogging`: Enable/disable automatic logging (default: true)
   - `timeTracker.autoLoggingTime`: Minimum time to trigger auto-logging (default: 10 minutes)

## Usage

1. Start tracking time:
```bash
Time Tracker: Start Time Tracker counter
```

2. Stop tracking:
```bash
Time Tracker: Stop Time Tracker counter
```

3. Reset counter:
```bash
Time Tracker: Reset and stop Time Tracker counter
```

4. Set Jira task ID:
```bash
Time Tracker: Set Jira task ID
```

5. Configure settings:
```bash
Time Tracker: Configure Time Tracker
```

## Development

1. Compile extension:
```bash
npm run compile
```

2. Watch files for changes:
```bash
npm run watch
```

## License

MIT License