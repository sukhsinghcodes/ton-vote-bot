import { appConfig, directLinkKeys } from './config';
import * as api from './api';
import { Subscription } from './types';
import { Markup } from 'telegraf';
import sanitizeHtml from 'sanitize-html';
import { truncate } from './utils';
import { format, formatDistance } from 'date-fns';

type ReportMessage = {
  daoName: string;
  botUsername: string;
  daoAddress: string;
  activeProposals: api.ProposalMetadata[];
  pendingProposals: api.ProposalMetadata[];
};
export function getReportMessage({
  daoName,
  botUsername,
  daoAddress,
  activeProposals,
  pendingProposals,
}: ReportMessage) {
  return `*DAO:* [${truncate(daoName, 30)}](${appConfig.getGroupLaunchWebAppUrl(
    botUsername,
    `${directLinkKeys.dao}${daoAddress}`,
  )})\n\n${
    activeProposals.length > 0
      ? `*Active proposals:*\n\n${activeProposals
          .map(
            (p, index) =>
              `${index + 1}.  [${truncate(p.title, 30)}](${appConfig.getGroupLaunchWebAppUrl(
                botUsername,
                `${directLinkKeys.dao}${daoAddress}${directLinkKeys.separator}${directLinkKeys.proposal}${p.address}`,
              )})
     ${truncate(sanitizeHtml(p.description), 30)}\n
     ✅ Yes          ${p.yes || 0}
     ❌ No           ${p.no || 0}
     🤐 Abstain   ${p.abstain || 0}\n\n     _Ends in ${formatDistance(
       p.proposalEndTime * 1000,
       Date.now(),
     )}_`,
          )
          .join('\n\n')}`
      : ''
  }${
    pendingProposals.length > 0
      ? `${activeProposals.length > 0 ? '\n\n' : ''}*Upcoming proposals:*\n\n${pendingProposals
          .map(
            (p, index) =>
              `${index + 1}.  [${p.title}](${appConfig.getGroupLaunchWebAppUrl(
                botUsername,
                `${directLinkKeys.dao}${daoAddress}${directLinkKeys.separator}${directLinkKeys.proposal}${p.address}`,
              )}) 
     ${truncate(sanitizeHtml(p.description), 30)}\n\n     _Starts in ${formatDistance(
       p.proposalStartTime * 1000,
       Date.now(),
     )}_`,
          )
          .join('\n\n')}`
      : ''
  }\n\n\n`;
}

type GroupReportMessage = {
  groupId: number;
  message: string;
};

export async function getDaoReportMessages(
  subscriptions: Subscription[],
  botUsername: string,
): Promise<GroupReportMessage[]> {
  const messages: GroupReportMessage[] = [];

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
        const nowUnixInSeconds = Date.now();
        const startTime = proposal.proposalStartTime * 1000;
        const endTime = proposal.proposalEndTime * 1000;

        if (nowUnixInSeconds > endTime) {
          return;
        }

        if (nowUnixInSeconds < startTime) {
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

      messages[currentIndex].message += getReportMessage({
        daoName: dao.name,
        botUsername,
        daoAddress: dao.address,
        activeProposals,
        pendingProposals,
      });
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
    `Thanks for adding TON Vote bot to group *${groupTitle}*! 😊\n\nTap on the 'Select Space' button below to choose the DAO that the group will start receiving notfications for.`,
  buttonReplyMarkup: (groupId: number) =>
    Markup.keyboard([
      Markup.button.webApp('Select Space', `${appConfig.subscribeUrl}&groupId=${groupId}`),
    ]).resize().reply_markup,
};

type ProposalMessage = {
  daoName: string;
  proposalTitle: string;
  proposalDescription: string;
  startTime: number;
  endTime: number;
};

export function getNewProposalMessage({
  daoName,
  proposalTitle,
  proposalDescription,
  startTime,
  endTime,
}: ProposalMessage) {
  return `🎉 *NEW PROPOSAL*\n\nDAO: *${daoName}*\n\n*${proposalTitle}*\n${truncate(
    sanitizeHtml(proposalDescription),
    90,
  )}\n\nStarts on: ${format(startTime, 'dd/mm/yyyy HH:MM')} UTC\nEnds on: ${format(
    endTime,
    'dd/mm/yyyy HH:MM',
  )} UTC`;
}

type VoteStartedMessage = {
  daoName: string;
  proposalTitle: string;
  proposalDescription: string;
};

export function getVoteStartedMessage({
  daoName,
  proposalTitle,
  proposalDescription,
}: VoteStartedMessage) {
  return `🟢 *VOTING STARTED*\n\nDAO: *${daoName}*\n\n*${proposalTitle}*\n${truncate(
    sanitizeHtml(proposalDescription),
    90,
  )}`;
}

type VoteEndedMessage = {
  daoName: string;
  proposalTitle: string;
  proposalDescription: string;
  results: {
    yes: number;
    no: number;
    abstain: number;
  };
};

export function getVoteEndedMessage({
  daoName,
  proposalTitle,
  proposalDescription,
  results,
}: VoteEndedMessage) {
  return `🏁 *VOTING ENDED*\n\nDAO: *${daoName}*\n\n*${proposalTitle}*\n${truncate(
    sanitizeHtml(proposalDescription),
    90,
  )}\n\n*Results*\n✅ Yes:          ${results.yes || 0}\n❌ No:           ${
    results.no || 0
  }\n🤐 Abstain:   ${results.abstain || 0}`;
}
