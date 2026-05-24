import { csvParse } from 'd3';
import { generateUUID } from './userId';
import type { MomentSnapshot } from '../components/panels/AdminPanelNoDB/types';

interface PolisVoteRow {
  'comment-id': string;
  'voter-id': string;
  vote: string;
}

interface PolisCommentRow {
  'comment-id': string;
  timestamp: string;
  'comment-body': string;
}

export function parsePolisVotes(text: string) {
  return (csvParse(text) as PolisVoteRow[]).map(row => ({
    commentId: Number(row['comment-id']),
    voterId: Number(row['voter-id']),
    vote: Number(row.vote) as 1 | -1 | 0,
  }));
}

export function parsePolisComments(text: string) {
  return (csvParse(text) as PolisCommentRow[]).map(row => ({
    commentId: Number(row['comment-id']),
    timestamp: Number(row.timestamp),
    body: row['comment-body'],
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PolisImportResult {
  moments: MomentSnapshot[];
  syntheticUserIds: string[];
}

export function assemblePolisImport(
  comments: ReturnType<typeof parsePolisComments>,
  votes: ReturnType<typeof parsePolisVotes>,
  seenUsers: string[],
): PolisImportResult {
  // Count votes per voter-id to find most participatory voters
  const voteCounts = new Map<number, number>();
  for (const v of votes) {
    voteCounts.set(v.voterId, (voteCounts.get(v.voterId) ?? 0) + 1);
  }
  const rankedVoterIds = [...voteCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([voterId]) => voterId);

  // Map top-N voter-ids to real seen users; generate synthetic IDs for the rest
  const shuffledUsers = shuffle(seenUsers);
  const n = Math.min(rankedVoterIds.length, shuffledUsers.length);
  const voterToUser = new Map<number, string>();
  for (let i = 0; i < n; i++) {
    voterToUser.set(rankedVoterIds[i], shuffledUsers[i]);
  }
  const syntheticUserIds: string[] = [];
  for (let i = n; i < rankedVoterIds.length; i++) {
    const syntheticId = generateUUID();
    voterToUser.set(rankedVoterIds[i], syntheticId);
    syntheticUserIds.push(syntheticId);
  }

  // Build commentId → voterId → vote lookup
  const commentVotes = new Map<number, Map<number, number>>();
  for (const v of votes) {
    if (!commentVotes.has(v.commentId)) commentVotes.set(v.commentId, new Map());
    commentVotes.get(v.commentId)!.set(v.voterId, v.vote);
  }

  const sorted = [...comments].sort((a, b) => b.timestamp - a.timestamp);

  const moments = sorted.map(comment => {
    const regions: Record<string, 'positive' | 'negative' | 'neutral' | null> = {};
    const votesForComment = commentVotes.get(comment.commentId);
    for (const [voterId, userId] of voterToUser) {
      const vote = votesForComment?.get(voterId);
      if (vote === 1) regions[userId] = 'positive';
      else if (vote === -1) regions[userId] = 'negative';
      else if (vote === 0) regions[userId] = 'neutral';
      else regions[userId] = null;
    }
    return {
      id: generateUUID(),
      label: comment.body,
      timestamp: comment.timestamp * 1000,
      regions,
    };
  });

  return { moments, syntheticUserIds };
}
