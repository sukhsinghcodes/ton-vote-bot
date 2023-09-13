import dotenv from 'dotenv';

dotenv.config();

const tonVoteUrl = process.env.TON_VOTE_URL || '';
const tonVoteQueryParams = '?webapp=1';

export const appConfig = {
  tonVoteUrl,
  tonVoteQueryParams,
  twaUrl: `${tonVoteUrl}${tonVoteQueryParams}`,
  subscribeUrl: `${tonVoteUrl}${tonVoteQueryParams}&subscribe=1`,
  getGroupLaunchWebAppUrl: (botUsername: string): string => {
    return `https://t.me/${botUsername}/${process.env.WEB_APP_USERNAME}?start=command`;
  },
  apiToken: process.env.BOT_TOKEN || '',
};
