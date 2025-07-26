# Restart VSCode Language Servers

To ensure the new ESLint configuration takes effect:

1. **Open Command Palette**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)

2. **Run these commands in order**:
   - `Developer: Reload Window`
   OR
   - `TypeScript: Restart TS Server`
   - `ESLint: Restart ESLint Server`

3. **Clear Problems Panel**:
   - Open Problems panel: `Cmd+Shift+M`
   - Click the filter icon and uncheck/recheck to refresh

4. **Force re-lint all files**:
   - Run task: `Cmd+Shift+P` → `Tasks: Run Task` → `Lint All`

## Alternative: Complete restart
1. Close VSCode completely
2. Run in terminal: `rm -rf node_modules/.cache`
3. Reopen VSCode

The errors showing as severity 8 should now show as warnings (severity 4)!