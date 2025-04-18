// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  validateYaml,
  validateSchema,
  checkAutoApproveConfig,
} from '../src/check-config.js';
import {describe, it} from 'mocha';
import assert from 'assert';
import * as fs from 'fs';
import nock from 'nock';
import snapshot from 'snap-shot-it';
const {Octokit} = require('@octokit/rest');
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
  request: {fetch},
});

nock.disableNetConnect();

function getAutoApproveFile(response: string | undefined, status: number) {
  return nock('https://api.github.com')
    .get('/repos/owner/repo/contents/.github%2Fauto-approve.yml')
    .reply(
      status,
      response ? {content: Buffer.from(response).toString('base64')} : undefined
    );
}

async function checkForValidSchema(
  configNum: number,
  V2: string,
  invalid: string
) {
  return await validateSchema(
    fs.readFileSync(
      `./test/fixtures/config/${invalid}valid-schemas${V2}/${invalid}valid-schema${configNum}.yml`,
      'utf8'
    )
  );
}

describe('check for config', () => {
  describe('whether config is a valid YAML object', () => {
    it('should return error message if YAML is invalid', () => {
      const isYamlValid = validateYaml(
        fs.readFileSync(
          './test/fixtures/config/invalid-schemas/invalid-yaml-config.yml',
          'utf8'
        )
      );
      snapshot(isYamlValid);
    });

    it('should return true if YAML is valid', async () => {
      const isYamlValid = validateYaml(
        fs.readFileSync(
          './test/fixtures/config/valid-schemas/valid-schema1.yml',
          'utf8'
        )
      );
      assert.strictEqual(isYamlValid, '');
    });
  });

  describe('whether YAML file has valid schema', async () => {
    it('should fail if YAML has any other properties than the ones specified', async () => {
      //does not have any additional properties
      const isSchemaValid = await checkForValidSchema(1, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if title does not match first author', async () => {
      //title does not correspond to author
      const isSchemaValid = await checkForValidSchema(2, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if title does not match second author', async () => {
      //title does not correspond to author
      const isSchemaValid = await checkForValidSchema(3, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if title does not match third author', async () => {
      //title does not correspond to author
      const isSchemaValid = await checkForValidSchema(4, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if author is not allowed', async () => {
      //author is not allowed
      const isSchemaValid = await checkForValidSchema(5, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if it does not have title property', async () => {
      //missing 'title' property
      const isSchemaValid = await checkForValidSchema(6, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if config is empty', async () => {
      //empty array
      const isSchemaValid = await checkForValidSchema(7, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if there are duplicate items', async () => {
      //duplicate items
      const isSchemaValid = await checkForValidSchema(8, '', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should return empty string if YAML has all of the possible valid options', async () => {
      const isSchemaValid = await checkForValidSchema(1, '', '');
      assert.strictEqual(isSchemaValid, '');
    });

    it('should return empty string if YAML has any one of the possible valid options', async () => {
      const isSchemaValid = await checkForValidSchema(2, '', '');
      assert.strictEqual(isSchemaValid, '');
    });

    it('should return empty string if YAML has some of the possible valid options', async () => {
      const isSchemaValid = await checkForValidSchema(3, '', '');
      assert.strictEqual(isSchemaValid, '');
    });
  });

  describe('whether YAML file has valid schema V2', async () => {
    it('should fail if YAML has any other properties than the ones specified', async () => {
      const isSchemaValid = await checkForValidSchema(1, 'V2', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if the property is wrong', async () => {
      const isSchemaValid = await checkForValidSchema(2, 'V2', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if both v1 and v2 schemas are included', async () => {
      const isSchemaValid = await checkForValidSchema(3, 'V2', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if there are duplicate items', async () => {
      //duplicate items
      const isSchemaValid = await checkForValidSchema(4, 'V2', 'in');
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should return empty string if YAML has all of the possible valid options', async () => {
      const isSchemaValid = await checkForValidSchema(1, 'V2', '');
      assert.strictEqual(isSchemaValid, '');
    });

    it('should return empty string if YAML has any one of the possible valid options', async () => {
      const isSchemaValid = await checkForValidSchema(2, 'V2', '');
      assert.strictEqual(isSchemaValid, '');
    });

    it('should return empty string if YAML has some of the possible valid options', async () => {
      const isSchemaValid = await checkForValidSchema(3, 'V2', '');
      assert.strictEqual(isSchemaValid, '');
    });
  });

  describe('auto-approve file behavior', async () => {
    it('should check if auto-approve is on main if it is undefined on PR', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/valid-schemas/valid-schema1.yml',
        'utf8'
      );
      const scopes = getAutoApproveFile(autoapproveFileResponse, 200);
      const response = await checkAutoApproveConfig(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(response, '');
    });

    it('should throw if autoapprove does not exist on PR or repo', async () => {
      assert.rejects(async () => {
        await checkAutoApproveConfig(octokit, 'owner', 'repo', undefined);
      }, /Auto-Approve config does not exist on repo/);
    });

    it('should return empty string if autoapprove is on PR, but has no issues', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/valid-schemas/valid-schema1.yml',
        'utf8'
      );

      const response = await checkAutoApproveConfig(
        octokit,
        'owner',
        'repo',
        autoapproveFileResponse
      );

      assert.strictEqual(response, '');
    });

    it('should return error messages if autoapprove is on PR and has issues', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-schemas/invalid-schema1.yml',
        'utf8'
      );

      const response = await checkAutoApproveConfig(
        octokit,
        'owner',
        'repo',
        autoapproveFileResponse
      );

      assert.notStrictEqual(response.length, 0);
    });

    it('should return error messages if autoapprove is on repo and has issues', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-schemas/invalid-schema1.yml',
        'utf8'
      );

      const scopes = getAutoApproveFile(autoapproveFileResponse, 200);
      const response = await checkAutoApproveConfig(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.notStrictEqual(response.length, 0);
    });
  });
});
