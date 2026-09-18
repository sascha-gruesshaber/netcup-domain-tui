/** Starts the mock netcup API and prints its URL; stays up until killed. Used by CI smoke tests. */
import { startMockServer, SAMPLE_ZONES } from '../tests/mock-server.js';
const server = await startMockServer(SAMPLE_ZONES);
console.log(server.url);
