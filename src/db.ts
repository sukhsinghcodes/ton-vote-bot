import sqlite3 from 'sqlite3';
import { NewSubscription, Subscription, SubscriptionId } from './types';

export class Database {
  private db;

  constructor() {
    this.db = new sqlite3.Database('tonvote.db');

    const createSubscriptionsTable = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        groupId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        daoAddress TEXT NOT NULL,
        daoName TEXT NOT NULL
      )
    `;

    this.db.run(createSubscriptionsTable);

    const createReadProposalsTable = `
      CREATE TABLE IF NOT EXISTS readProposals (
        id TEXT PRIMARY KEY NOT NULL
      )
    `;

    this.db.run(createReadProposalsTable);
  }

  async insert(newSubscription: NewSubscription): Promise<boolean> {
    const { groupId, userId, daoName, daoAddress } = newSubscription;

    const id = `${groupId}:${daoAddress}`;

    // Check if subscription already exists
    try {
      const subscription = await this.get(id);
      if (subscription) {
        return Promise.reject(new Error('Subscription already exists'));
      }
    } catch (err) {
      // Subscription does not exist
    }

    return new Promise<boolean>((resolve, reject) => {
      const insert = `
        INSERT INTO subscriptions (id, groupId, userId, daoName, daoAddress)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(insert, [id, groupId, userId, daoName, daoAddress], (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(true);
      });
    });
  }

  getAll(): Promise<Subscription[]> {
    return new Promise<Subscription[]>((resolve, reject) => {
      this.db.all('SELECT * FROM subscriptions', (err, rows: Subscription[]) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows);
      });
    });
  }

  getAllByUserId(userId: number): Promise<Subscription[]> {
    return new Promise<Subscription[]>((resolve, reject) => {
      this.db.all(
        'SELECT * FROM subscriptions WHERE userId = ?',
        [userId],
        (err, rows: Subscription[]) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows);
        },
      );
    });
  }

  getAllByGroupId(groupId: number): Promise<Subscription[]> {
    return new Promise<Subscription[]>((resolve, reject) => {
      this.db.all(
        'SELECT * FROM subscriptions WHERE groupId = ?',
        [groupId],
        (err, rows: Subscription[]) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows);
        },
      );
    });
  }

  get(id: SubscriptionId): Promise<Subscription> {
    return new Promise<Subscription>((resolve, reject) => {
      this.db.get('SELECT * FROM subscriptions WHERE id = ?', [id], (err, row: Subscription) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row);
      });
    });
  }

  delete(id: SubscriptionId): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.db.run('DELETE FROM subscriptions WHERE id = ?', [id], (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(true);
      });
    });
  }

  insertReadProposal(id: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const insert = `
        INSERT INTO readProposals (id)
        VALUES (?)
      `;

      this.db.run(insert, [id], (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(true);
      });
    });
  }

  containsReadProposal(id: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.db.all('SELECT * FROM readProposals WHERE id = ?', [id], (err, rows: string[]) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows.length > 0);
      });
    });
  }

  clearProposals(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.db.run('DELETE FROM readProposals', (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(true);
      });
    });
  }
}
