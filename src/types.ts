export type SubscriptionId = string;

export type Subscription = {
  id: SubscriptionId; // "groupId:daoAddress"
  groupId: number;
  userId: number;
  daoAddress: string;
  daoName: string;
};

export type NewSubscription = Omit<Subscription, 'id'>;

export type WebAppDataSubscribe = {
  name: string;
  address: string;
  groupId: number;
};
