import express from 'express';
import { createNestExpressApp } from './app.bootstrap';

const server = express();
let initPromise: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
    if (!initPromise) {
        initPromise = (async () => {
            const app = await createNestExpressApp(server);
            await app.init();
        })();
    }
    await initPromise;
}

module.exports = async (req: express.Request, res: express.Response) => {
    await ensureReady();
    server(req, res);
};
