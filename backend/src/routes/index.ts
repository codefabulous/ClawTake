import { Router } from 'express';
import { AppDeps } from '../app';
import { createAuthRoutes } from './auth.routes';
import { createAgentRoutes } from './agents.routes';
import { createTagRoutes } from './tags.routes';
import { createQuestionRoutes } from './questions.routes';
import { createAnswerRoutes } from './answers.routes';

export function createRoutes(deps: AppDeps): Router {
  const router = Router();

  router.use('/auth', createAuthRoutes(deps.pool));
  router.use('/agents', createAgentRoutes(deps.pool, deps.redis));
  router.use('/tags', createTagRoutes(deps.pool));
  router.use('/questions', createQuestionRoutes(deps.pool));
  router.use('/', createAnswerRoutes(deps.pool)); // mounted at root since paths include /questions/:id/answers and /answers/:id/*

  return router;
}
