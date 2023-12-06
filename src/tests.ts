import axios from 'axios';
import { appConfig, messageVideoUrl } from './config';
import {
  getNewProposalMessage,
  getReportMessage,
  getVoteEndedMessage,
  getVoteStartedMessage,
} from './messages';
import { Markup } from 'telegraf';
import { add, addDays, subDays } from 'date-fns';

const apiUrl = `https://api.telegram.org/bot${appConfig.apiToken}/sendVideo`;
const LOCAL_CHAT_ID = 542374629;

async function runTests() {
  await axios.post(apiUrl, {
    video: messageVideoUrl,
    caption: getNewProposalMessage({
      daoName: 'CryptoPunks',
      proposalTitle: 'Decomission CryptoPunks in favor of KittyPunks',
      proposalDescription:
        'We are proposing to decomission CryptoPunks in favor of KittyPunks. CryptoPunks are old and boring, and KittyPunks are new and exciting. We should decomission CryptoPunks in favor of KittyPunks.',
      startTime: add(Date.now(), { days: 3 }).getTime(),
      endTime: add(Date.now(), { days: 10 }).getTime(),
    }),
    reply_markup: Markup.inlineKeyboard([
      Markup.button.url('📬 View proposal', 'https://dev.ton.vote'),
    ]).reply_markup,
    chat_id: LOCAL_CHAT_ID,
    parse_mode: 'Markdown',
  });

  await axios.post(apiUrl, {
    video: messageVideoUrl,
    caption: getVoteStartedMessage({
      daoName: 'CryptoPunks',
      proposalTitle: 'Decomission CryptoPunks in favor of KittyPunks',
      proposalDescription:
        'We are proposing to decomission CryptoPunks in favor of KittyPunks. CryptoPunks are old and boring, and KittyPunks are new and exciting. We should decomission CryptoPunks in favor of KittyPunks.',
    }),
    reply_markup: Markup.inlineKeyboard([Markup.button.url('✍🏻 Vote now', 'https://dev.ton.vote')])
      .reply_markup,
    chat_id: LOCAL_CHAT_ID,
    parse_mode: 'Markdown',
  });

  await axios.post(apiUrl, {
    video: messageVideoUrl,
    caption: getVoteEndedMessage({
      daoName: 'CryptoPunks',
      proposalTitle: 'Decomission CryptoPunks in favor of KittyPunks',
      proposalDescription:
        'We are proposing to decomission CryptoPunks in favor of KittyPunks. CryptoPunks are old and boring, and KittyPunks are new and exciting. We should decomission CryptoPunks in favor of KittyPunks.',
      results: {
        yes: 100,
        no: 0,
        abstain: 0,
      },
    }),
    reply_markup: Markup.inlineKeyboard([
      Markup.button.url('📊 View results', 'https://dev.ton.vote'),
    ]).reply_markup,
    chat_id: LOCAL_CHAT_ID,
    parse_mode: 'Markdown',
  });

  await axios.post(apiUrl, {
    video: messageVideoUrl,
    caption:
      '📊 *DAILY REPORT*\n\n' +
      getReportMessage({
        daoName: 'TONPunks',
        botUsername: 'tonvotedevbot',
        daoAddress: '0:0000000000',
        activeProposals: [
          {
            abstain: 0,
            no: 0,
            yes: 5,
            title: 'Decomission TONPunks in favor of TONKitties',
            description:
              'We are proposing to decomission TONPunks in favor of TONKitties. TONPunks are old and boring, and TONKitties are new and exciting. We should decomission TONPunks in favor of TONKitties.',
            proposalStartTime: subDays(Date.now(), 2).getTime(),
            proposalEndTime: addDays(Date.now(), 5).getTime(),
            address: '0:0000000000',
            daoAddress: '0:0000000000',
          },
          {
            abstain: 0,
            no: 1,
            yes: 0,
            title: 'Allow TONPunks to be used as collateral',
            description: 'We are proposing to allow TONPunks to be used as collateral.',
            proposalStartTime: subDays(Date.now(), 6).getTime(),
            proposalEndTime: addDays(Date.now(), 1).getTime(),
            address: '0:0000000000',
            daoAddress: '0:0000000000',
          },
        ],
        pendingProposals: [
          {
            abstain: 0,
            no: 0,
            yes: 0,
            title: 'CIP-03: Implement Web4',
            description:
              'We are proposing to to implement Web4. Web4 is the next evolution of the web.',
            proposalStartTime: addDays(Date.now(), 3).getTime(),
            proposalEndTime: addDays(Date.now(), 10).getTime(),
            address: '0:0000000000',
            daoAddress: '0:0000000000',
          },
        ],
      }) +
      getReportMessage({
        daoName: 'TON Marketplace',
        botUsername: 'tonvotedevbot',
        daoAddress: '0:0000000000',
        activeProposals: [],
        pendingProposals: [
          {
            abstain: 0,
            no: 0,
            yes: 0,
            title: 'CIP-03: Implement Web4',
            description:
              'We are proposing to to implement Web4. Web4 is the next evolution of the web.',
            proposalStartTime: addDays(Date.now(), 3).getTime(),
            proposalEndTime: addDays(Date.now(), 10).getTime(),
            address: '0:0000000000',
            daoAddress: '0:0000000000',
          },
        ],
      }),

    chat_id: LOCAL_CHAT_ID,
    parse_mode: 'Markdown',
  });
}

runTests();
