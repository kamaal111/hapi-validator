import path from 'node:path';
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';

import fg from 'fast-glob';
import dotenv from 'dotenv';
import z from 'zod';
import ts from 'typescript';
import OpenAI from 'openai';

dotenv.config();

const PACKAGE_JSON_FILEPATH = 'package.json';
const TARGET_FILE_EXTENSIONS = ['ts', 'js', 'jsx', 'tsx'];
const TARGET_ROOT_DIRECTORY = 'src';
const JOI_TO_ZOD_PROMPT_FILEPATH = 'prompts/joi-to-zod.md';
const OPENAI_MODEL = 'gpt-4.1';
const JOI_IMPORT_TERMS = ['@hapi/joi', 'joi'];

const EnvSchema = z.object({OPENAI_API_KEY: z.string().nonempty()});

async function main() {
    const start = performance.now();
    const env = await EnvSchema.parseAsync(process.env);
    const filepathsAndImportSourcesWithJoiImports = await findImportSourcesWithJoi();
    if (filepathsAndImportSourcesWithJoiImports.length === 0) {
        console.log('Nothing to transform here 🐸');
        return;
    }

    const client = new OpenAI({apiKey: env.OPENAI_API_KEY});
    const joiToZodPrompt = await getFileContent(JOI_TO_ZOD_PROMPT_FILEPATH);
    if (isUndefinedOrNull(joiToZodPrompt)) {
        throw new Error(`Could not import ${JOI_TO_ZOD_PROMPT_FILEPATH} for some reason`);
    }

    console.log(`Will transform ${filepathsAndImportSourcesWithJoiImports.length} files, chill and grab some maté 🧉`);
    const results = (
        await Promise.allSettled(
            filepathsAndImportSourcesWithJoiImports.map(({path: filepath}) => {
                return transformContentToUseZod(joiToZodPrompt, filepath, client);
            })
        )
    ).map((result, index) => ({result, path: filepathsAndImportSourcesWithJoiImports[index].path}));
    const errors = results.filter(({result}) => result.status === 'rejected') as Array<{
        result: PromiseRejectedResult;
        path: string;
    }>;
    if (errors.length > 0) {
        for (const error of errors) {
            console.error(`Failed to transform '${error.path}', due to error='${error.result.reason}'`);
        }
        throw new Error('Failed to transform some files');
    }

    const packageJSONContent = await getFileContent(PACKAGE_JSON_FILEPATH);
    if (isNotUndefinedOrNull(packageJSONContent)) {
        const packageJSON = JSON.parse(packageJSONContent);
        if (isUndefinedOrNull(packageJSON.dependencies?.zod)) {
            packageJSON.dependencies = {...packageJSON.dependencies, zod: '^3'};
            console.log('Add Zod to dependencies, make sure to install packages ✍️');
        }
        if (isNotUndefinedOrNull(packageJSON.devDependencies?.zod)) {
            delete packageJSON.devDependencies.zod;
        }
    }

    const timeInSeconds = ((performance.now() - start) / 1000).toFixed(2);
    console.log(
        `Transformed ${filepathsAndImportSourcesWithJoiImports.length} files successfully in ${timeInSeconds} seconds ✨`
    );
}

async function transformContentToUseZod(prompt: string, filepath: string, client: OpenAI): Promise<void> {
    const content = await getFileContent(filepath);
    if (isUndefinedOrNull(content)) {
        throw new Error(`Could not get content of '${filepath}' even after parsing`);
    }

    const promptWithContent = prompt.replace('/_ Contents of the source file to refactor _/', content);
    const completion = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{role: 'user', content: promptWithContent}],
    });
    const newContent = completion.choices[0]?.message.content;
    if (isUndefinedOrNull(newContent)) {
        throw new Error(`No content received from AI; full_response='${completion}'`);
    }

    await fs.writeFile(filepath, newContent);
    console.log(`Updated file '${filepath}' with Zod schemas 🚀`);
}

async function findImportSourcesWithJoi(): Promise<Array<{importSources: Array<ts.StringLiteral>; path: string}>> {
    const filepaths = await getAllTargetFilepaths();

    return filepaths
        .map(filepath => ({importSources: findImportSources(filepath, JOI_IMPORT_TERMS), path: filepath}))
        .filter(({importSources}) => importSources.length > 0);
}

function findImportSources(filepath: string, searchImport: string | Array<string>): Array<ts.StringLiteral> {
    return getAllImportSources(filepath).filter(importSource => searchImport.includes(importSource.text));
}

function getAllImportSources(filepath: string): Array<ts.StringLiteral> {
    // https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
    const program = ts.createProgram([filepath], {allowJs: true});
    const sourceFile = program.getSourceFile(filepath);
    if (isUndefinedOrNull(sourceFile)) {
        throw new Error(`Failed to get source file for '${filepath}'`);
    }

    const importSources: Array<ts.StringLiteral> = [];
    ts.forEachChild(sourceFile, node => {
        if (!ts.isImportDeclaration(node)) return;

        const {moduleSpecifier} = node;
        if (!ts.isStringLiteral(moduleSpecifier)) return;

        importSources.push(moduleSpecifier);
    });

    return importSources;
}

function getAllTargetFilepaths(): Promise<Array<string>> {
    const globSearchPath = path.join(TARGET_ROOT_DIRECTORY, `**/*.(${TARGET_FILE_EXTENSIONS.join('|')})`);

    return fg([globSearchPath]);
}

function isUndefinedOrNull<T>(maybeValue: T | undefined | null): maybeValue is undefined | null {
    return !isNotUndefinedOrNull(maybeValue);
}

function isNotUndefinedOrNull<T>(maybeValue: T | undefined | null): maybeValue is T {
    return maybeValue != null;
}

async function getFileContent(filepath: string): Promise<string | null> {
    let content: Buffer<ArrayBufferLike>;
    try {
        content = await fs.readFile(filepath);
    } catch (error) {
        return null;
    }

    return content.toString();
}

main();
