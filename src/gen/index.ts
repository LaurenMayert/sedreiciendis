#!/usr/bin/env node

import { Command } from 'commander';

import fs from 'fs';

import fetch from 'node-fetch';
import { INTROSPECTION_QUERY } from './constants';
import { Schema } from './types';
import methods from './methods';

interface PullOptions {
    url?: string
}

interface GenOptions extends PullOptions {
    method: string
    outdir: string
    schema: Schema
}

export async function pull(options: PullOptions): Promise<Schema> {
    const res = await fetch(options.url!, {
        method: 'POST',
        body: JSON.stringify({query: INTROSPECTION_QUERY })
    });

    const rawSchema = (await res.json()).data.__schema as Schema;

    return rawSchema;
}

export function gen({ schema, method }: GenOptions): string {

    if (!(methods as any)[method]) {
        throw new Error(`method "${method}" not supported. please try one of: ${Object.keys(methods).join(', ')}`);
    }

    return (methods as any)[method](schema);
}

if (require.main === module) {
    const program = new Command();

    program
        .command('pull <url>')
        .description('retrieves the graphql schema associated with the given subgraph url')
        .action(async (options) => {
            try {
                console.log(JSON.stringify(await pull({ url: options } as PullOptions)));
            } catch(err) {
                console.error('failed to pull:', err);
            }
        });
    
    
    program.command('gen')
        .description('generate the typescript code to fetch from a subgraph')
        .option('-u, --url <location>', 'subgraph to extract schema from')
        .option('-s, --schema <path to .json>', 'location of a schema previously downloded with pull')
        .option('-m, --method <name>', `which top level generator to use. options: ${Object.keys(methods).join(', ')}`, 'plain')
        .option('-o, --out <file>', 'file to export the generated typescript files')
        .action(async (options) => {
            try {
                if (options.file && options.url) {
                    throw new Error('only one of file or url should be specified');
                }
            
                let schema: Schema;
                if (options.url) {
                    schema = await pull(options);
                }
                else if (options.file) {
                    schema = JSON.parse(fs.readFileSync(options.file).toString());
                }
                else {
                    throw new Error('supply either a file or url');
                }
        
                const res = gen({
                    schema,
                    ...options
                });
    
                if (options.out) {
                    fs.writeFileSync(options.out, res);
                    console.log('wrote file:', options.out)
                }
                else {
                    console.log(res);
                }
            } catch(err) {
                console.error('failed to gen:', err);
            }
        });
    
    program.parse(process.argv);
}