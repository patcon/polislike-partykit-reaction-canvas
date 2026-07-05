import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(__dirname, '..');
const PAGES_DIR = join(ROOT, 'docs', 'pages');
const PUBLIC_DIR = join(ROOT, 'public');

describe('docs/pages/ structure', () => {
  it('has index.html', () => {
    expect(existsSync(join(PAGES_DIR, 'index.html'))).toBe(true);
  });

  it('index.html links to all four prototype pages', () => {
    const index = readFileSync(join(PAGES_DIR, 'index.html'), 'utf8');
    expect(index).toContain('valence-onboarding-v1.html');
    expect(index).toContain('valence-onboarding-v2.html');
    expect(index).toContain('valence-onboarding-v3.html');
    expect(index).toContain('mood-sounds.html');
  });

  it('has valence-onboarding-v1.html identical to public/ original', () => {
    const moved = readFileSync(join(PAGES_DIR, 'valence-onboarding-v1.html'), 'utf8');
    const original = readFileSync(join(PUBLIC_DIR, 'valence-onboarding-v1.html'), 'utf8');
    expect(moved).toBe(original);
  });
});

describe('WebSocket host not derived from window.location in moved pages', () => {
  const WS_LOC_PATTERN = /window\.location\.(host|hostname|port|protocol)/;

  // v1 has no WS — skip
  it('valence-onboarding-v2.html has no window.location WS construction', () => {
    const file = readFileSync(join(PAGES_DIR, 'valence-onboarding-v2.html'), 'utf8');
    const wsSection = file.slice(file.indexOf('function connectWs'), file.indexOf('function disconnectWs'));
    expect(WS_LOC_PATTERN.test(wsSection)).toBe(false);
  });

  it('valence-onboarding-v3.html has no window.location WS construction in connectWs', () => {
    const file = readFileSync(join(PAGES_DIR, 'valence-onboarding-v3.html'), 'utf8');
    const wsSection = file.slice(file.indexOf('function connectWs'), file.indexOf('function disconnectWs'));
    expect(WS_LOC_PATTERN.test(wsSection)).toBe(false);
  });

  it('mood-sounds.html has no window.location WS construction in wsUrl', () => {
    const file = readFileSync(join(PAGES_DIR, 'mood-sounds.html'), 'utf8');
    const wsSection = file.slice(file.indexOf('function wsUrl'), file.indexOf('function connectWs'));
    expect(WS_LOC_PATTERN.test(wsSection)).toBe(false);
  });

  it('v2/v3/mood-sounds have server-input element', () => {
    for (const name of ['valence-onboarding-v2.html', 'valence-onboarding-v3.html', 'mood-sounds.html']) {
      const file = readFileSync(join(PAGES_DIR, name), 'utf8');
      expect(file, `${name} missing server-input`).toContain('id="server-input"');
    }
  });
});

describe('React component links use GitHub Pages URLs', () => {
  const GH_BASE = 'https://patcon.github.io/polislike-partykit-reaction-canvas';
  const PAGES = ['mood-sounds.html', 'valence-onboarding-v1.html', 'valence-onboarding-v2.html', 'valence-onboarding-v3.html'];

  it('OldFrontPage.tsx has no relative /xxx.html links to prototype pages', () => {
    const file = readFileSync(join(ROOT, 'app/components/OldFrontPage.tsx'), 'utf8');
    for (const page of PAGES) {
      expect(file, `OldFrontPage still has relative link to ${page}`).not.toContain(`"/${page}"`);
    }
  });

  it('OldFrontPage.tsx links point to GitHub Pages', () => {
    const file = readFileSync(join(ROOT, 'app/components/OldFrontPage.tsx'), 'utf8');
    for (const page of ['mood-sounds.html', 'valence-onboarding-v1.html', 'valence-onboarding-v2.html', 'valence-onboarding-v3.html']) {
      expect(file, `OldFrontPage missing GH Pages link for ${page}`).toContain(`${GH_BASE}/${page}`);
    }
  });

  it('NewFrontPage.tsx has no relative /xxx.html links to prototype pages', () => {
    const file = readFileSync(join(ROOT, 'app/components/NewFrontPage.tsx'), 'utf8');
    // match both single and double quoted relative hrefs
    expect(file).not.toMatch(/href:\s*['"]\/valence-onboarding-v2\.html['"]/);
    expect(file).not.toMatch(/href:\s*['"]\/mood-sounds\.html['"]/);
  });

  it('NewFrontPage.tsx PROTOTYPES hrefs point to GitHub Pages', () => {
    const file = readFileSync(join(ROOT, 'app/components/NewFrontPage.tsx'), 'utf8');
    expect(file).toContain(`${GH_BASE}/valence-onboarding-v2.html`);
    expect(file).toContain(`${GH_BASE}/mood-sounds.html`);
  });
});

describe('prototype pages removed from public/', () => {
  const PROTO_PAGES = ['valence-onboarding-v1.html', 'valence-onboarding-v2.html', 'valence-onboarding-v3.html', 'mood-sounds.html'];

  it('prototype HTML files are gone from public/', () => {
    for (const page of PROTO_PAGES) {
      expect(existsSync(join(PUBLIC_DIR, page)), `${page} still in public/`).toBe(false);
    }
  });
});
