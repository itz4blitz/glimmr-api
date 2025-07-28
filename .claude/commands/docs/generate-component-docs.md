# Generate Component Documentation Command

This command documents all React components with props, usage examples, and generates Storybook stories.

## Usage

```bash
/docs/generate-component-docs
```

## What it does

1. **Document React Components**
   - Extracts component props using TypeScript AST
   - Documents prop types, defaults, and descriptions
   - Generates usage examples from existing code

2. **Generate Storybook Stories**
   - Creates stories for new UI components
   - Sets up different component states
   - Includes interactive controls

3. **Create Visual Regression Baselines**
   - Captures component screenshots
   - Generates visual test baselines
   - Documents visual variations

4. **Update Component Library Docs**
   - Updates component catalog
   - Creates interactive examples
   - Generates prop tables

## Process

### Step 1: Component Analysis
```typescript
// Extracts from components:
interface ButtonProps {
  /** The button variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  ...props
}) => {
  // Component implementation
};
```

### Step 2: Story Generation
```typescript
// Generated story:
export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'danger']
    }
  }
};

export const Default = {
  args: {
    children: 'Click me'
  }
};
```

### Step 3: Documentation Output
Creates comprehensive component documentation:
- `docs/components/README.md` - Component library overview
- `docs/components/[component].md` - Individual component docs
- `apps/web/src/stories/` - Storybook stories
- `docs/components/examples/` - Usage examples
- `docs/components/patterns.md` - Common patterns

## Implementation Script

```bash
#!/bin/bash
# This script is executed when the command runs

set -euo pipefail

echo "🎨 Generating Component Documentation..."

# Create documentation directories
mkdir -p docs/components/{examples,screenshots}
mkdir -p apps/web/src/stories

# Step 1: Extract component documentation
echo "📝 Analyzing React components..."
node -e "
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const ts = require('typescript');

// Component documentation collector
const components = {};

// Parse TypeScript files
function parseComponent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  
  const componentInfo = {
    name: path.basename(filePath, '.tsx'),
    path: filePath,
    props: {},
    description: '',
    examples: []
  };
  
  // Visit AST nodes
  function visit(node) {
    // Find interface/type for props
    if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith('Props')) {
      node.members.forEach(member => {
        if (ts.isPropertySignature(member)) {
          const propName = member.name.getText();
          const propType = member.type ? member.type.getText() : 'any';
          const isOptional = !!member.questionToken;
          
          // Extract JSDoc comments
          const jsDoc = ts.getJSDocCommentsAndTags(member);
          const description = jsDoc.length > 0 ? jsDoc[0].comment : '';
          
          componentInfo.props[propName] = {
            type: propType,
            required: !isOptional,
            description: description || ''
          };
        }
      });
    }
    
    // Find component declaration
    if (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) {
      const jsDoc = ts.getJSDocCommentsAndTags(node);
      if (jsDoc.length > 0) {
        componentInfo.description = jsDoc[0].comment || '';
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return componentInfo;
}

// Process all component files
const componentFiles = glob.sync('apps/web/src/components/**/*.tsx', {
  ignore: ['**/*.test.tsx', '**/*.spec.tsx', '**/*.stories.tsx']
});

componentFiles.forEach(file => {
  const info = parseComponent(file);
  if (Object.keys(info.props).length > 0) {
    components[info.name] = info;
  }
});

// Save component data
fs.writeFileSync(
  'docs/components/components.json',
  JSON.stringify(components, null, 2)
);

console.log('✅ Analyzed', Object.keys(components).length, 'components');
"

# Step 2: Find component usage examples
echo "🔍 Finding usage examples..."
node -e "
const fs = require('fs');
const glob = require('glob');
const components = JSON.parse(fs.readFileSync('docs/components/components.json'));

// Search for component usage
Object.keys(components).forEach(componentName => {
  const examples = [];
  
  // Search in all TSX files
  const files = glob.sync('apps/web/src/**/*.tsx', {
    ignore: ['**/node_modules/**', '**/dist/**']
  });
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Find component usage with regex
    const regex = new RegExp(\`<\${componentName}[\\\\s>]\`, 'g');
    const matches = content.match(regex);
    
    if (matches) {
      // Extract the full component usage
      matches.forEach(match => {
        const startIndex = content.indexOf(match);
        let endIndex = startIndex;
        let depth = 1;
        
        // Find closing tag
        for (let i = startIndex + match.length; i < content.length && depth > 0; i++) {
          if (content[i] === '<' && content[i + 1] === '/') {
            depth--;
          } else if (content[i] === '<' && content[i + 1] !== '/') {
            depth++;
          }
          endIndex = i;
        }
        
        const example = content.substring(startIndex, endIndex + 1);
        if (example.length < 500) { // Reasonable example size
          examples.push({
            code: example,
            file: path.relative('apps/web/src', file)
          });
        }
      });
    }
  });
  
  components[componentName].examples = examples.slice(0, 3); // Keep top 3 examples
});

fs.writeFileSync(
  'docs/components/components-with-examples.json',
  JSON.stringify(components, null, 2)
);

console.log('✅ Found usage examples');
"

# Step 3: Generate Storybook stories
echo "📚 Generating Storybook stories..."
node -e "
const fs = require('fs');
const path = require('path');
const components = JSON.parse(fs.readFileSync('docs/components/components-with-examples.json'));

Object.entries(components).forEach(([name, info]) => {
  // Skip if story already exists
  const storyPath = \`apps/web/src/stories/\${name}.stories.tsx\`;
  if (fs.existsSync(storyPath)) return;
  
  // Generate story content
  let storyContent = \`import type { Meta, StoryObj } from '@storybook/react';
import { \${name} } from '\${info.path.replace('apps/web/src/', '@/')}';

const meta = {
  title: 'Components/\${name}',
  component: \${name},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {\`;
  
  // Add argTypes for props
  Object.entries(info.props).forEach(([propName, propInfo]) => {
    storyContent += \`
    \${propName}: {
      description: '\${propInfo.description}',
      control: {\`;
    
    // Determine control type based on prop type
    if (propInfo.type.includes('|')) {
      const options = propInfo.type.split('|').map(t => t.trim().replace(/['"]/g, ''));
      storyContent += \`
        type: 'select',
        options: [\${options.map(o => \`'\${o}'\`).join(', ')}]
      },\`;
    } else if (propInfo.type === 'boolean') {
      storyContent += \`
        type: 'boolean'
      },\`;
    } else {
      storyContent += \`
        type: 'text'
      },\`;
    }
    
    storyContent += \`
      required: \${!propInfo.required}
    },\`;
  });
  
  storyContent += \`
  },
} satisfies Meta<typeof \${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {\`;
  
  // Add default args
  Object.entries(info.props).forEach(([propName, propInfo]) => {
    if (propInfo.required) {
      let defaultValue = "''";
      if (propInfo.type === 'boolean') defaultValue = 'false';
      else if (propInfo.type === 'number') defaultValue = '0';
      else if (propName === 'children') defaultValue = "'Example content'";
      
      storyContent += \`
    \${propName}: \${defaultValue},\`;
    }
  });
  
  storyContent += \`
  },
};

// Additional stories based on examples
\`;

  // Add stories based on found examples
  info.examples.forEach((example, index) => {
    storyContent += \`
export const Example\${index + 1}: Story = {
  args: {
    // Extracted from: \${example.file}
    children: 'Example \${index + 1}',
  },
};\`;
  });
  
  fs.writeFileSync(storyPath, storyContent);
});

console.log('✅ Generated Storybook stories');
"

# Step 4: Generate component documentation
echo "📄 Generating component documentation..."
node -e "
const fs = require('fs');
const components = JSON.parse(fs.readFileSync('docs/components/components-with-examples.json'));

// Generate individual component docs
Object.entries(components).forEach(([name, info]) => {
  let content = \`# \${name}\n\n\`;
  
  if (info.description) {
    content += \`\${info.description}\n\n\`;
  }
  
  content += \`## Import\n\n\\\`\\\`\\\`typescript\nimport { \${name} } from '@/components/\${info.path.split('/').slice(-2, -1)[0]}/\${name}';\n\\\`\\\`\\\`\n\n\`;
  
  content += \`## Props\n\n\`;
  content += \`| Prop | Type | Required | Default | Description |\n\`;
  content += \`|------|------|----------|---------|-------------|\n\`;
  
  Object.entries(info.props).forEach(([propName, propInfo]) => {
    content += \`| \${propName} | \\\`\${propInfo.type}\\\` | \${propInfo.required ? 'Yes' : 'No'} | - | \${propInfo.description} |\n\`;
  });
  
  content += \`\n## Usage Examples\n\n\`;
  
  // Add basic example
  content += \`### Basic Usage\n\n\\\`\\\`\\\`tsx\n<\${name}\`;
  Object.entries(info.props).forEach(([propName, propInfo]) => {
    if (propInfo.required) {
      let value = "\"\"";
      if (propInfo.type === 'boolean') value = '{true}';
      else if (propInfo.type === 'number') value = '{42}';
      else if (propName === 'children') value = '\n  Example content\n<';
      
      if (propName !== 'children') {
        content += \`\n  \${propName}=\${value}\`;
      }
    }
  });
  
  if (info.props.children) {
    content += \`>\n  Example content\n</\${name}>\n\\\`\\\`\\\`\n\n\`;
  } else {
    content += \` />\n\\\`\\\`\\\`\n\n\`;
  }
  
  // Add found examples
  if (info.examples.length > 0) {
    content += \`### Real-world Examples\n\n\`;
    info.examples.forEach((example, index) => {
      content += \`#### Example \${index + 1} (from \${example.file})\n\n\`;
      content += \`\\\`\\\`\\\`tsx\n\${example.code}\n\\\`\\\`\\\`\n\n\`;
    });
  }
  
  // Add Storybook link
  content += \`## Interactive Example\n\n\`;
  content += \`View and interact with this component in [Storybook](http://localhost:6006/?path=/story/components-\${name.toLowerCase()}--default).\n\n\`;
  
  // Add related components
  content += \`## Related Components\n\n\`;
  content += \`- [Button](./Button.md)\n\`;
  content += \`- [Card](./Card.md)\n\`;
  
  fs.writeFileSync(\`docs/components/\${name}.md\`, content);
});

console.log('✅ Generated component documentation');
"

# Step 5: Generate component library overview
cat > docs/components/README.md << 'EOF'
# Component Library

Welcome to the Glimmr component library documentation. This library contains all the reusable React components used throughout the application.

## 🎨 Design System

Our components follow a consistent design system based on:
- **Colors**: OKLCH color space for perfect light/dark mode transitions
- **Typography**: System font stack with consistent sizing
- **Spacing**: 4px grid system
- **Shadows**: Layered elevation system
- **Animations**: Framer Motion for smooth interactions

## 📦 Available Components

### Layout Components
- [AppLayout](./AppLayout.md) - Main application layout wrapper
- [Sidebar](./Sidebar.md) - Navigation sidebar
- [Header](./Header.md) - Page header with actions

### Form Components
- [Button](./Button.md) - Interactive button component
- [Input](./Input.md) - Text input field
- [Select](./Select.md) - Dropdown selection
- [Checkbox](./Checkbox.md) - Checkbox input
- [Form](./Form.md) - Form wrapper with validation

### Display Components
- [Card](./Card.md) - Content container
- [Badge](./Badge.md) - Status indicators
- [Table](./Table.md) - Data table
- [Chart](./Chart.md) - Data visualization

### Feedback Components
- [Alert](./Alert.md) - Alert messages
- [Toast](./Toast.md) - Toast notifications
- [Dialog](./Dialog.md) - Modal dialogs
- [Tooltip](./Tooltip.md) - Hover tooltips

## 🚀 Getting Started

### Installation

Components are already part of the project. Import them directly:

```typescript
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
```

### Basic Usage

```tsx
import { Button } from '@/components/ui/button';

function MyComponent() {
  return (
    <Button variant="primary" onClick={() => alert('Clicked!')}>
      Click me
    </Button>
  );
}
```

## 🎯 Best Practices

### 1. Composition over Configuration
```tsx
// ✅ Good - Composable
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// ❌ Bad - Too many props
<Card title="Title" content="Content" footer="Footer" />
```

### 2. Consistent Naming
- Use descriptive prop names
- Follow TypeScript conventions
- Document all props with JSDoc

### 3. Accessibility
- All interactive components support keyboard navigation
- ARIA labels where appropriate
- Color contrast meets WCAG standards

### 4. Performance
- Components are memoized where beneficial
- Lazy load heavy components
- Use CSS-in-JS efficiently

## 🧪 Testing Components

### Unit Tests
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### Visual Tests
All components have visual regression tests. Run:
```bash
npm run test:visual
```

## 📚 Storybook

View all components interactively in Storybook:

```bash
npm run storybook
```

Visit [http://localhost:6006](http://localhost:6006)

## 🎨 Theming

Components support light and dark themes automatically:

```tsx
import { ThemeProvider } from '@/components/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <YourApp />
    </ThemeProvider>
  );
}
```

## 📱 Responsive Design

All components are mobile-first and responsive:

```tsx
<Button
  size="sm" // on mobile
  className="md:size-md lg:size-lg" // responsive sizing
>
  Responsive Button
</Button>
```

## 🔧 Customization

### Using className
```tsx
<Button className="custom-class">Custom Button</Button>
```

### Using style props
```tsx
<Card style={{ backgroundColor: 'var(--custom-bg)' }}>
  Custom styled card
</Card>
```

### Extending components
```tsx
const CustomButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { customProp?: string }
>(({ customProp, ...props }, ref) => {
  return <Button ref={ref} {...props} />;
});
```
EOF

# Generate component catalog
echo "📊 Generating component catalog..."
node -e "
const fs = require('fs');
const components = JSON.parse(fs.readFileSync('docs/components/components-with-examples.json'));

let catalog = '# Component Catalog\n\n';
catalog += 'Total components: ' + Object.keys(components).length + '\n\n';

// Group by category
const categories = {
  'Layout': [],
  'Form': [],
  'Display': [],
  'Feedback': [],
  'Utility': []
};

Object.entries(components).forEach(([name, info]) => {
  // Categorize based on path or name
  let category = 'Utility';
  if (info.path.includes('/layout/')) category = 'Layout';
  else if (info.path.includes('/form/') || name.includes('Input') || name.includes('Form')) category = 'Form';
  else if (info.path.includes('/display/') || name.includes('Table') || name.includes('List')) category = 'Display';
  else if (info.path.includes('/feedback/') || name.includes('Alert') || name.includes('Toast')) category = 'Feedback';
  
  categories[category].push({ name, info });
});

Object.entries(categories).forEach(([category, items]) => {
  if (items.length > 0) {
    catalog += \`## \${category} Components\n\n\`;
    items.forEach(({ name, info }) => {
      catalog += \`- [\${name}](./\${name}.md) - \${info.description || 'No description'}\n\`;
    });
    catalog += '\n';
  }
});

fs.writeFileSync('docs/components/catalog.md', catalog);
console.log('✅ Generated component catalog');
"

# Step 6: Generate visual regression baselines
echo "📸 Setting up visual regression tests..."
cat > apps/web/src/tests/visual-regression.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';
import fs from 'fs';

// Load component list
const components = JSON.parse(
  fs.readFileSync('docs/components/components.json', 'utf8')
);

Object.keys(components).forEach(componentName => {
  test.describe(`Component: ${componentName}`, () => {
    test('default state', async ({ page }) => {
      await page.goto(`http://localhost:6006/iframe.html?id=components-${componentName.toLowerCase()}--default`);
      await page.waitForTimeout(1000); // Wait for animations
      
      await expect(page).toHaveScreenshot(`${componentName}-default.png`);
    });
    
    test('hover state', async ({ page }) => {
      await page.goto(`http://localhost:6006/iframe.html?id=components-${componentName.toLowerCase()}--default`);
      await page.waitForTimeout(1000);
      
      const element = page.locator(`[data-testid="${componentName}"]`).first();
      await element.hover();
      
      await expect(page).toHaveScreenshot(`${componentName}-hover.png`);
    });
    
    test('dark mode', async ({ page }) => {
      await page.goto(`http://localhost:6006/iframe.html?id=components-${componentName.toLowerCase()}--default&globals=theme:dark`);
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot(`${componentName}-dark.png`);
    });
  });
});
EOF

# Generate patterns documentation
cat > docs/components/patterns.md << 'EOF'
# Component Patterns

## Common Patterns and Best Practices

### Form Handling Pattern
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function LoginForm() {
  const form = useForm({
    resolver: zodResolver(schema)
  });
  
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}
```

### Loading States Pattern
```tsx
function DataList() {
  const { data, isLoading, error } = useQuery();
  
  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <Alert variant="error">{error.message}</Alert>;
  
  return <Table data={data} />;
}
```

### Modal Pattern
```tsx
function ConfirmDialog({ onConfirm }) {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => {
            onConfirm();
            setOpen(false);
          }}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
EOF

echo "✅ Component documentation generated successfully!"
echo "📁 Documentation available in: docs/components/"
echo "🎨 Run 'npm run storybook' to view interactive examples"
```

## Output Structure

```
docs/components/
├── README.md                # Component library overview
├── catalog.md              # Component catalog by category
├── patterns.md             # Common usage patterns
├── components.json         # Component metadata
├── [Component].md          # Individual component docs
├── examples/               # Usage examples
└── screenshots/            # Visual regression baselines

apps/web/src/stories/
├── [Component].stories.tsx # Generated Storybook stories
└── ...
```