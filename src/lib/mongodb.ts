import {
  MongoClient,
  ServerApiVersion,
} from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error(
    "MONGODB_URI .env.local içerisinde tanımlanmalıdır."
  );
}

if (!databaseName) {
  throw new Error(
    "MONGODB_DB .env.local içerisinde tanımlanmalıdır."
  );
}

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },

  family: 4 as const,
};

declare global {
  var _mongoClientPromise:
    | Promise<MongoClient>
    | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(
      uri,
      options
    );

    global._mongoClientPromise =
      client.connect();
  }

  clientPromise =
    global._mongoClientPromise;
} else {
  const client = new MongoClient(
    uri,
    options
  );

  clientPromise =
    client.connect();
}

export default clientPromise;

export async function getDatabase() {
  const client = await clientPromise;

  return client.db(databaseName);
}