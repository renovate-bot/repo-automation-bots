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

import {OwlBotNode} from '../src/process-checks/node/owlbot';
import {describe, it} from 'mocha';
import assert from 'assert';
import nock from 'nock';

const {Octokit} = require('@octokit/rest');
nock.disableNetConnect();
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
  request: {fetch},
});

function getPRsOnRepo(
  owner: string,
  repo: string,
  response: {number: number; user: {login: string}}[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls?state=open&direction=asc`)
    .reply(200, response);
}

function listCommitsOnAPR(
  owner: string,
  repo: string,
  response: {author: {login: string}}[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, response);
}

describe('behavior of OwlBotNode process', () => {
  it('should return false in checkPR if incoming PR does not match classRules', async () => {
    const incomingPR = {
      author: 'testAuthor',
      title: 'testTitle',
      fileCount: 3,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'PiperOrigin-RevId: 413686247',
    };

    const owlBotTemplateChanges = new OwlBotNode(octokit);

    const scopes = [
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {number: 1, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'testAuthor'}},
      ]),
    ];

    assert.deepStrictEqual(
      await owlBotTemplateChanges.checkPR(incomingPR),
      false
    );
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR includes breaking', async () => {
    const incomingPR = {
      author: 'gcf-owl-bot[bot]',
      title: 'breaking: a new PR',
      fileCount: 3,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'PiperOrigin-RevId: 413686247',
    };
    const owlBotChanges = new OwlBotNode(octokit);

    const scopes = [
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {number: 1, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'testAuthor'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotChanges.checkPR(incomingPR), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR does NOT include PiperOrigin-RevId', async () => {
    const incomingPR = {
      author: 'gcf-owl-bot[bot]',
      title: 'chore: a new PR',
      fileCount: 3,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body:
        '... signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig fix: remove invalid resource annotations in LineageSubgraph' +
        'Regenerate this pull request now.' +
        'Source-Link: googleapis/googleapis@244a89d' +
        'Source-Link: googleapis/googleapis-gen@c485e44' +
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYzQ4NWU0NGExYjJmZWY1MTZlOWJjYTM2NTE0ZDUwY2ViZDVlYTUxZiJ9',
    };
    const owlBotChanges = new OwlBotNode(octokit);

    const scopes = [
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {number: 1, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'testAuthor'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotChanges.checkPR(incomingPR), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR is not the first in ascending order', async () => {
    const incomingPR = {
      author: 'gcf-owl-bot[bot]',
      title: 'chore: a new PR',
      fileCount: 3,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'PiperOrigin-RevId: 413686247',
    };
    const owlBotChanges = new OwlBotNode(octokit);

    const scopes = [
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {number: 2, user: {login: 'gcf-owl-bot[bot]'}},
        {number: 1, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'testAuthor'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotChanges.checkPR(incomingPR), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR has commits from other authors', async () => {
    const incomingPR = {
      author: 'gcf-owl-bot[bot]',
      title: 'chore: a new PR',
      fileCount: 3,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'PiperOrigin-RevId: 413686247',
    };
    const owlBotChanges = new OwlBotNode(octokit);

    const scopes = [
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {number: 1, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'testAuthor'}},
        {author: {login: 'gcf-owl-bot[bot]'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotChanges.checkPR(incomingPR), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return true in checkPR if incoming PR does match classRules, is the first in the PRs, and has no other commits', async () => {
    const incomingPR = {
      author: 'gcf-owl-bot[bot]',
      title: 'chore: a fine title',
      fileCount: 2,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'PiperOrigin-RevId: 413686247',
    };
    const owlBotChanges = new OwlBotNode(octokit);

    const scopes = [
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {number: 1, user: {login: 'gcf-owl-bot[bot]'}},
        {number: 2, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'gcf-owl-bot[bot]'}},
        {author: {login: 'gcf-owl-bot[bot]'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotChanges.checkPR(incomingPR), true);
    scopes.forEach(scope => scope.done());
  });
});
