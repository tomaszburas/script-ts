import parseImports from 'parse-imports';
import {readFile, writeFile} from "node:fs/promises";

const FILE_PATH = './file.ts';

const dependencyNameWhileDefault = async (element: any): Promise<{dependencyName: string, file: string}> => {
    const KEY_WORD = 'export default';
    const file = await readFile(`${element.moduleSpecifier.value}.ts`, 'utf8');
    const startIndex = file.search(KEY_WORD) + KEY_WORD.length + 1;
    const endIndex = file.indexOf('\r', startIndex)
    let dependencyName = file.slice(startIndex, endIndex);

    if (dependencyName[dependencyName.length-1] === ';') {
        dependencyName = dependencyName.slice(0, dependencyName.length-1);
    }

    return {dependencyName, file}
}

const getDependencyDescription = async (name: string, file: string, filePath:string, nameSpace?: string): Promise<string> => {
    const str = `(const ${name})|(class ${name})|(function ${name})`;
    const regExp = new RegExp(str, "g");
    const dependencyDescriptionStartIndex = file.search(regExp);
    const dependencyDescriptionEndIndex = file.indexOf('}', dependencyDescriptionStartIndex);
    let dependency = file.slice(dependencyDescriptionStartIndex, dependencyDescriptionEndIndex + 1);

    if (nameSpace.length > 0) {
        dependency = dependency.replace(name, nameSpace)
    }

    const imports = [...(await parseImports(file))]
    await recurrence(file, imports, filePath)

    return dependency;
}

const recurrence = async (file: string, imports: any[], filePath?: string) => {
    if (imports.length <= 0) return;

    const promises = imports.map(async (element) => {
        let filePaths = filePath ? filePath : ''
        if (element.moduleSpecifier.type !== ('relative' || 'absolute')) return;
        if (element.importClause.default !== undefined) {
            filePaths = filePaths + element.moduleSpecifier.value.slice(0, element.moduleSpecifier.value.lastIndexOf('/') + 1);
            const dependency = await dependencyNameWhileDefault(element);
            return await getDependencyDescription(dependency.dependencyName, dependency.file, filePaths, element.importClause.default);
        }
        if (element.importClause.namespace !== undefined) {
            //...
        }

        const file = await readFile(`${filePaths}${element.moduleSpecifier.value}.ts`, 'utf8');
        return (await Promise.all(element.importClause.named.map(async (e:any) => {
            const binding = e.binding ? e.binding : '';
            filePaths = filePaths + element.moduleSpecifier.value.slice(0, element.moduleSpecifier.value.lastIndexOf('/') + 1);
            return await getDependencyDescription(e.specifier, file, filePaths, binding);
        })))
    })

    const dependencies = (await Promise.all(promises)).filter(e => e !== undefined);

    await writeFile(FILE_PATH, `\n${dependencies.join(' \n\n')}`, {
        encoding: 'utf8',
        flag: 'a',
    })
}

(async () => {
    try {
        const file = await readFile(FILE_PATH, 'utf8');
        const imports = [...(await parseImports(file))]

        await recurrence(file, imports)

    } catch (e) {
        console.log('ERROR:', e);
    }
})();
