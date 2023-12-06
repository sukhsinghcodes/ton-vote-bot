import { appConfig, directLinkKeys } from './config';
import * as api from './api';
import { Subscription } from './types';
import { Markup } from 'telegraf';
import sanitizeHtml from 'sanitize-html';
import { truncate } from './utils';

type ReportMessage = {
  groupId: number;
  message: string;
};

export async function getDaoReportMessages(
  subscriptions: Subscription[],
  botUsername: string,
): Promise<ReportMessage[]> {
  const messages: ReportMessage[] = [];

  try {
    for (const subscription of subscriptions) {
      const { daoAddress, groupId } = subscription;

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

        if (nowUnixInSeconds > proposal.proposalEndTime) {
          return;
        }

        if (nowUnixInSeconds < proposal.proposalStartTime) {
          pendingProposals.push(proposal);
          return;
        }

        activeProposals.push(proposal);
      });

      if (activeProposals.length === 0 && pendingProposals.length === 0) {
        continue;
      }

      let currentIndex = messages.findIndex((m) => m.groupId === groupId);

      if (currentIndex === -1) {
        messages.push({
          groupId,
          message: '📊 *DAILY REPORT*\n\n',
        });

        currentIndex = messages.length - 1;
      }

      messages[currentIndex].message += `DAO: [${truncate(
        dao.name,
        30,
      )}](${appConfig.getGroupLaunchWebAppUrl(
        botUsername,
        `${directLinkKeys.dao}${dao.address}`,
      )})\n\n${
        activeProposals.length > 0
          ? `*Active proposals:*\n\n${activeProposals
              .map(
                (p, index) =>
                  `${index + 1}. [${p.title}](${appConfig.getGroupLaunchWebAppUrl(
                    botUsername,
                    `${directLinkKeys.dao}${daoAddress}${directLinkKeys.separator}${directLinkKeys.proposal}${p.address}`,
                  )})
   ${truncate(sanitizeHtml(p.description), 30)}
   ✅ Yes      *${p.yes || 0}*
   ❌ No       *${p.no || 0}*
   🤐 Abstain  *${p.abstain || 0}*`,
              )
              .join('\n\n')}`
          : ''
      }${
        pendingProposals.length > 0
          ? `\n\n*Upcoming proposals:*\n${pendingProposals
              .map(
                (p, index) =>
                  `${index + 1}. [${p.title}](${appConfig.getGroupLaunchWebAppUrl(
                    botUsername,
                    `${directLinkKeys.dao}${daoAddress}${directLinkKeys.separator}${directLinkKeys.proposal}${p.address}`,
                  )}) 
   ${truncate(sanitizeHtml(p.description), 30)}`,
              )
              .join('\n\n')}`
          : ''
      }\n\n`;
    }
  } catch (e) {
    console.log(e);
  }

  return messages;
}

export const SubscribeMessages = {
  notAdmin: (groupTitle: string) =>
    `You must be an admin of *${groupTitle}* to configure this bot.`,
  start: (groupTitle: string) =>
    `Thanks for adding me to *${groupTitle}*! 😊\n\nTap on the 'Select DAO' button below to receive notfications in your group.`,
  buttonReplyMarkup: (groupId: number) =>
    Markup.keyboard([
      Markup.button.webApp('Select DAO', `${appConfig.subscribeUrl}&groupId=${groupId}`),
    ]).resize().reply_markup,
};
