/**
 * Git and file statistics for demo projects, keyed by project id.
 *
 * percentage is stored as an integer scaled by 10 (525 = 52.5%), matching
 * projectLanguageStats.percentage in the schema.
 */

export interface DemoLanguageStat {
  technologySlug: string;
  fileCount: number;
  /** Scaled by 10: 525 = 52.5%. Should total 1000 per project. */
  percentage: number;
  linesOfCode: number;
}

export interface DemoStats {
  projectId: string;
  fileCount: number;
  directoryCount: number;
  linesOfCode: number;
  thirdPartySize: number;
  gitBranch: string;
  gitRemoteUrl: string;
  lastCommitDaysAgo: number;
  lastCommitMessage: string;
  hasUncommittedChanges: boolean;
  languages: DemoLanguageStat[];
}

export const DEMO_STATS: DemoStats[] = [
  {
    projectId: 'demo-proj-01',
    fileCount: 486,
    directoryCount: 72,
    linesOfCode: 38_412,
    thirdPartySize: 156_237_824,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/harbor-api.git',
    lastCommitDaysAgo: 0,
    lastCommitMessage: 'Add cursor pagination to the projects resolver',
    hasUncommittedChanges: false,
    languages: [
      { technologySlug: 'typescript', fileCount: 402, percentage: 827, linesOfCode: 31_768 },
      { technologySlug: 'javascript', fileCount: 41, percentage: 84, linesOfCode: 3_224 },
      { technologySlug: 'css', fileCount: 26, percentage: 54, linesOfCode: 2_086 },
      { technologySlug: 'html', fileCount: 17, percentage: 35, linesOfCode: 1_334 },
    ],
  },
  {
    projectId: 'demo-proj-02',
    fileCount: 314,
    directoryCount: 58,
    linesOfCode: 24_907,
    thirdPartySize: 82_837_504,
    gitBranch: 'feat/tokens-v2',
    gitRemoteUrl: 'git@github.com:harborlabs/tidepool.git',
    lastCommitDaysAgo: 1,
    lastCommitMessage: 'Extract spacing scale into design tokens',
    hasUncommittedChanges: true,
    languages: [
      { technologySlug: 'vue', fileCount: 168, percentage: 535, linesOfCode: 13_325 },
      { technologySlug: 'typescript', fileCount: 104, percentage: 331, linesOfCode: 8_244 },
      { technologySlug: 'scss', fileCount: 42, percentage: 134, linesOfCode: 3_338 },
    ],
  },
  {
    projectId: 'demo-proj-03',
    fileCount: 271,
    directoryCount: 44,
    linesOfCode: 19_640,
    thirdPartySize: 128_974_848,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/lighthouse-web.git',
    lastCommitDaysAgo: 2,
    lastCommitMessage: 'Rewrite pricing page copy',
    hasUncommittedChanges: false,
    languages: [
      { technologySlug: 'typescript', fileCount: 186, percentage: 686, linesOfCode: 13_473 },
      { technologySlug: 'css', fileCount: 55, percentage: 203, linesOfCode: 3_987 },
      { technologySlug: 'html', fileCount: 30, percentage: 111, linesOfCode: 2_180 },
    ],
  },
  {
    projectId: 'demo-proj-04',
    fileCount: 198,
    directoryCount: 31,
    linesOfCode: 27_355,
    thirdPartySize: 41_943_040,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/sextant.git',
    lastCommitDaysAgo: 3,
    lastCommitMessage: 'Batch metric writes behind a bounded channel',
    hasUncommittedChanges: false,
    languages: [{ technologySlug: 'rust', fileCount: 198, percentage: 1000, linesOfCode: 27_355 }],
  },
  {
    projectId: 'demo-proj-05',
    fileCount: 142,
    directoryCount: 23,
    linesOfCode: 15_802,
    thirdPartySize: 22_020_096,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/ballast.git',
    lastCommitDaysAgo: 5,
    lastCommitMessage: 'Retry failed jobs with exponential backoff',
    hasUncommittedChanges: false,
    languages: [{ technologySlug: 'go', fileCount: 142, percentage: 1000, linesOfCode: 15_802 }],
  },
  {
    projectId: 'demo-proj-06',
    fileCount: 356,
    directoryCount: 49,
    linesOfCode: 21_118,
    thirdPartySize: 241_172_480,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/driftwood.git',
    lastCommitDaysAgo: 8,
    lastCommitMessage: 'Tune seasonality window for weekly forecasts',
    hasUncommittedChanges: false,
    languages: [
      { technologySlug: 'python', fileCount: 356, percentage: 1000, linesOfCode: 21_118 },
    ],
  },
  {
    projectId: 'demo-proj-07',
    fileCount: 429,
    directoryCount: 66,
    linesOfCode: 33_240,
    thirdPartySize: 386_924_544,
    gitBranch: 'release/2.4',
    gitRemoteUrl: 'git@github.com:harborlabs/seaglass.git',
    lastCommitDaysAgo: 12,
    lastCommitMessage: 'Persist window bounds across restarts',
    hasUncommittedChanges: false,
    languages: [
      { technologySlug: 'typescript', fileCount: 265, percentage: 618, linesOfCode: 20_542 },
      { technologySlug: 'vue', fileCount: 133, percentage: 310, linesOfCode: 10_304 },
      { technologySlug: 'css', fileCount: 31, percentage: 72, linesOfCode: 2_394 },
    ],
  },
  {
    projectId: 'demo-proj-08',
    fileCount: 243,
    directoryCount: 38,
    linesOfCode: 17_889,
    thirdPartySize: 189_792_256,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/mooring-mobile.git',
    lastCommitDaysAgo: 16,
    lastCommitMessage: 'Fix safe-area insets on notched devices',
    hasUncommittedChanges: false,
    languages: [
      { technologySlug: 'typescript', fileCount: 221, percentage: 909, linesOfCode: 16_261 },
      { technologySlug: 'javascript', fileCount: 22, percentage: 91, linesOfCode: 1_628 },
    ],
  },
  {
    projectId: 'demo-proj-09',
    fileCount: 512,
    directoryCount: 87,
    linesOfCode: 41_663,
    thirdPartySize: 74_448_896,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/anchor-admin.git',
    lastCommitDaysAgo: 24,
    lastCommitMessage: 'Add role-based policy checks to reports',
    hasUncommittedChanges: false,
    languages: [
      { technologySlug: 'php', fileCount: 408, percentage: 797, linesOfCode: 33_205 },
      { technologySlug: 'html', fileCount: 71, percentage: 139, linesOfCode: 5_791 },
      { technologySlug: 'css', fileCount: 33, percentage: 64, linesOfCode: 2_667 },
    ],
  },
  {
    projectId: 'demo-proj-10',
    fileCount: 87,
    directoryCount: 14,
    linesOfCode: 9_421,
    thirdPartySize: 8_388_608,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/kelp.git',
    lastCommitDaysAgo: 31,
    lastCommitMessage: 'Support --json output for every subcommand',
    hasUncommittedChanges: false,
    languages: [{ technologySlug: 'rust', fileCount: 87, percentage: 1000, linesOfCode: 9_421 }],
  },
  {
    projectId: 'demo-proj-11',
    fileCount: 164,
    directoryCount: 27,
    linesOfCode: 12_074,
    thirdPartySize: 63_963_136,
    gitBranch: 'spike/presence',
    gitRemoteUrl: 'git@github.com:harborlabs/spindrift.git',
    lastCommitDaysAgo: 45,
    lastCommitMessage: 'Prototype presence indicators over websockets',
    hasUncommittedChanges: true,
    languages: [
      { technologySlug: 'vue', fileCount: 96, percentage: 585, linesOfCode: 7_063 },
      { technologySlug: 'typescript', fileCount: 68, percentage: 415, linesOfCode: 5_011 },
    ],
  },
  {
    projectId: 'demo-proj-12',
    fileCount: 233,
    directoryCount: 41,
    linesOfCode: 22_508,
    thirdPartySize: 45_088_768,
    gitBranch: 'main',
    gitRemoteUrl: 'git@github.com:harborlabs/reef-scheduler.git',
    lastCommitDaysAgo: 63,
    lastCommitMessage: 'Upgrade to the 21 LTS runtime',
    hasUncommittedChanges: false,
    languages: [{ technologySlug: 'java', fileCount: 233, percentage: 1000, linesOfCode: 22_508 }],
  },
];
