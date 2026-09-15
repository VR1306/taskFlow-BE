import { Router } from 'express';
import v1Routes from './v1/v1.routes.js';

const router = Router();

router.use('/v1', v1Routes);

export default router;
