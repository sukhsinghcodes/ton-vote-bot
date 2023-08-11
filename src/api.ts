import axios from 'axios';

// const productionApi = 'https://api.ton.vote';
const devApi = 'https://dev-api.ton.vote';

// {
//   "daoAddress": "EQCb8dxevgHhBnsTodJKXaCrafplHzAHf1V2Adj0GVlhA5xI",
//   "daoId": 0,
//   "daoMetadata": {
//     "metadataAddress": "EQCwwyFEnY-cwL_HW4Pg9ccGwYs0su10_E5xXUlCpumDjdzP",
//     "metadataArgs": {
//       "about": "{\"en\":\"This is the official TON Foundation space\\n\\n\"}",
//       "avatar": "https://tonv.s3.us-east-2.amazonaws.com/ton.png",
//       "github": "https://github.com/ton-blockchain",
//       "hide": false,
//       "name": "{\"en\":\"TON Foundation\"}",
//       "terms": "",
//       "telegram": "https://t.me/toncoin_chat",
//       "website": "https://ton.org/",
//       "jetton": "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
//       "nft": "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
//       "dns": "foundation.ton"
//     }
//   },
//   "daoRoles": {
//     "owner": "EQCBrRdawVLx66y2O7qYPqrFmd9jUCDbR8bXjC4m1SymwhnV",
//     "proposalOwner": "EQDehfd8rzzlqsQlVNPf9_svoBcWJ3eRbz-eqgswjNEKRIwo"
//   },
//   "nextProposalId": 0,
//   "daoProposals": []
// }

export type Dao = {
  daoAddress: string;
  daoId: number;
  daoMetadata: {
    metadataAddress: string;
    metadataArgs: {
      about: string;
      avatar: string;
      github: string;
      hide: boolean;
      name: string;
      terms: string;
      telegram: string;
      website: string;
      jetton: string;
      nft: string;
      dns: string;
    };
  };
  daoRoles: {
    owner: string;
    proposalOwner: string;
  };
  nextProposalId: number;
  daoProposals: string[];
};

export async function daos(): Promise<Dao[]> {
  const url = `${devApi}/daos`;

  try {
    const response = await axios.get<Dao[]>(url);
    const data = response.data;

    return data;
  } catch (error) {
    console.error('An error occurred while executing the request (/daos):', error);
    throw new Error('An error occurred while executing the request (/daos)');
  }
}

// console.log(daos('EQDi7_28cJItXu5t5evsnEKNtUYv_1aQve21T4bzFxbxJ8HF'));

export type DaoMetadata = {
  address: string;
  name: string;
  about: string;
  avatar: string;
  website: string;
  telegram: string;
  github: string;
  daoProposals: string[];
};

export async function dao(address: string): Promise<DaoMetadata> {
  const url = `${devApi}/dao/${address}`;

  try {
    const response = await axios.get<Dao>(url);
    const data = response.data;

    const name = JSON.parse(data.daoMetadata.metadataArgs.name).en;
    const about = JSON.parse(data.daoMetadata.metadataArgs.about).en;
    const avatar = data.daoMetadata.metadataArgs.avatar;
    const website = data.daoMetadata.metadataArgs.website;
    const telegram = data.daoMetadata.metadataArgs.telegram;
    const github = data.daoMetadata.metadataArgs.github;

    const daoProposals = data.daoProposals;

    return {
      address,
      name,
      about,
      avatar,
      website,
      telegram,
      github,
      daoProposals,
    };
  } catch (error) {
    console.error('An error occurred while executing the request (/dao/daoAddress):', error);
    throw new Error('An error occurred while executing the request (/dao/daoAddress)');
  }
}

// console.log(dao('EQA-Qno-vCjLbDJXxOB-vhHY8sH8hVbH4if-iSMi-JwaIdP4'));

// {
//   "daoAddress": "EQDVDfWLPy7XIEYLcXLGD7jL23M-KL0Sny3dgm-ILa69f868",
//   "metadata": {
//     "id": 0,
//     "proposalDeployer": "EQB09NJD8Ss9Q7WH6UcRFiBQcBQB49-aTJIGrEwKfIMoMlGZ",
//     "mcSnapshotBlock": 31563297,
//     "proposalStartTime": 1690961580,
//     "proposalEndTime": 1691820000,
//     "proposalSnapshotTime": 1690848000,
//     "votingSystem": {
//       "votingSystemType": 0,
//       "choices": [
//         "Yes",
//         "No",
//         "Abstain"
//       ]
//     },
//     "votingPowerStrategies": [
//       {
//         "type": "0",
//         "arguments": []
//       }
//     ],
//     "title": "{\"en\":\"Testing TWA\"}",
//     "description": "{\"en\":\"Testing twa\"}",
//     "quorum": "",
//     "hide": false
//   },
//   "votingPower": {
//     "EQCBA1FQG8tQsVshRamHLF-obmoesnWN1ScwSgFzyg2VBRZT": "30830600816"
//   },
//   "votes": {
//     "EQCBA1FQG8tQsVshRamHLF-obmoesnWN1ScwSgFzyg2VBRZT": {
//       "timestamp": 1691591815,
//       "vote": "yes",
//       "hash": "99016257545347192756360726434474697363041977173793323854825081274971951350082"
//     }
//   },
//   "proposalResult": {
//     "yes": 100,
//     "no": 0,
//     "abstain": 0,
//     "totalWeights": "30830600816"
//   },
//   "validatorsVotingData": {}
// }

export type Proposal = {
  daoAddress: string;
  metadata: {
    id: number;
    proposalDeployer: string;
    mcSnapshotBlock: number;
    proposalStartTime: number;
    proposalEndTime: number;
    proposalSnapshotTime: number;
    votingSystem: {
      votingSystemType: number;
      choices: string[];
    };
    votingPowerStrategies: {
      type: string;
      arguments: string[];
    }[];
    title: string;
    description: string;
    quorum: string;
    hide: boolean;
  };
  votingPower: {
    [key: string]: string;
  };
  votes: {
    [key: string]: {
      timestamp: number;
      vote: string;
      hash: string;
    };
  };
  proposalResult: {
    yes: number;
    no: number;
    abstain: number;
    totalWeights: string;
  };
  validatorsVotingData: unknown;
};

export type ProposalMetadata = {
  address: string;
  title: string;
  description: string;
  daoAddress: string;
  proposalStartTime: number;
  proposalEndTime: number;
  yes: number | null;
  no: number | null;
  abstain: number | null;
};

export async function proposal(proposalAddress: string): Promise<ProposalMetadata> {
  const url = `${devApi}/proposal/${proposalAddress}`;

  try {
    const response = await axios.get<Proposal>(url);
    const data = response.data;

    const metadata = data.metadata;
    const title = JSON.parse(metadata.title).en;
    const description = JSON.parse(metadata.description).en;
    const daoAddress = data.daoAddress;
    const proposalStartTime = metadata.proposalStartTime;
    const proposalEndTime = metadata.proposalEndTime;

    let yes: number | null = null;
    let no: number | null = null;
    let abstain: number | null = null;
    if (data.proposalResult) {
      yes = data.proposalResult.yes;
      no = data.proposalResult.no;
      abstain = data.proposalResult.abstain;
    }

    return {
      address: proposalAddress,
      title,
      description,
      daoAddress,
      proposalStartTime,
      proposalEndTime,
      yes,
      no,
      abstain,
    };
  } catch (error) {
    console.error(
      'An error occurred while executing the request (/proposal/proposalAddress):',
      error,
    );
    throw new Error('An error occurred while executing the request (/proposal/proposalAddress)');
  }
}

// console.log(proposal('EQDUYK1eiH8a67w0QaiHyD6Xx6Y8DpUO22B00L9nY9CdTmgQ'));
