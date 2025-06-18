import { createClient } from 'redis';

const client = createClient({ url: "redis://localhost:6379" });
await client.connect();

export default client;
