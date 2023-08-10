import axios from 'axios';

const productionApi = 'https://api.ton.vote'

export async function daos() {
  const url = `${productionApi}/daos`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    return data;
  } catch (error) {
    console.error('An error occurred while executing the request (/daos):', error);
  }
}

// console.log(daos('EQDi7_28cJItXu5t5evsnEKNtUYv_1aQve21T4bzFxbxJ8HF'));

export async function dao(daoAddress: string) {
  const url = `${productionApi}/dao/${daoAddress}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    const metadataArgs = JSON.parse(data['daoMetadata']['metadataArgs']['name']);
    const name = metadataArgs['en'];
    const about = JSON.parse(data['daoMetadata']['metadataArgs']['about'])['en'];
    const avatar = data['daoMetadata']['metadataArgs']['avatar'];
    const website = data['daoMetadata']['metadataArgs']['github'];
    const telegram = data['daoMetadata']['metadataArgs']['telegram'];
    const github = data['daoMetadata']['metadataArgs']['github'];

    const countProposals = data['nextProposalId'];
    const daoProposals = data['daoProposals'];

    return [name, about, avatar, website, telegram, github, countProposals, daoProposals];
  } catch (error) {
    console.error('An error occurred while executing the request (/dao/daoAddress):', error);
  }
}

// console.log(dao('EQA-Qno-vCjLbDJXxOB-vhHY8sH8hVbH4if-iSMi-JwaIdP4'));

export async function proposal(proposalAddress: string) {
  const url = `${productionApi}/proposal/${proposalAddress}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    const metadata = data['metadata'];
    const title = JSON.parse(metadata['title'])['en'];
    const description = JSON.parse(metadata['description'])['en'];
    const daoAddress = data['daoAddress'];
    const proposalStartTime = metadata['proposalStartTime'];
    const proposalEndTime = metadata['proposalEndTime'];

    let yes: number | null = null;
    let no: number | null = null;
    let abstain: number | null = null;
    if (data['proposalResult']) {
      yes = data['proposalResult']['yes'];
      no = data['proposalResult']['no'];
      abstain = data['proposalResult']['abstain'];
    }

    return [title, description, daoAddress, proposalStartTime, proposalEndTime, yes, no, abstain];
  } catch (error) {
    console.error('An error occurred while executing the request (/proposal/proposalAddress):', error);
  }
}

// console.log(proposal('EQDUYK1eiH8a67w0QaiHyD6Xx6Y8DpUO22B00L9nY9CdTmgQ'));
