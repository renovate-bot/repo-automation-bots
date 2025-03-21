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

import myProbotApp from '../src/canary-bot';
import * as gcfUtilsModule from 'gcf-utils';
// issue-utils directly exports addOrUpdateIssueComment from this internal source file
// and somehow sinon can't stub the method directly from issue-utils
import * as issueModule from '@google-automations/issue-utils/build/src/issue-comments';
import {resolve} from 'path';
/* eslint-disable-next-line node/no-extraneous-import */
import {Probot, createProbot, ProbotOctokit} from 'probot';
/* eslint-disable-next-line node/no-extraneous-import */
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import {describe, it, afterEach, beforeEach} from 'mocha';
import assert from 'assert';
import * as sinon from 'sinon';
import * as datastoreLockModule from '@google-automations/datastore-lock';
const fetch = require('node-fetch');

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function listIssues(owner: string, repo: string, issues: object[]) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/issues?per_page=100&state=all`)
    .reply(200, issues);
}

describe('canary-bot', () => {
  let probot: Probot;
  const sandbox = sinon.createSandbox();
  let addOrUpdateIssueCommentStub: sinon.SinonStub;
  let getAuthenticatedOctokitStub: sinon.SinonStub;

  beforeEach(async () => {
    probot = createProbot({
      defaults: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
        request: {fetch},
      },
    });
    await probot.load(myProbotApp);
    addOrUpdateIssueCommentStub = sandbox.stub(
      issueModule,
      'addOrUpdateIssueComment'
    );
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit({request: {fetch}}));
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe('canary-bot scheduler handler', () => {
    it('quits early', async () => {
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: 'testRepo',
            owner: {
              login: 'testOwner',
            },
          },
          organization: {
            login: 'googleapis',
          },
        },
        id: 'abc123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });
    it('creates an issue', async () => {
      const scopes = [
        listIssues('googleapis', 'repo-automation-bots', [{}]),
        nock('https://api.github.com')
          .get('/app/installations')
          .reply(200, [])
          .post('/repos/googleapis/repo-automation-bots/issues', body => {
            assert.strictEqual(body.title, 'A canary is chirping');
            return true;
          })
          .reply(200),
      ];
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: 'repo-automation-bots',
            owner: {
              login: 'testOwner',
            },
          },
          organization: {
            login: 'googleapis',
          },
          installation: {
            id: 234,
          },
        },
        id: 'abc123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      for (const scope of scopes) {
        scope.done();
      }
      sinon.assert.notCalled(addOrUpdateIssueCommentStub);
    });

    it('comments on a correct issue', async () => {
      const scopes = [
        listIssues('googleapis', 'repo-automation-bots', [
          {title: 'A canary is not chirping', number: 6},
          {title: 'A canary is chirping', number: 5},
        ]),
        nock('https://api.github.com').get('/app/installations').reply(200, []),
      ];
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: 'repo-automation-bots',
            owner: {
              login: 'testOwner',
            },
          },
          organization: {
            login: 'googleapis',
          },
          installation: {
            id: 234,
          },
        },
        id: 'abc123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      for (const scope of scopes) {
        scope.done();
      }
      sinon.assert.calledOnceWithMatch(
        addOrUpdateIssueCommentStub,
        sinon.match.object,
        'googleapis',
        'repo-automation-bots',
        5,
        234,
        sinon.match.string
      );
    });
  });

  describe('responds to events', () => {
    it('responds to issues', async () => {
      sandbox.replace(
        datastoreLockModule,
        'withDatastoreLock',
        async (details: any, f: () => Promise<any>) => {
          return f();
        }
      );
      const scope = nock('https://api.github.com')
        .get('/app/installations')
        .reply(200, []);
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      await probot.receive({name: 'issues', payload, id: 'abc123'});
      sinon.assert.calledOnceWithExactly(
        addOrUpdateIssueCommentStub,
        sinon.match.instanceOf(Octokit),
        'testOwner',
        'testRepo',
        5,
        1219791,
        sinon.match.string
      );
      scope.done();
    });

    it('does not add a comment if the title is wrong', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_wrong_title'
      ));
      await probot.receive({name: 'issues', payload, id: 'abc123'});
      sinon.assert.notCalled(addOrUpdateIssueCommentStub);
    });
    it('throws an error for canary-bot error', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_testing_error'
      ));
      await assert.rejects(async () => {
        await probot.receive({name: 'issues', payload, id: 'abc123'});
      });
      sinon.assert.notCalled(addOrUpdateIssueCommentStub);
    });
  });
  describe('responds to pubsub events', () => {
    it('responds to pubsub events', async () => {
      const infoStub = sandbox.stub(gcfUtilsModule.logger, 'info');
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'pubsub.message' as any,
        payload: {message: 'test message'},
        id: 'abc123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      sinon.assert.calledOnce(infoStub);
      const logMessage = infoStub.getCall(0).args[0] as unknown as string;
      assert(logMessage.includes('test message'));
    });
  });
});
