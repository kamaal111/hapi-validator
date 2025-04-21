import path from 'node:path';
import fs from 'node:fs/promises';

import fg from 'fast-glob';
import dotenv from 'dotenv';
import z from 'zod';
import ts from 'typescript';

dotenv.config();

const TARGET_FILE_EXTENSIONS = ['ts', 'js', 'jsx', 'tsx'];
const TARGET_ROOT_DIRECTORY = 'src';

const EnvSchema = z.object({OPENAI_API_KEY: z.string().nonempty()});

async function main() {
    const env = EnvSchema.parse(process.env);
    const filepaths = await getAllTargetFilepaths();
    const filepathsWithJoiImports = filepaths.filter(filepath => {
        const imports = findImportSources(filepath, ['@hapi/joi', 'joi']);

        return imports.length > 0;
    });

    console.log('🐸🐸🐸 filepathsWithJoiImports', filepathsWithJoiImports);
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

async function getFileContents(filepaths: Array<string>): Promise<Array<string>> {
    return (await Promise.all(filepaths.map(getFileContent))).filter(isNotUndefinedOrNull);
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
