import { MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI ?? '';

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const c = await clientPromise;
  return c.db('waitlist');
}

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();

  const users = db.collection('users');
  await users.createIndex({ privyDid: 1 }, { unique: true });
  await users.createIndex({ twitterId: 1 }, { unique: true });
  await users.createIndex({ referralCode: 1 }, { unique: true });
  await users.createIndex({ points: -1 });
  await users.createIndex({ referredBy: 1 });

  const actionLogs = db.collection('action_logs');
  await actionLogs.createIndex({ privyDid: 1, action: 1, createdAt: -1 });
}

export default clientPromise;
