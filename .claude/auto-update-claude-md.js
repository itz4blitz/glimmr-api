#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ClaudeMemoryAutoUpdater {
  constructor() {
    this.claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    this.updates = [];
  }

  // Detect new npm scripts
  detectNewScripts() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('apps/api/package.json', 'utf8'));
      const rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      const allScripts = {
        ...rootPackageJson.scripts,
        api: packageJson.scripts
      };
      
      // Scripts that should be in CLAUDE.md
      const importantScripts = [
        'dev', 'build', 'test', 'lint', 'format', 'check-types',
        'start:dev', 'start:prod', 'test:watch', 'test:cov', 'test:e2e',
        'db:generate', 'db:migrate', 'db:push', 'db:studio', 'db:seed'
      ];
      
      const newScripts = [];
      Object.entries(allScripts).forEach(([key, value]) => {
        if (key.includes('db:') || key.includes('test') || key.includes('dev') || 
            key.includes('build') || key.includes('lint') || key.includes('format')) {
          // Check if this script is documented
          const claudeContent = fs.readFileSync(this.claudeMdPath, 'utf8');
          if (!claudeContent.includes(key)) {
            newScripts.push({ name: key, command: value });
          }
        }
      });
      
      return newScripts;
    } catch (err) {
      return [];
    }
  }

  // Detect new environment variables
  detectNewEnvVars() {
    try {
      const envExample = fs.readFileSync('apps/api/.env.production.example', 'utf8');
      const claudeContent = fs.readFileSync(this.claudeMdPath, 'utf8');
      
      const envVars = envExample.match(/^([A-Z_]+)=/gm) || [];
      const newVars = [];
      
      envVars.forEach(varLine => {
        const varName = varLine.replace('=', '');
        if (!claudeContent.includes(varName)) {
          newVars.push(varName);
        }
      });
      
      return newVars;
    } catch (err) {
      return [];
    }
  }

  // Detect new modules
  detectNewModules() {
    try {
      const modulesDir = 'apps/api/src';
      const existingDirs = fs.readdirSync(modulesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      
      const claudeContent = fs.readFileSync(this.claudeMdPath, 'utf8');
      const documented = claudeContent.match(/\/apps\/api\/src\/([^/]+)\//g) || [];
      const documentedModules = documented.map(m => m.split('/')[4]);
      
      return existingDirs.filter(dir => 
        !documentedModules.includes(dir) && 
        !['common', 'config', 'main.ts'].includes(dir)
      );
    } catch (err) {
      return [];
    }
  }

  // Generate automatic updates
  generateUpdates(toolName, filePath) {
    const updates = [];
    
    // Check for new scripts
    const newScripts = this.detectNewScripts();
    if (newScripts.length > 0) {
      updates.push({
        type: 'scripts',
        data: newScripts
      });
    }
    
    // Check for new env vars
    const newEnvVars = this.detectNewEnvVars();
    if (newEnvVars.length > 0) {
      updates.push({
        type: 'env',
        data: newEnvVars
      });
    }
    
    // Check for new modules
    const newModules = this.detectNewModules();
    if (newModules.length > 0) {
      updates.push({
        type: 'modules',
        data: newModules
      });
    }
    
    // Check specific file changes
    if (filePath) {
      if (filePath.includes('/jobs/processors/') && filePath.endsWith('.ts')) {
        const processorName = path.basename(filePath, '.ts');
        updates.push({
          type: 'processor',
          data: processorName
        });
      }
      
      if (filePath.includes('/database/schema/') && filePath.endsWith('.ts')) {
        const schemaName = path.basename(filePath, '.ts');
        updates.push({
          type: 'schema',
          data: schemaName
        });
      }
    }
    
    return updates;
  }

  // Apply updates to CLAUDE.md
  applyUpdates(updates) {
    if (updates.length === 0) return false;
    
    let content = fs.readFileSync(this.claudeMdPath, 'utf8');
    let updated = false;
    
    updates.forEach(update => {
      switch (update.type) {
        case 'scripts':
          // Add new scripts to the commands section
          const commandsMatch = content.match(/(## Essential Commands[\s\S]*?)(## [A-Z])/);
          if (commandsMatch) {
            let commandsSection = commandsMatch[1];
            update.data.forEach(script => {
              const category = this.categorizeScript(script.name);
              const categoryRegex = new RegExp(`(### ${category}[\\s\\S]*?)(### [A-Z]|## [A-Z])`, 'i');
              const categoryMatch = commandsSection.match(categoryRegex);
              
              if (categoryMatch) {
                const addition = `pnpm ${script.name}           # ${this.getScriptDescription(script.name)}\n`;
                commandsSection = commandsSection.replace(
                  categoryRegex,
                  `$1${addition}$2`
                );
                updated = true;
              }
            });
            content = content.replace(commandsMatch[1], commandsSection);
          }
          break;
          
        case 'env':
          // Add new env vars to setup section
          const envMatch = content.match(/(### Environment Variables[\s\S]*?```env[\s\S]*?)(```)/);
          if (envMatch) {
            let envSection = envMatch[1];
            update.data.forEach(varName => {
              envSection += `${varName}=\n`;
            });
            content = content.replace(envMatch[1], envSection);
            updated = true;
          }
          break;
          
        case 'modules':
          // Add new modules to architecture section
          const moduleMatch = content.match(/(### Module Structure[\s\S]*?)(### [A-Z])/);
          if (moduleMatch) {
            let moduleSection = moduleMatch[1];
            update.data.forEach(moduleName => {
              moduleSection += `- \`/apps/api/src/${moduleName}/\` - ${this.getModuleDescription(moduleName)}\n`;
            });
            content = content.replace(moduleMatch[1], moduleSection);
            updated = true;
          }
          break;
          
        case 'processor':
          // Add new processor to job processing section
          const jobMatch = content.match(/(### Job Processing System[\s\S]*?)(### [A-Z]|## [A-Z])/);
          if (jobMatch) {
            let jobSection = jobMatch[1];
            const listMatch = jobSection.match(/(\d+\. \*\*[^*]+\*\* - [^\n]+\n)+/);
            if (listMatch) {
              const lastNum = parseInt(listMatch[0].match(/(\d+)\./g).pop().replace('.', ''));
              jobSection = jobSection.replace(
                listMatch[0],
                listMatch[0] + `${lastNum + 1}. **${update.data}** - [New processor - needs description]\n`
              );
              content = content.replace(jobMatch[1], jobSection);
              updated = true;
            }
          }
          break;
          
        case 'schema':
          // Add new schema to database section
          const schemaMatch = content.match(/(### Database Schema Organization[\s\S]*?)(### [A-Z])/);
          if (schemaMatch) {
            let schemaSection = schemaMatch[1];
            schemaSection += `- \`${update.data}.*\` - [New schema - needs description]\n`;
            content = content.replace(schemaMatch[1], schemaSection);
            updated = true;
          }
          break;
      }
    });
    
    if (updated) {
      // Add update marker
      const date = new Date().toISOString().split('T')[0];
      if (!content.includes('<!-- Last auto-update:')) {
        content += `\n<!-- Last auto-update: ${date} -->\n`;
      } else {
        content = content.replace(/<!-- Last auto-update: [\d-]+ -->/, `<!-- Last auto-update: ${date} -->`);
      }
      
      fs.writeFileSync(this.claudeMdPath, content);
    }
    
    return updated;
  }

  categorizeScript(scriptName) {
    if (scriptName.includes('test')) return 'Testing';
    if (scriptName.includes('db:')) return 'Development';
    if (scriptName.includes('build') || scriptName.includes('start:prod')) return 'Build & Production';
    return 'Development';
  }

  getScriptDescription(scriptName) {
    const descriptions = {
      'db:generate': 'Generate migrations from schema changes',
      'db:migrate': 'Apply migrations',
      'db:push': 'Push schema (dev only)',
      'db:studio': 'Open database GUI',
      'db:seed': 'Seed initial data',
      'test': 'Run unit tests',
      'test:watch': 'Watch mode',
      'test:cov': 'Coverage report',
      'test:e2e': 'E2E tests'
    };
    return descriptions[scriptName] || 'Auto-detected script';
  }

  getModuleDescription(moduleName) {
    const descriptions = {
      'auth': 'Authentication and authorization',
      'users': 'User management',
      'config': 'Application configuration',
      'common': 'Shared utilities and types'
    };
    return descriptions[moduleName] || '[Auto-detected module - needs description]';
  }
}

// Main hook handler
async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  
  if (!['Write', 'Edit', 'MultiEdit'].includes(input.tool)) {
    console.log(JSON.stringify({ allow: true }));
    return;
  }
  
  const updater = new ClaudeMemoryAutoUpdater();
  const filePath = input.args?.file_path || input.args?.edits?.[0]?.file_path;
  
  // Generate and apply updates
  const updates = updater.generateUpdates(input.tool, filePath);
  const wasUpdated = updater.applyUpdates(updates);
  
  if (wasUpdated) {
    console.log(JSON.stringify({
      allow: true,
      context: `CLAUDE.md was automatically updated with new project information. Review the changes to ensure accuracy.`
    }));
  } else {
    console.log(JSON.stringify({ allow: true }));
  }
}

main().catch(err => {
  console.log(JSON.stringify({
    allow: true,
    context: `Auto-update error (non-blocking): ${err.message}`
  }));
});