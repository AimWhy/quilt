import {join, resolve} from 'path';

import {readFileSync} from 'fs-extra';
import glob from 'glob';

const ROOT_PATH = resolve(__dirname, '..');

const HEADER_START_REGEX = /^## /;
const CHANGELOG_INTRO = `# Changelog\n`;

readChangelogs().forEach(({packageChangelogPath, packageChangelog}) => {
  describe(`changelog consistency for ${packageChangelogPath}`, () => {
    it('contains only known headers', () => {
      const headerLines = packageChangelog
        .split('\n')
        .filter((line) => /^\s*#/.exec(line));
      const offendingHeaders = headerLines.filter(
        (headerLine) => !headerIsAllowed(headerLine),
      );

      expect(offendingHeaders).toStrictEqual([]);
    });

    it('has exactly 1 empty line before headings', () => {
      const notEnoughSpacingBeforeHeadings = /[^\n]+\n^#.*$/gm;

      expect(packageChangelog).not.toStrictEqual(
        expect.stringMatching(notEnoughSpacingBeforeHeadings),
      );
    });

    it('has exactly 1 empty line after headings', () => {
      const notEnoughSpacingAfterHeadings = /^#.*$\n[^\n]+/gm;

      expect(packageChangelog).not.toStrictEqual(
        expect.stringMatching(notEnoughSpacingAfterHeadings),
      );
    });

    it('does not contain an Unreleased header', () => {
      expect(packageChangelog).not.toContain('## Unreleased');
    });

    it('does not contain duplicate headers', () => {
      /* eslint-disable jest/no-conditional-in-test */
      const headerLines = packageChangelog
        .split('\n')
        .filter(
          (line) => HEADER_START_REGEX.exec(line) || /## Unreleased/.exec(line),
        )
        .sort();
      /* eslint-enable jest/no-conditional-in-test */
      const uniqueHeaderLines = headerLines.filter(
        (element, index, array) => array.indexOf(element) === index,
      );

      expect(headerLines).toStrictEqual(uniqueHeaderLines);
    });
  });
});

const allowedHeaders = [
  '# Changelog',
  /^## \d+\.\d+\.\d+ - \d\d\d\d-\d\d-\d\d$/,
  // We should backfill dates using commit timestamps
  /^## \d+\.\d+\.\d+$/,
  // Provided by changesets
  '### Major Changes',
  '### Minor Changes',
  '### Patch Changes',
  // Headings from before we adopted changesets
  '### Fixed',
  '### Added',
  '### Changed',
  '### Deprecated',
  '### Removed',
  '### Security',
  // This is technically not part of Keep a Changelog spec
  '### Chore',
  // This isn't part of it either
  '### Breaking Change',
  /^####/,
];

function headerIsAllowed(headerLine) {
  return allowedHeaders.some((allowedHeader) => {
    if (allowedHeader instanceof RegExp) {
      return allowedHeader.test(headerLine);
    } else {
      return allowedHeader === headerLine;
    }
  });
}

function readChangelogs() {
  const packagesPath = join(ROOT_PATH, 'packages');

  return glob
    .sync(join(packagesPath, '*/'))
    .filter(hasPackageJSON)
    .map((packageDir) => {
      const packageChangelogPath = join(packageDir, 'CHANGELOG.md');
      const packageChangelog = safeReadSync(packageChangelogPath, {
        encoding: 'utf8',
      }).toString('utf-8');

      return {
        packageDir,
        packageChangelogPath,
        packageChangelog,
      };
    });
}

function safeReadSync(path, options) {
  try {
    return readFileSync(path, options);
  } catch {
    return '';
  }
}

function hasPackageJSON(packageDir) {
  const packageJSONPath = join(packageDir, 'package.json');
  const packageJSON = safeReadSync(packageJSONPath, {
    encoding: 'utf8',
  });

  return packageJSON.length > 0;
}
