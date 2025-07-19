# Claude Code Memory Auto-Update System

This directory contains an automated system for keeping CLAUDE.md up-to-date as your project evolves.

## How It Works

The system uses Claude Code's hook functionality to monitor file changes and automatically update CLAUDE.md when it detects:

- New npm scripts in package.json
- New modules created in `/apps/api/src/`
- New job processors in `/apps/api/src/jobs/processors/`
- New database schemas in `/apps/api/src/database/schema/`
- New environment variables in `.env.example` files

## Files

- `auto-update-claude-md.js` - The main hook script that performs automatic updates
- `update-claude-md.js` - A simpler version that adds suggestions as comments
- `settings.json` - Project-specific Claude Code settings (not currently used)

## Setup

The hook is configured globally in `~/.claude/settings.json` to run only for the glimmr-api project:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "condition": "cwd.includes('glimmr-api')",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/auto-update-claude-md.js"
          }
        ]
      }
    ]
  }
}
```

## What Gets Updated

1. **New Scripts**: Automatically added to the Essential Commands section with placeholder descriptions
2. **New Modules**: Added to the Module Structure section
3. **New Job Processors**: Added to the Job Processing System list
4. **New Database Schemas**: Added to the Database Schema Organization
5. **New Environment Variables**: Added to the Environment Variables example

## Manual Review

While the system automatically updates CLAUDE.md, you should periodically review:

- Replace placeholder descriptions with accurate ones
- Ensure new entries are in the correct sections
- Remove any entries that are no longer relevant
- Check the "Last auto-update" marker at the bottom of CLAUDE.md

## Customization

You can modify `auto-update-claude-md.js` to:

- Add detection for other file patterns
- Change which scripts are considered "important"
- Customize the descriptions generated
- Add new section types

## Disabling

To temporarily disable auto-updates, remove the hook configuration from `~/.claude/settings.json`.