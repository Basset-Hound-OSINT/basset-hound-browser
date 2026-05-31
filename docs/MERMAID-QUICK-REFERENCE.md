# Mermaid.js Quick Reference Guide

**For Basset Hound Browser Documentation**  
**Last Updated:** May 31, 2026

---

## Quick Start

### Basic Syntax
All Mermaid diagrams use this format in markdown:

```markdown
\`\`\`mermaid
[diagram type and syntax here]
\`\`\`
```

---

## Diagram Types & Templates

### 1. Flowcharts (Most Common)

**When to Use:** Decision trees, process flows, troubleshooting guides

**Template:**
```mermaid
graph TD
    A["Start"] --> B{"Question?"}
    B -->|YES| C["Action 1"]
    B -->|NO| D["Action 2"]
    C --> E["End"]
    D --> E
    
    style A fill:#4a90e2
    style E fill:#50c878
```

**Key Elements:**
- `graph TD` = top-down flowchart
- `graph LR` = left-right flowchart
- `["text"]` = rectangular node
- `{text}` = diamond decision node
- `-->` = arrow
- `-->|label|` = labeled arrow

---

### 2. Directory/Tree Structures

**When to Use:** File hierarchies, module organization, category trees

**Template:**
```mermaid
graph TD
    ROOT["📁 /root/"]
    ROOT --> A["📁 Folder A"]
    ROOT --> B["📄 file.txt"]
    A --> A1["📄 file1.js"]
    A --> A2["📄 file2.js"]
    
    style ROOT fill:#4a90e2
    style A fill:#50c878
```

**Tips:**
- Use emoji for visual distinction (📁 = folder, 📄 = file)
- Keep nesting 3-4 levels max
- Indent text for clarity in complex trees

---

### 3. Architecture Diagrams

**When to Use:** System components, module organization, layer visualization

**Template:**
```mermaid
graph LR
    subgraph FRONTEND["Frontend"]
        A["UI Components"]
        B["Cache Layer"]
    end
    
    subgraph BACKEND["Backend"]
        C["API Server"]
        D["Database"]
    end
    
    A --> B
    B --> C
    C --> D
    
    style FRONTEND fill:#e3f2fd
    style BACKEND fill:#f3e5f5
```

**Tips:**
- Use `subgraph` for grouping related components
- Subgraph names appear as container titles
- Style subgraphs to show logical grouping

---

### 4. Sequence Diagrams

**When to Use:** Interactions between components, API calls, message flows

**Template:**
```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Database
    
    Client->>Server: Request data
    activate Server
    Server->>Database: Query
    activate Database
    Database-->>Server: Results
    deactivate Database
    Server-->>Client: Response
    deactivate Server
```

**Tips:**
- Each `participant` is an entity
- `->>` = synchronous call (solid arrow)
- `-->>` = return (dashed arrow)
- `activate`/`deactivate` = show processing time

---

### 5. State Diagrams

**When to Use:** Status workflows, state transitions, lifecycle stages

**Template:**
```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Running: start()
    Running --> Paused: pause()
    Paused --> Running: resume()
    Running --> Idle: stop()
    Idle --> [*]
    
    note right of Running
        In progress
    end note
```

**Tips:**
- `[*]` represents start/end states
- `state_a --> state_b: condition` shows transitions
- Use `note` to add explanations

---

### 6. Timeline Diagrams

**When to Use:** Project phases, release schedules, deployment timelines

**Template:**
```mermaid
timeline
    title Project Timeline
    
    section Q2 2026
        May 31: Refactoring starts
        June 15: v12.1.0 Release
    
    section Q3 2026
        July 15: v12.2.0 Release
        August 15: v12.3.0 Planning
    
    section Q4 2026
        October 15: v13.0.0 Release
```

**Tips:**
- Use `section` to group related phases
- Each item is `Date: Description`
- Clean visualization of schedules

---

## Common Patterns

### Pattern: Decision Tree
```mermaid
graph TD
    A{"Question 1?"}
    A -->|YES| B{"Question 2?"}
    A -->|NO| C["Action A"]
    B -->|YES| D["Action B"]
    B -->|NO| E["Action C"]
```

### Pattern: Linear Process
```mermaid
graph LR
    A["Step 1"] --> B["Step 2"]
    B --> C["Step 3"]
    C --> D["Step 4"]
    D --> E["Step 5"]
```

### Pattern: Multi-path Flow
```mermaid
graph TD
    A["Start"] --> B["Check"]
    B --> C["Path 1"]
    B --> D["Path 2"]
    B --> E["Path 3"]
    C --> F["Join"]
    D --> F
    E --> F
    F --> G["End"]
```

### Pattern: Error Handling
```mermaid
graph TD
    A["Function Call"]
    A -->|Success| B["Process Result"]
    A -->|Error| C["Handle Error"]
    B --> D["Return"]
    C --> E["Log & Retry"]
    E --> A
    
    style C fill:#ff9999
    style E fill:#ffff99
    style B fill:#99ff99
```

---

## Styling Guide

### Colors (Hex Codes)
- **Blue:** `#4a90e2` - Primary, infrastructure, core systems
- **Green:** `#50c878` - Success, functional modules, completed items
- **Orange:** `#ff9500` - Configuration, tools, utilities
- **Red:** `#ff9999` - Errors, critical issues, warnings
- **Yellow:** `#ffff99` - Investigation, pending, needs attention
- **Purple:** `#9c27b0` - Advanced features, special cases
- **Teal:** `#009688` - Data, geolocation, specialized functions
- **Gray:** `#cccccc` - Disabled, deprecated, inactive

### Style Syntax
```mermaid
graph TD
    A["Node A"]
    B["Node B"]
    C["Node C"]
    
    style A fill:#4a90e2,color:#fff,stroke:#333,stroke-width:2px
    style B fill:#50c878,color:#000,stroke:#333
    style C fill:#ff9999,color:#fff
```

**Common Style Combinations:**
```
style NODE fill:#4a90e2,color:#fff       # Blue button style
style NODE fill:#50c878                  # Green (success)
style NODE fill:#ff9999,stroke:#ff0000   # Red with red border
style NODE fill:#ffff99,stroke:#ffa500   # Yellow/orange warning
```

---

## Accessibility Tips

### 1. Provide Context
Always add a caption above the diagram:
```markdown
**Figure 1: System Architecture**
Shows how frontend communicates with backend services.

\`\`\`mermaid
[diagram here]
\`\`\`
```

### 2. Use Descriptive Labels
❌ Bad:
```mermaid
graph TD
    A --> B --> C
```

✅ Good:
```mermaid
graph TD
    A["Client Request"] --> B["API Processing"]
    B --> C["Database Query"]
```

### 3. Avoid Color-Only Information
❌ Bad: Red and green nodes only (colorblind inaccessible)
✅ Good: Red nodes labeled "Error", green labeled "Success"

### 4. Keep Complexity Reasonable
- Maximum 15-20 nodes per diagram
- If bigger, split into multiple diagrams
- Use subgraphs to organize related items

---

## Validation & Testing

### Before Publishing:

1. **Syntax Check:**
   - Visit https://mermaid.live
   - Paste your diagram code
   - Should render without errors

2. **GitHub Preview:**
   - Push to GitHub branch
   - View markdown preview
   - Verify diagram renders correctly

3. **Local Preview:**
   - VS Code + Markdown Preview Mermaid Support extension
   - Open preview side-by-side with code
   - Check for any rendering issues

### Common Errors:

| Error | Cause | Fix |
|-------|-------|-----|
| Blank diagram | Unclosed quotes | Check all `[""]` are balanced |
| Diagram not appearing | Missing language specifier | Use `` ```mermaid`` not `` ``` `` |
| Layout issues | Too many nested nodes | Split into smaller diagrams |
| Styling not applied | Typo in node ID | Verify `style NODE` matches node name |

---

## Real Examples from Basset Documentation

### Example 1: Module Organization (from FEATURE-DEVELOPMENT-GUIDE)
```mermaid
graph LR
    ROOT["src/"] 
    ROOT --> AGENTS["agents/"]
    ROOT --> ANALYSIS["analysis/"]
    ROOT --> EVASION["evasion/"]
    ROOT --> EXECUTION["execution/"]
    ROOT --> EXPORT["export/"]
    ROOT --> PROXY["proxy/"]
    ROOT --> SESSION["session/"]
    ROOT --> UTILS["utils/"]
    
    style ROOT fill:#4a90e2
    style AGENTS fill:#50c878
    style ANALYSIS fill:#50c878
    style EVASION fill:#ff9500
    style EXECUTION fill:#ff9500
    style EXPORT fill:#ff9500
    style PROXY fill:#ff9500
    style SESSION fill:#50c878
    style UTILS fill:#cccccc
```

### Example 2: Decision Tree (from INCIDENT-RESPONSE)
```mermaid
graph TD
    START["Incident Detected"]
    START --> Q1{"High Error<br/>Rate?"}
    
    Q1 -->|YES| E1{Recent<br/>Deployment?}
    E1 -->|YES| E1A["ROLLBACK"]
    E1 -->|NO| E2{"Wrong Query<br/>Pattern?"}
    E2 -->|YES| E2A["Check Client Version"]
    
    Q1 -->|NO| Q2{"High<br/>Latency?"}
    Q2 -->|YES| L1["Check Connections"]
    
    style START fill:#ff9999
    style E1A fill:#99ff99
    style E2A fill:#ffff99
    style L1 fill:#ffff99
```

---

## Creating Diagrams: Step-by-Step

### Step 1: Choose Diagram Type
```
Decision tree/troubleshooting? → Use flowchart (graph TD)
File/folder structure? → Use tree/graph TD
Components & connections? → Use architecture (graph LR + subgraph)
Sequence of events? → Use timeline or sequence
State transitions? → Use state diagram
```

### Step 2: Outline Your Diagram
- List all nodes/elements
- Identify connections/relationships
- Determine flow direction (top-down, left-right)

### Step 3: Write Mermaid Code
- Start with `\`\`\`mermaid` and `graph TD/LR`
- Add nodes: `A["Label"]`
- Add connections: `A --> B`
- Add styling: `style A fill:#color`

### Step 4: Validate
- Paste in mermaid.live
- Should render without errors
- Check layout and spacing

### Step 5: Add Context
- Write descriptive caption
- Explain what diagram shows
- Include data sources/references

---

## Best Practices Checklist

- [ ] **Clear purpose** - Diagram has descriptive caption
- [ ] **Simple design** - Not overly complex, <20 nodes
- [ ] **Good labels** - All nodes have descriptive text
- [ ] **Logical flow** - Direction is clear (TD or LR)
- [ ] **Styled** - Uses project color scheme
- [ ] **Accessible** - Colorblind friendly, labels used
- [ ] **Tested** - Validates on mermaid.live
- [ ] **Documented** - Includes context paragraph
- [ ] **Maintainable** - Code is clean and commented
- [ ] **Relevant** - Adds value vs surrounding text

---

## Resources & Links

- **Mermaid Official Docs:** https://mermaid.js.org/
- **Live Editor:** https://mermaid.live
- **GitHub Mermaid Support:** https://github.blog/2022-02-14-include-diagrams-markdown-files/
- **Basset Documentation:** `/docs/MERMAID-DIAGRAMS-CONVERSION-REPORT-2026-05-31.md`
- **VS Code Extension:** "Markdown Preview Mermaid Support"

---

## Quick Troubleshooting

**Diagram Not Showing Up?**
- Check markdown uses `` ```mermaid`` with correct backticks
- Verify no syntax errors on mermaid.live
- Check browser javascript is enabled
- Try refreshing the page

**Colors Look Wrong?**
- Check hex codes are correct (e.g., `#4a90e2` not `#4A90E2`)
- Verify `fill:` syntax is correct
- Test on mermaid.live first

**Text Overlapping?**
- Shorten labels or split across lines with `<br/>`
- Reduce number of nodes
- Use `graph LR` instead of `graph TD` if horizontal is better

**Changes Not Appearing?**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check file was actually saved

---

**Happy Diagramming! 📊**

For questions or improvements to this guide, see MERMAID-DIAGRAMS-CONVERSION-REPORT-2026-05-31.md
