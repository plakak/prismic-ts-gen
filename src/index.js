#! /usr/bin/env node

const get = require('axios').get;
const fse = require('fs-extra');
const {
  quicktype,
  InputData,
  jsonInputForTargetLanguage
} = require('quicktype-core');

const path = require('path');


const getPrismicJson = async (type, parser) => {
  const config = await fse.readJson(`${path.dirname(require.main.filename)}/.prismic-ts-gen.json`);
  const response = await get(`https://customtypes.prismic.io/${type}`, {
    headers: {
      repository: config.repository,
      Authorization: config.token
    }
  });
  return parser ? parser(response.data) : response.data;
};

const parseTypes = data =>
  data.reduce((acc, next) => {
    acc[next.id] = next.json.Main;
    acc[next.id].slices = { type: next.json.Main.slices.type };
    return acc;
  }, {});

const parseSlices = data =>
  data.reduce((acc, next) => {
    acc[next.id] = next.variations;
    return acc;
  }, {});

const convertToTS = async (json, typeName) => {
  const lang = 'typescript';
  const jsonInput = jsonInputForTargetLanguage(lang);
  await jsonInput.addSource({
    name: typeName,
    samples: [json]
  });
  const inputData = new InputData();
  inputData.addInput(jsonInput);
  return quicktype({
    inputData,
    lang,
    fixedTopLevels: true,
    rendererOptions: { 'just-types': true }
  });
};

const createTypeFiles = async (type, filename = null, parser) => {
  const result = await convertToTS(
    JSON.stringify(await getPrismicJson(type, parser)),
    filename ? filename : type
  );

  const path = `./types/${filename ?? type}.ts`;

  return await fse.outputFile(path, result.lines.join('\n'));
};

createTypeFiles('customtypes', 'types', parseTypes);
createTypeFiles('slices', null, parseSlices);
