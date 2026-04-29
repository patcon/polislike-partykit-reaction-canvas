import type { ReactNode } from "react";

interface TreevitesProps {
  selfId: string;
  inviteEdges: Record<string, string>; // inviteeId -> inviterId
}

interface TreeNode {
  id: string;
  children: TreeNode[];
}

function buildTree(inviteEdges: Record<string, string>): TreeNode[] {
  const allIds = new Set<string>();
  const hasParent = new Set<string>();
  for (const [inviteeId, inviterId] of Object.entries(inviteEdges)) {
    allIds.add(inviteeId);
    allIds.add(inviterId);
    hasParent.add(inviteeId);
  }
  const roots = [...allIds].filter(id => !hasParent.has(id));

  function buildNode(id: string): TreeNode {
    const children = Object.entries(inviteEdges)
      .filter(([, parentId]) => parentId === id)
      .map(([childId]) => buildNode(childId));
    return { id, children };
  }

  return roots.map(buildNode);
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function TreeNodeRow({ node, selfId, depth }: { node: TreeNode; selfId: string; depth: number }): ReactNode {
  const isSelf = node.id === selfId;
  const score = countDescendants(node);
  return (
    <li>
      <div
        className={`treevites-row${isSelf ? ' treevites-row--self' : ''}`}
        style={{ paddingLeft: depth * 20 }}
      >
        <span className="treevites-id">{node.id}</span>
        {isSelf && <span className="treevites-you"> (you)</span>}
        {score > 0 && <span className="treevites-score">{score}</span>}
      </div>
      {node.children.length > 0 && (
        <ul className="treevites-children">
          {node.children.map(child => (
            <TreeNodeRow key={child.id} node={child} selfId={selfId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Treevites({ selfId, inviteEdges }: TreevitesProps) {
  const roots = buildTree(inviteEdges);
  const isEmpty = Object.keys(inviteEdges).length === 0;

  return (
    <div className="treevites-container">
      <div className="treevites-header">
        <h2 className="treevites-title">Treevites</h2>
        <p className="treevites-subtitle">Invite leaderboard — numbers show transitive reach</p>
      </div>
      {isEmpty ? (
        <p className="treevites-empty">No invite chains recorded yet. Share your QR code to start the tree.</p>
      ) : (
        <ul className="treevites-tree">
          {roots.map(root => (
            <TreeNodeRow key={root.id} node={root} selfId={selfId} depth={0} />
          ))}
        </ul>
      )}
    </div>
  );
}
