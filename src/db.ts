import sqlite3 from 'sqlite3';

type SubscriptionId = string;

export type Subscription = {
  id: SubscriptionId; // "chatId:daoAddress"
  chatId: number; // userId or groupId
  daoAddress: string;
  daoName: string;
};

export class Database {
  private db;

  constructor() {
    this.db = new sqlite3.Database('tonvote.db');

    const createTable = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        chatId INTEGER NOT NULL,
        daoAddress TEXT NOT NULL,
        daoName TEXT NOT NULL
      )
    `;

    this.db.run(createTable);
  }

  insert(newSubscription: Subscription): Promise<boolean> {
    const { id, chatId, daoAddress, daoName } = newSubscription;

    return new Promise<boolean>((resolve, reject) => {
      const insert = `
        INSERT INTO subscriptions (id, chatId, daoAddress, daoName)
        VALUES (?, ?, ?, ?)
      `;

      this.db.run(insert, [id, chatId, daoAddress, daoName], (err) => {
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

  getAllByChatId(chatId: number): Promise<Subscription[]> {
    return new Promise<Subscription[]>((resolve, reject) => {
      this.db.all(
        'SELECT * FROM subscriptions WHERE chatId = ?',
        [chatId],
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
}
