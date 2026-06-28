import { describe, it, expect } from 'vitest';
import {
  parsePolisVotes,
  parsePolisComments,
  assemblePolisImport,
} from '../app/utils/polisImport';

describe('parsePolisVotes', () => {
  it('parses comment-id, voter-id and vote as numbers', () => {
    const csv = ['comment-id,voter-id,vote', '0,5,1', '1,5,-1', '2,7,0'].join('\n');
    expect(parsePolisVotes(csv)).toEqual([
      { commentId: 0, voterId: 5, vote: 1 },
      { commentId: 1, voterId: 5, vote: -1 },
      { commentId: 2, voterId: 7, vote: 0 },
    ]);
  });
});

describe('parsePolisComments', () => {
  it('parses comment-id, timestamp and body', () => {
    const csv = [
      'comment-id,timestamp,comment-body',
      '0,1000,Hello world',
      '1,2000,Second comment',
    ].join('\n');
    expect(parsePolisComments(csv)).toEqual([
      { commentId: 0, timestamp: 1000, body: 'Hello world' },
      { commentId: 1, timestamp: 2000, body: 'Second comment' },
    ]);
  });
});

describe('assemblePolisImport', () => {
  const comments = [
    { commentId: 0, timestamp: 1000, body: 'first' },
    { commentId: 1, timestamp: 2000, body: 'second' },
  ];
  const votes = [
    { commentId: 0, voterId: 10, vote: 1 as const },
    { commentId: 0, voterId: 20, vote: -1 as const },
    { commentId: 1, voterId: 10, vote: 0 as const },
    // voter 10 votes more often, so ranks above voter 20
    { commentId: 1, voterId: 10, vote: 0 as const },
  ];

  it('orders moments by timestamp descending', () => {
    const { moments } = assemblePolisImport(comments, votes, ['u1', 'u2']);
    expect(moments.map((m) => m.label)).toEqual(['second', 'first']);
  });

  it('converts comment timestamps from seconds to milliseconds', () => {
    const { moments } = assemblePolisImport(comments, votes, ['u1', 'u2']);
    const first = moments.find((m) => m.label === 'first')!;
    expect(first.timestamp).toBe(1_000_000);
  });

  it('maps votes to regions (1→positive, -1→negative, 0→neutral)', () => {
    const { moments } = assemblePolisImport(comments, votes, ['u1', 'u2']);
    const first = moments.find((m) => m.label === 'first')!;
    const regionValues = Object.values(first.regions).sort();
    // comment 0 had a +1 and a -1 vote → one positive, one negative
    expect(regionValues).toEqual(['negative', 'positive']);
  });

  it('maps a non-voter on a comment to null', () => {
    const { moments } = assemblePolisImport(comments, votes, ['u1', 'u2']);
    const second = moments.find((m) => m.label === 'second')!;
    // only voter 10 voted on comment 1; voter 20's user has no vote → null
    const values = Object.values(second.regions);
    expect(values).toContain('neutral'); // voter 10 voted 0
    expect(values).toContain(null); // voter 20's user did not vote
  });

  it('reuses all seen users and creates no synthetic ids when enough are supplied', () => {
    const { syntheticUserIds } = assemblePolisImport(comments, votes, ['u1', 'u2']);
    expect(syntheticUserIds).toEqual([]);
  });

  it('generates synthetic ids for voters beyond the supplied seen users', () => {
    // two distinct voters but only one seen user → one synthetic id
    const { syntheticUserIds, moments } = assemblePolisImport(comments, votes, ['u1']);
    expect(syntheticUserIds).toHaveLength(1);
    // every moment's regions should reference both the seen user and the synthetic id
    const userIds = new Set(Object.keys(moments[0].regions));
    expect(userIds.has('u1')).toBe(true);
    expect(userIds.has(syntheticUserIds[0])).toBe(true);
  });

  it('assigns a unique id to every moment', () => {
    const { moments } = assemblePolisImport(comments, votes, ['u1', 'u2']);
    const ids = moments.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
