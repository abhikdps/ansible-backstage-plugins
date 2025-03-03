import express from 'express';
import { Config } from '@backstage/config';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, SchedulerService } from '@backstage/backend-plugin-api';

interface RouterOptions {
    logger: LoggerService;
    config: Config;
    scheduler?: SchedulerService;
}
declare function createRouter(options: RouterOptions): Promise<express.Router>;

/**
 * Backstage Anisble backend plugin
 *
 * @public
 */
declare const backstageRHAAPPlugin: _backstage_backend_plugin_api.BackendFeatureCompat;

export { RouterOptions, createRouter, backstageRHAAPPlugin as default };
