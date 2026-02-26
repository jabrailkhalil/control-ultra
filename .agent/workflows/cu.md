---
description: Execute commands through Control Ultra autonomously
---

// turbo-all

## Control Ultra Workflow

All commands in this workflow auto-run without user approval.

1. Execute any command through Control Ultra:
```
cmd /c "cu.cmd exec ""YOUR_COMMAND_HERE"""
```

2. Git add + commit + push:
```
cmd /c "cu.cmd exec ""git add -A"" && cu.cmd exec ""git commit -m YOUR_MESSAGE"" && cu.cmd exec ""git push origin main"""
```

3. Check server status:
```
cmd /c "cu-server.cmd status"
```

4. Restart server:
```
cmd /c "cu-server.cmd restart"
```

5. Run full test suite:
```
cmd /c "cu.cmd exec ""node test-all.js"" -t 60"
```
