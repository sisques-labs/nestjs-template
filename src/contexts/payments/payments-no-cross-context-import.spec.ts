import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('payments bounded context — no cross-context imports', () => {
  it('has no import from any @contexts/ path other than its own', () => {
    const contextDir = join(__dirname);

    const output = execSync(
      `find "${contextDir}" -name "*.ts" -not -name "*.spec.ts" -not -name "*.e2e-spec.ts"`,
    )
      .toString()
      .trim();

    const files = output.split('\n').filter(Boolean);

    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    // Any `@contexts/<name>` import where <name> isn't 'payments'.
    const forbidden = /from\s+['"]@contexts\/(?!payments\/)[^'"]+['"]/;

    for (const file of files) {
      const relativePath = file.replace(contextDir + '/', '');
      const content = readFileSync(file, 'utf8');
      if (forbidden.test(content)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
