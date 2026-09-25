// Run from any directory: node examples/analyze.mjs [T0.csv T1.csv]
// No network requests; configuration and input are read from local files.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeWorkbooksLocally, loadLocalScientificProfile } from '../docs/local-analysis.js';
import { demoFiles } from '../docs/demo-data.js';

const args = process.argv.slice(2);
if (args.length !== 0 && args.length !== 2) {
  console.error('Usage: node examples/analyze.mjs [T0.csv T1.csv]');
  process.exit(2);
}
try {
  const demo = demoFiles();
  const selections = args.length ? await Promise.all(args.map(async (name, index) => ({
    term: `T${index}`,
    timeValue: index,
    file: new File([await readFile(name)], path.basename(name)),
  }))) : demo.selections;
  const profile = await loadLocalScientificProfile(async url => {
    const text = await readFile(new URL(`../docs/${url.replace(/^\.\//, '')}`, import.meta.url), 'utf8');
    return { ok: true, text: async () => text };
  });
  const result = await analyzeWorkbooksLocally({
    selections,
    assay: args.length ? {
      technology: 'qpcr', target_category: 'other', target_name: 'User target',
      analysis_goal: 'decrease', host_species: null,
    } : demo.assay,
    timeUnit: args.length ? 'day' : demo.time_unit,
    profile,
    tierEnabled: false,
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exitCode = 1;
}
