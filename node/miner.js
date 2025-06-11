import dotenv from 'dotenv';
import express from 'express';
import logger from '#modules/logger/index.js';
import googleMapsReviewsRoute from '#routes/miner/google-maps/reviews.js';
import localhostOnly from '#modules/middlewares/localhost-only.js';

dotenv.config();

const app = express();
const PORT = process.env.MINER_NODE_PORT || 3001;

// Middleware
app.use(localhostOnly);
app.use(express.json());

// Routes
// Google Maps
app.get('/google-maps/reviews/:fid', googleMapsReviewsRoute.execute);

// Start server and log configuration
app.listen(PORT, () => {
  logger.info('='.repeat(50));
  logger.info(`[Miner] Node running on port ${PORT}`);
  logger.info(`[Miner] Google Reviews endpoint: GET /google-maps/reviews/:fid`);
  logger.info(`[Miner] Apify token configured: ${Boolean(process.env.APIFY_TOKEN)}`);
  logger.info('='.repeat(50));
});
