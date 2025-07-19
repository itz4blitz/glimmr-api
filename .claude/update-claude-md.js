#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration for what changes should trigger CLAUDE.md updates
const UPDATE_TRIGGERS = {
  // New files/directories that might need documentation
  newModules: /^apps\/api\/src\/[^/]+\/$/,
  newProcessors: /^apps\/api\/src\/jobs\/processors\/.+\.ts$/,
  newSchemas: /^apps\/api\/src\/database\/schema\/.+\.ts$/,
  
  // Config changes that might affect commands
  packageJson: /^(apps\/api\/)?package\.json$/,
  dockerCompose: /^docker-compose.*\.yml$/,
  envExample: /^apps\/api\/\.env.*\.example$/,
  
  // Script changes that might add new commands
  scripts: /^(apps\/api\/)?(scripts|bin)\/.+$/,
};

// Sections in CLAUDE.md that might need updates
const CLAUDE_SECTIONS = {
  commands: /## Essential Commands/,
  architecture: /## Architecture/,
  setup: /## Development Setup/,
  patterns: /## Code Patterns/,
};

class ClaudeMemoryUpdater {
  constructor() {
    this.claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    this.pendingUpdates = new Set();
  }

  analyzeChange(toolName, filePath, operation) {
    // Check if this change should trigger an update
    for (const [triggerName, pattern] of Object.entries(UPDATE_TRIGGERS)) {
      if (pattern.test(filePath)) {
        this.pendingUpdates.add({
          trigger: triggerName,
          file: filePath,
          operation,
          suggestions: this.getSuggestions(triggerName, filePath, operation)
        });
      }
    }
  }

  getSuggestions(triggerName, filePath, operation) {
    const suggestions = [];
    
    switch (triggerName) {
      case 'newModules':
        if (operation === 'create') {
          const moduleName = path.basename(path.dirname(filePath));
          suggestions.push({
            section: 'architecture',
            update: `Add new module to Module Structure section: - \`/apps/api/src/${moduleName}/\` - [Description needed]`
          });
        }
        break;
        
      case 'newProcessors':
        if (operation === 'create') {
          const processorName = path.basename(filePath, '.ts');
          suggestions.push({
            section: 'architecture',
            update: `Add new job processor to Job Processing System section: **${processorName}** - [Description needed]`
          });
        }
        break;
        
      case 'newSchemas':
        if (operation === 'create') {
          const schemaName = path.basename(filePath, '.ts');
          suggestions.push({
            section: 'architecture',
            update: `Update Database Schema Organization with new schema: \`${schemaName}.*\` - [Description needed]`
          });
        }
        break;
        
      case 'packageJson':
        suggestions.push({
          section: 'commands',
          update: 'Check for new scripts in package.json that should be documented'
        });
        break;
        
      case 'dockerCompose':
        suggestions.push({
          section: 'setup',
          update: 'Review docker-compose changes for new services or environment updates'
        });
        break;
        
      case 'envExample':
        suggestions.push({
          section: 'setup',
          update: 'Update Environment Variables section with new or changed variables'
        });
        break;
    }
    
    return suggestions;
  }

  generateUpdatePrompt() {
    if (this.pendingUpdates.size === 0) {
      return null;
    }

    const updates = Array.from(this.pendingUpdates);
    let prompt = "# CLAUDE.md Update Suggestions\n\n";
    prompt += "Based on recent changes, consider updating CLAUDE.md:\n\n";
    
    // Group by section
    const bySection = {};
    updates.forEach(update => {
      update.suggestions.forEach(suggestion => {
        if (!bySection[suggestion.section]) {
          bySection[suggestion.section] = [];
        }
        bySection[suggestion.section].push({
          file: update.file,
          suggestion: suggestion.update
        });
      });
    });
    
    // Format suggestions
    Object.entries(bySection).forEach(([section, items]) => {
      prompt += `## ${section.charAt(0).toUpperCase() + section.slice(1)} Section\n\n`;
      items.forEach(item => {
        prompt += `- ${item.suggestion} (triggered by: ${item.file})\n`;
      });
      prompt += "\n";
    });
    
    return prompt;
  }

  async updateClaudeMd(prompt) {
    // Read current CLAUDE.md
    const currentContent = fs.readFileSync(this.claudeMdPath, 'utf8');
    
    // Append update suggestions as a comment for manual review
    const updateMarker = '\n\n<!-- PENDING UPDATES\n' + prompt + '\n-->\n';
    
    // Check if there's already a pending updates section
    if (currentContent.includes('<!-- PENDING UPDATES')) {
      // Replace existing section
      const updated = currentContent.replace(
        /<!-- PENDING UPDATES[\s\S]*?-->/,
        updateMarker.trim()
      );
      fs.writeFileSync(this.claudeMdPath, updated);
    } else {
      // Append to end
      fs.writeFileSync(this.claudeMdPath, currentContent + updateMarker);
    }
  }
}

// Main hook handler
async function main() {
  // Parse input from Claude Code hook
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  
  // Only process Write, Edit, and MultiEdit tools
  if (!['Write', 'Edit', 'MultiEdit'].includes(input.tool)) {
    // Pass through - don't block
    console.log(JSON.stringify({ allow: true }));
    return;
  }
  
  const updater = new ClaudeMemoryUpdater();
  
  // Analyze the change
  if (input.tool === 'Write') {
    updater.analyzeChange(input.tool, input.args.file_path, 'create');
  } else if (input.tool === 'Edit') {
    updater.analyzeChange(input.tool, input.args.file_path, 'modify');
  } else if (input.tool === 'MultiEdit') {
    updater.analyzeChange(input.tool, input.args.file_path, 'modify');
  }
  
  // Generate update suggestions
  const updatePrompt = updater.generateUpdatePrompt();
  
  if (updatePrompt) {
    // Add suggestions to CLAUDE.md for review
    await updater.updateClaudeMd(updatePrompt);
    
    // Return context about the update
    console.log(JSON.stringify({
      allow: true,
      context: `CLAUDE.md may need updating based on this change. Suggestions have been added to the file for review.`
    }));
  } else {
    // No updates needed
    console.log(JSON.stringify({ allow: true }));
  }
}

// Handle errors gracefully
main().catch(err => {
  console.error(JSON.stringify({
    allow: true,
    context: `Hook error (non-blocking): ${err.message}`
  }));
});