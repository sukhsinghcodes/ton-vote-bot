import dotenv from 'dotenv';

dotenv.config();

const tonVoteUrl = process.env.TON_VOTE_URL || '';
const tonVoteQueryParams = '?webapp=1';

export const appConfig = {
  tonVoteUrl,
  tonVoteQueryParams,
  twaUrl: `${tonVoteUrl}${tonVoteQueryParams}`,
  subscribeUrl: `${tonVoteUrl}${tonVoteQueryParams}&subscribe=1`,
  getGroupLaunchWebAppUrl: (botUsername: string, queryParam = '') =>
    `https://t.me/${botUsername}/${process.env.WEB_APP_USERNAME}?startapp=${queryParam}`,
  apiToken: process.env.BOT_TOKEN || '',
};

export const directLinkKeys = {
  dao: '_dao_',
  proposal: '_proposal_',
  separator: '-_-',
};

export const messageImageUrl = 'https://dev.ton.vote/ton-vote-message-short.gif';
export const messageVideoUrl = 'https://dev.ton.vote/ton-vote.mp4';
