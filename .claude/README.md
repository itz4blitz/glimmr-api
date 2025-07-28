# Claude Intelligence System

This directory contains the Glimmr project intelligence system that enhances Claude's understanding and effectiveness.

## Structure

```
.claude/
├── memory/                     # Domain knowledge and context
│   ├── hospital-data-patterns.json      # Healthcare file format patterns
│   ├── pricing-terminology.json         # Healthcare pricing terms
│   ├── compliance-requirements.json     # CMS regulations & compliance
│   ├── performance-benchmarks.json      # Performance targets
│   ├── ai-feedback-tracker.json        # AI learning & feedback loop
│   ├── current-sprint-goals.md         # Current priorities (user-maintained)
│   ├── recent-incidents.md             # Known issues (user-maintained)
│   └── performance-bottlenecks.md      # Auto-generated bottlenecks
├── scripts/
│   ├── project-context.sh              # Gathers runtime context
│   └── update-ai-feedback.sh           # Updates AI feedback tracker
└── agents/                     # Agent-specific knowledge (if created)
```

## Usage

### Before Complex Tasks

Run the context gatherer to give Claude full project awareness:

```bash
.claude/scripts/project-context.sh
```

This collects:
- Service health (Docker, API, database, Redis)
- Queue metrics (job statuses)
- Database statistics
- Recent errors
- Performance metrics
- Git status

### Recording AI Feedback

Track Claude's performance to improve future suggestions:

```bash
# Interactive mode
.claude/scripts/update-ai-feedback.sh

# Command line mode
.claude/scripts/update-ai-feedback.sh accept codeStructure "WebSocket events" "Real-time updates"
.claude/scripts/update-ai-feedback.sh reject "Direct file access" "Must use StorageService" "StorageService.uploadFile()"
.claude/scripts/update-ai-feedback.sh metric performance true
.claude/scripts/update-ai-feedback.sh stats
```

### Maintaining Context Files

Keep these files updated for better Claude assistance:

1. **current-sprint-goals.md** - Update with current priorities
2. **recent-incidents.md** - Document issues and resolutions
3. **ai-feedback-tracker.json** - Auto-updated by feedback script

## Domain Knowledge Files

### hospital-data-patterns.json
- Common CSV/JSON/XML formats
- Encoding issues and solutions
- Data quality patterns
- File size handling strategies
- Parsing approaches

### pricing-terminology.json
- Healthcare pricing types (gross charge, negotiated rate, etc.)
- Service codes (CPT, HCPCS, DRG)
- Payer categories and variations
- Common acronyms and terms

### compliance-requirements.json
- CMS Hospital Price Transparency rules
- Required data elements
- Penalties and enforcement
- Technical standards
- Common violations

### performance-benchmarks.json
- API response time targets
- Job processing metrics
- Database query performance
- Frontend performance goals
- Scalability targets

## Benefits

1. **Consistent Suggestions** - Claude references proven patterns
2. **Domain Expertise** - Deep healthcare pricing knowledge
3. **Performance Awareness** - Targets specific benchmarks
4. **Learning System** - Improves based on feedback
5. **Context Awareness** - Understands current system state

## Best Practices

1. Run `project-context.sh` before major development sessions
2. Update feedback tracker when accepting/rejecting suggestions
3. Keep sprint goals and incidents current
4. Review AI feedback stats monthly
5. Add new patterns to knowledge files as discovered

## Integration with CLAUDE.md

The main CLAUDE.md file references this intelligence system in its "Dynamic Context & Intelligence" section, making these resources available during all Claude interactions.