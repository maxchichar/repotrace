export const ALGORITHM = '1.1.0';
export interface Actor {
  id: number;
  login: string;
  type?: string;
}
export interface RawFile {
  filename: string;
  previous_filename?: string;
  additions: number;
  deletions: number;
  status?: string;
  patch?: string;
}
export interface RawCommit {
  sha: string;
  html_url: string;
  author: Actor | null;
  commit: {
    message: string;
    author: { name?: string | null; email?: string | null; date?: string | null } | null;
    committer?: { date?: string | null } | null;
  };
  parents: { sha: string }[];
  files?: RawFile[];
}
export interface RawPR {
  number: number;
  title: string;
  html_url: string;
  user: Actor | null;
  merged_at: string | null;
  base?: { ref: string };
}
export interface Repo {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  branch: string;
  head: string;
}
export interface Scope {
  since: string;
  until: string;
  branch?: string;
}
export interface FileEvidence {
  path: string;
  previousPath?: string;
  additions: number;
  deletions: number;
  excluded: boolean;
  reason?: string;
  patchAvailable: boolean;
}
export interface Evidence {
  id: string;
  kind: 'commit' | 'pr';
  url: string;
  title: string;
  date: string;
  actorIds: string[];
  files: FileEvidence[];
}
export interface Person {
  id: string;
  name: string;
  login?: string;
  url?: string;
  bot: boolean;
  identity: 'github-account' | 'unresolved';
}
export interface Contributor extends Person {
  commits: number;
  churn: number;
  prs: number;
  evidenceIds: string[];
  files: { path: string; changes: number; commits: number }[];
  timeline: { date: string; commits: number; churn: number; prs: number }[];
}
export interface Insight {
  contributorId: string;
  summary: string;
  impact: 'low' | 'moderate' | 'high';
  confidence: 'low' | 'medium';
  rationale: string;
  limitations: string;
  evidenceIds: string[];
}
export interface Analysis {
  id: string;
  algorithm: string;
  createdAt: string;
  expiresAt: string;
  repo: Repo;
  scope: Scope;
  warnings: string[];
  traversalComplete: boolean;
  requests: number;
  contributors: Contributor[];
  evidence: Evidence[];
  exclusions: {
    mergeCommits: number;
    generatedFiles: number;
    excludedChurn: number;
    missingPatches: number;
  };
  insights?: { model: string; generatedAt: string; estimates: Insight[] };
}
export type Metric = 'commits' | 'churn' | 'prs';
