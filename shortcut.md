1. Open Automator

Press Cmd + Space

Type Automator

Select Application (not Quick Action)

2. Add “Run Shell Script”

In the left panel, search Run Shell Script

Drag it into the workflow

3. Configure the script

Set:

Shell: /bin/zsh (or /bin/bash)

Pass input: to stdin

Paste this:

```
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd /Users/I566809/Documents/Repositories/note-gen || exit
npm run start
```

4. Save to Desktop