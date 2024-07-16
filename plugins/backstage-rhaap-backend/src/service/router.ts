/*
 * Copyright 2024 The Ansible plugin Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import express from 'express';
import Router from 'express-promise-router';
import { Logger } from 'winston';

import { errorHandler } from '@backstage/backend-common';
import { Config } from '@backstage/config';
import { SchedulerService } from '@backstage/backend-plugin-api';

import { RHAAPService } from './ansibleRHAAPService';
import { INVALID_SUBSCRIPTION } from './constant';

export interface RouterOptions {
  logger: Logger;
  config: Config;
  scheduler?: SchedulerService;
}

export interface AAPResponse {
  isValid: boolean;
  error_message?: string | null;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config, scheduler } = options;

  const instance = RHAAPService.getInstance(config, logger, scheduler);

  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });
  router.use(errorHandler());

  router.get('/aap/subscription', async (_, response) => {
    // Return the subscription status
    const { statusCode, isValid } = instance.getSubscriptionStatus();
    const res: AAPResponse = {
      isValid,
    };
    if (!res.isValid) res.error_message = INVALID_SUBSCRIPTION;
    response.status(statusCode).json(res);
  });

  return router;
}
