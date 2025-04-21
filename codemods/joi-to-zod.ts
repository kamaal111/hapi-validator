import path from 'node:path';
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';

import fg from 'fast-glob';
import dotenv from 'dotenv';
import z from 'zod';
import ts from 'typescript';
import OpenAI from 'openai';

dotenv.config();

const TARGET_FILE_EXTENSIONS = ['ts', 'js', 'jsx', 'tsx'];
const TARGET_ROOT_DIRECTORY = 'src';
const JOI_TO_ZOD_PROMPT_FILEPATH = 'prompts/joi-to-zod.md';
const OPENAI_MODEL = 'gpt-4.1';

const EnvSchema = z.object({OPENAI_API_KEY: z.string().nonempty()});

async function main() {
    const start = performance.now();
    const env = await EnvSchema.parseAsync(process.env);
    const filepathsWithJoiImports = await findImportsWithJoi();
    if (filepathsWithJoiImports.length === 0) {
        console.log('Nothing to transform here 🐸');
        return;
    }

    const client = new OpenAI({apiKey: env.OPENAI_API_KEY});
    const joiToZodPrompt = await getFileContent(JOI_TO_ZOD_PROMPT_FILEPATH);
    if (isUndefinedOrNull(joiToZodPrompt)) {
        throw new Error(`Could not import ${JOI_TO_ZOD_PROMPT_FILEPATH} for some reason`);
    }

    console.log(`Will transform ${filepathsWithJoiImports.length} files, chill and grab some maté 🧉`);
    await Promise.all(
        filepathsWithJoiImports.map(filepath => transformContentToUseZod(joiToZodPrompt, filepath, client))
    );

    const timeInSeconds = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`Transformed ${filepathsWithJoiImports.length} files successfully in ${timeInSeconds} seconds ✨`);
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

async function findImportsWithJoi() {
    const filepaths = await getAllTargetFilepaths();

    return filepaths.filter(filepath => {
        const imports = findImportSources(filepath, ['@hapi/joi', 'joi']);

        return imports.length > 0;
    });
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

        const importSource = node.moduleSpecifier;
        if (!ts.isStringLiteral(importSource)) return;

        importSources.push(importSource);
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
