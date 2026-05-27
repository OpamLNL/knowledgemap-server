/** Vercel → api/index.ts. NestJS збирається через buildCommand: npm run build → dist/ */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nestHandler = require('../dist/vercel.js');

export default nestHandler;
