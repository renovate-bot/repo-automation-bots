// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  ReleaseType,
  VersioningStrategyType,
  ChangelogNotesType,
} from 'release-please';

export interface BranchOptions {
  releaseLabels?: string[];
  monorepoTags?: boolean;
  releaseType?: ReleaseType;
  packageName?: string;
  handleGHRelease?: boolean;
  bumpMinorPreMajor?: boolean;
  bumpPatchForMinorPreMajor?: boolean;
  path?: string;
  changelogHost?: string;
  changelogPath?: string;
  manifest?: boolean;
  manifestFile?: string;
  manifestConfig?: string;
  extraFiles?: string[];
  releaseLabel?: string;
  draft?: boolean;
  draftPullRequest?: boolean;
  pullRequestTitlePattern?: string;
  versionFile?: string;
  versioning?: VersioningStrategyType;
  changelogType?: ChangelogNotesType;
  initialVersion?: string;
  onDemand?: boolean;
  tagPullRequestNumber?: boolean;
}

export interface BranchConfiguration extends BranchOptions {
  branch: string;
}

export interface ConfigurationOptions extends BranchOptions {
  primaryBranch: string;
  branches?: BranchConfiguration[];
  disableFailureChecker?: boolean;
}

export const WELL_KNOWN_CONFIGURATION_FILE = 'release-please.yml';
export const DEFAULT_CONFIGURATION: Partial<ConfigurationOptions> = {
  branches: [],
  manifest: false,
  onDemand: false,
};
