import { appConfig } from './config';
import * as api from './api';
import { Subscription } from './types';

type ReportMessage = {
  groupId: number;
  message: string;
};

export async function getDaoReportMessages(
  subscriptions: Subscription[],
): Promise<ReportMessage[]> {
  const messages: ReportMessage[] = [];

  try {
    for (const subscription of subscriptions) {
      const { daoAddress } = subscription;

      const dao = await api.dao(daoAddress);

      if (!dao) {
        continue;
      }

      const results = await Promise.allSettled(
        dao.daoProposals.map((proposalAddress) => api.proposal(proposalAddress)),
      );

      const proposals = results
        .filter((p) => p.status === 'fulfilled')
        .map((p) => (p as PromiseFulfilledResult<api.ProposalMetadata>).value);

      const activeProposals: api.ProposalMetadata[] = [];
      const pendingProposals: api.ProposalMetadata[] = [];

      proposals.forEach((proposal) => {
        const nowUnixInSeconds = Math.floor(Date.now() / 1000);

        if (nowUnixInSeconds < proposal.proposalStartTime) {
          pendingProposals.push(proposal);
          return;
        }

        activeProposals.push(proposal);
      });

      if (activeProposals.length === 0 && pendingProposals.length === 0) {
        continue;
      }

      messages.push({
        groupId: subscription.groupId,
        message: `Daily report for *${dao.name}*\n\nActive proposals:\n${
          activeProposals.length > 0
            ? activeProposals
                .map(
                  (p) =>
                    `- [${p.title}](${appConfig.tonVoteUrl}/${p.daoAddress}/proposal/${
                      p.address
                    }): ✅ Yes ${p.yes || 0}, ❌ No ${p.no || 0}, 🤐 Abstain ${p.abstain || 0}`,
                )
                .join('\n')
            : '_No Active proposals'
        }\n\nPending proposals:\n${
          pendingProposals.length > 0
            ? pendingProposals
                .map(
                  (p) =>
                    `- [${p.title}](${appConfig.tonVoteUrl}/${p.daoAddress}/proposal/${p.address})`,
                )
                .join('\n')
            : '_No Pending proposals_'
        }`,
      });
    }
  } catch (e) {
    console.log(e);
  }

  return messages;
}
