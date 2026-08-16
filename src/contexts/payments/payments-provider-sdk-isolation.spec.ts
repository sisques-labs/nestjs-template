import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('payments bounded context — Stripe SDK isolation', () => {
  it('imports the stripe package only from the Stripe adapter', () => {
    const contextDir = join(__dirname);

    const output = execSync(
      `find "${contextDir}" -name "*.ts" -not -name "*.spec.ts" -not -name "*.e2e-spec.ts"`,
    )
      .toString()
      .trim();

    const files = output.split('\n').filter(Boolean);

    expect(files.length).toBeGreaterThan(0);

    const allowedFile =
      'infrastructure/adapters/stripe-payment-provider.adapter.ts';
    const forbidden = /from\s+['"]stripe['"]/;

    const violations: string[] = [];

    for (const file of files) {
      const relativePath = file.replace(contextDir + '/', '');
      if (relativePath === allowedFile) continue;

      const content = readFileSync(file, 'utf8');
      if (forbidden.test(content)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
