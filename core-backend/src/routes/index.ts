/**
 * API router — mounts feature routers under /api.
 */
import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { chatRoutes } from './chat.routes';
import { sessionRoutes } from './session.routes';
import { documentRoutes } from './document.routes';
import { adminRoutes } from './admin.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/sessions', sessionRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/admin', adminRoutes);
