#!/usr/bin/env node
// Usage: npm run headless -- --seed 72 --steps 10000 --runs 4 --interval 50 --out results/headless
// No canvas, rendering, browser, timers or game-speed throttle. Exact Ecosystem.step().
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {runHeadless,headlessCSV} from './headless-runner.mjs';

export function parseArgs(args){
 const opts={seed:72,steps:10000,runs:1,interval:50,founders:1,
  out:'results/headless',stopAtExtinction:true};
 for(let i=0;i<args.length;i++){
  const key=args[i];
  if(key==='--help'||key==='-h')return {help:true};
  if(key==='--continue-after-extinction'){opts.stopAtExtinction=false;continue;}
  const known={'--seed':'seed','--steps':'steps','--runs':'runs',
   '--interval':'interval','--founders':'founders','--out':'out'};
  if(!known[key]||i+1>=args.length)throw new Error('Unknown/missing argument: '+key);
  const field=known[key],value=args[++i];
  opts[field]=field==='out'?value:Number(value);
 }
 for(const key of ['seed','steps','runs','interval','founders']){
  if(!Number.isSafeInteger(opts[key])||opts[key]<1)throw new RangeError(key+' must be a positive integer');
 }
 if(opts.seed+opts.runs-1>2147483647)throw new RangeError('seed range overflow');
 if(opts.steps>10000000)throw new RangeError('steps must be <= 10 million per run');
 if(opts.runs>1000)throw new RangeError('runs must be <= 1000');
 if(opts.interval>opts.steps)throw new RangeError('interval must be <= steps');
 if(opts.founders>6)throw new RangeError('founders must be <= 6');
 return opts;
}
export const USAGE=[
 'Edenomaly headless simulation (no rendering)',
 'npm run headless -- --seed 72 --steps 10000 --runs 4 --interval 50 --founders 1 --out results/headless',
 'Options: --seed N --steps N --runs N --interval N --founders 1..6 --out PATH',
 '         --continue-after-extinction  (normally stops a run if all organisms and eggs die)',
 'Outputs: ecology-seed-N.csv per run, summary.json (parameter, metrics, execution time)',
 'Reproduction: same commit + seed + options => same ecological trajectories.'
].join('\n');
export async function main(args=process.argv.slice(2)){
 const opts=parseArgs(args);
 if(opts.help){console.log(USAGE);return [];}
 const out=resolve(opts.out);
 await mkdir(out,{recursive:true});
 const runs=[];
 for(let i=0;i<opts.runs;i++){
  const seed=opts.seed+i;
  const {summary,rows}=runHeadless({...opts,seed});
  await writeFile(join(out,'ecology-seed-'+seed+'.csv'),headlessCSV(rows),'utf8');
  runs.push(summary);
  console.log(JSON.stringify(summary));
 }
 const final={mode:'headless',parameters:opts,runCount:runs.length,
  summary:runs,generatedAt:new Date().toISOString()};
 await writeFile(join(out,'summary.json'),JSON.stringify(final,null,2)+'\n','utf8');
 console.log('Saved '+runs.length+' CSV file(s) and summary.json in '+out);
 return runs;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))
 main().catch(error=>{console.error(error.message);process.exitCode=1;});
