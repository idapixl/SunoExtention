# Contributing

Thanks for your interest in contributing to Suno Waveform Seeker!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/IDAPIXL/suno-waveform-seeker.git
   cd suno-waveform-seeker
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build and load the extension:
   ```bash
   npm run build
   ```
5. Load the `dist/` folder as an unpacked extension in Chrome

## Development Workflow

1. Create a branch for your change:
   ```bash
   git checkout -b feature/my-change
   ```
2. Make your changes in `src/`
3. Run type checking:
   ```bash
   npm run typecheck
   ```
4. Run tests:
   ```bash
   npm test
   ```
5. Build and test in Chrome:
   ```bash
   npm run build
   ```
6. Reload the extension in `chrome://extensions/` and verify on suno.com

## Pull Requests

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Make sure `npm run typecheck` and `npm test` pass
- Test the extension manually on suno.com before submitting

## Bug Reports

When filing a bug report, please include:

- Chrome version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any) from DevTools

## Code Style

- TypeScript strict mode is enforced
- All DOM queries go through `src/content/dom-selectors.ts`
- Magic numbers belong in `src/shared/constants.ts`
- Keep modules small and focused

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
