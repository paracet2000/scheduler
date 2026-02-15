# Git Common Commands (PowerShell)

## 1) Setup User
```powershell
# Set identity for current repository only
git config user.name "paracet2000"
git config user.email "paracet2000@users.noreply.github.com"

# Set identity globally
git config --global user.name "paracet2000"
git config --global user.email "paracet2000@users.noreply.github.com"

# Verify config source and values
git config --list --show-origin | Select-String "user.name|user.email|credential.helper"
```

## 2) Start Work / Check Status
```powershell
git status
git branch
git remote -v
git fetch --all --prune
```

## 3) Stage + Commit
```powershell
# Show changed files
git status --short

# Stage all changes
git add -A

# Or stage specific files
git add index.html styles.css js/index.js

# Commit
git commit -m "update menu behavior and drawer scroll"
```

## 4) Push / Pull
```powershell
# First push for branch
git push -u origin main

# Normal push
git push

# Pull latest
git pull

# Pull with rebase
git pull --rebase
```

## 5) Branch Commands
```powershell
# Create and switch to new branch
git switch -c feature/menu-drawer

# Switch branch
git switch main

# Delete local branch
git branch -d feature/menu-drawer

# Delete remote branch
git push origin --delete feature/menu-drawer
```

## 6) View History / Diff
```powershell
git log --oneline -n 20
git show HEAD
git diff
git diff --staged
```

## 7) Fix Last Commit
```powershell
# Change last commit message
git commit --amend -m "update menu"

# Add more changes into last commit
git add -A
git commit --amend --no-edit
```

## 8) Undo (Safe)
```powershell
# Unstage file but keep local changes
git restore --staged <file>

# Discard local changes in file
git restore <file>

# Revert a commit safely (good for already-pushed history)
git revert <commit_hash>
```

## 9) Stash
```powershell
git stash push -m "wip: sidebar tweak"
git stash list
git stash pop
```

## 10) Credential / Account (Windows)
```powershell
# Use Git Credential Manager
git config --global credential.helper manager-core

# Remove cached github.com credentials from file store (if used)
$credFile = Join-Path $HOME '.git-credentials'
if (Test-Path $credFile) {
  (Get-Content $credFile) | Where-Object { $_ -notmatch 'github\.com' } | Set-Content $credFile
}

# Remove github.com credential from Git Credential Manager
"protocol=https`nhost=github.com`n`n" | git credential-manager erase

# Remove github.com credential from Windows Credential Manager
cmdkey /delete:LegacyGeneric:target=git:https://github.com

# Verify remaining github credentials (should be empty)
cmdkey /list | Select-String github
```

## 11) Quick Daily Flow
```powershell
git fetch --all --prune
git pull --rebase
git add -A
git commit -m "your message"
git push
```
