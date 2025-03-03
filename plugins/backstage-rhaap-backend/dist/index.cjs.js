'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var express = require('express');
var Router = require('express-promise-router');
var rootHttpRouter = require('@backstage/backend-defaults/rootHttpRouter');
var fetch = require('node-fetch');
var https = require('https');
var backendPluginApi = require('@backstage/backend-plugin-api');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var express__default = /*#__PURE__*/_interopDefaultLegacy(express);
var Router__default = /*#__PURE__*/_interopDefaultLegacy(Router);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch);
var https__default = /*#__PURE__*/_interopDefaultLegacy(https);

const DEFAULT_SCHEDULE = {
  frequency: { hours: 24 },
  timeout: { minutes: 1 }
};
const VALID_LICENSE_TYPES = ["enterprise", "developer", "trial"];

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class AAPSubscriptionCheckError extends Error {
  constructor(status, message) {
    super();
    __publicField(this, "status", null);
    __publicField(this, "message", "");
    this.status = status;
    this.message = message;
  }
}
const _RHAAPService = class _RHAAPService {
  constructor(config, logger, scheduler) {
    __publicField(this, "hasValidSubscription", false);
    __publicField(this, "isAAPCompliant", false);
    __publicField(this, "statusCode", 500);
    __publicField(this, "scheduleFn", async () => {
    });
    __publicField(this, "config");
    __publicField(this, "logger");
    if (_RHAAPService._instance) return _RHAAPService._instance;
    this.config = config;
    this.logger = logger;
    this.logger.info(`[backstage-rhaap-backend] Setting up the scheduler`);
    let schedule = DEFAULT_SCHEDULE;
    if (this.config.has("ansible.rhaap.schedule")) {
      schedule = backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
        this.config.getConfig("ansible.rhaap.schedule")
      );
    }
    if (scheduler) {
      const taskRunner = scheduler.createScheduledTaskRunner(schedule);
      this.scheduleFn = this.createFn(taskRunner);
      const clearSubscriptionCheckTimeout = setTimeout(async () => {
        this.scheduleFn();
        await this.checkSubscription();
        clearTimeout(clearSubscriptionCheckTimeout);
      }, 500);
    }
    _RHAAPService._instance = this;
  }
  static getInstance(config, logger, scheduler) {
    return new _RHAAPService(config, logger, scheduler);
  }
  getSubscriptionStatus() {
    return {
      status: this.statusCode,
      isValid: this.hasValidSubscription,
      isCompliant: this.isAAPCompliant
    };
  }
  createFn(taskRunner) {
    return async () => taskRunner.run({
      id: "backstage-rhaap-subscription-check",
      fn: () => this.checkSubscription()
    });
  }
  async isAAP25Instance(baseUrl, reqHeaders) {
    try {
      this.logger.info(
        `[backstage-rhaap-backend] Pinging api gateway at ${baseUrl}/api/gateway/v1/ping/`
      );
      const res = await fetch__default["default"](`${baseUrl}/api/gateway/v1/ping/`, reqHeaders);
      if (!res.ok) {
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `[backstage-rhaap-backend] error: ${error} for ${baseUrl}/api/gateway/v1/ping/`
      );
      return false;
    }
  }
  async checkSubscription() {
    var _a, _b, _c, _d, _e;
    let baseUrl;
    try {
      const ansibleConfig = this.config.getConfig("ansible");
      const rhaapConfig = ansibleConfig.getConfig("rhaap");
      baseUrl = rhaapConfig.getString("baseUrl");
      const token = rhaapConfig.getString("token");
      const checkSSL = (_a = rhaapConfig.getBoolean("checkSSL")) != null ? _a : true;
      const agent = new https__default["default"].Agent({
        rejectUnauthorized: checkSSL
      });
      const reqHeaders = {
        headers: { Authorization: `Bearer ${token}` },
        agent
      };
      let aapResponse;
      const isAAP25 = await this.isAAP25Instance(baseUrl, reqHeaders);
      if (isAAP25) {
        this.logger.info(
          `[backstage-rhaap-backend] Checking AAP subscription at ${baseUrl}/api/controller/v2/config/`
        );
        aapResponse = await fetch__default["default"](
          `${baseUrl}/api/controller/v2/config`,
          reqHeaders
        );
      } else {
        this.logger.info(
          `[backstage-rhaap-backend] Checking AAP subscription at ${baseUrl}/api/v2/config/`
        );
        aapResponse = await fetch__default["default"](`${baseUrl}/api/v2/config`, reqHeaders);
      }
      const data = await aapResponse.json();
      if (!aapResponse.ok) {
        throw new AAPSubscriptionCheckError(aapResponse.status, data.detail);
      } else {
        this.statusCode = aapResponse.status;
        this.hasValidSubscription = VALID_LICENSE_TYPES.includes(
          (_b = data == null ? void 0 : data.license_info) == null ? void 0 : _b.license_type
        );
        this.isAAPCompliant = (_d = (_c = data == null ? void 0 : data.license_info) == null ? void 0 : _c.compliant) != null ? _d : false;
      }
    } catch (error) {
      this.logger.error(
        `[backstage-rhaap-backend] AAP subscription Check failed for ${baseUrl}/api/v2/config/`
      );
      if (error instanceof AAPSubscriptionCheckError) {
        this.statusCode = (_e = error.status) != null ? _e : 404;
      } else if (error.code === "CERT_HAS_EXPIRED") {
        this.statusCode = 495;
      } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        this.statusCode = 404;
      } else {
        this.statusCode = Number.isInteger(error.code) && error.code >= 100 && error.code < 600 ? error.code : 500;
      }
      this.logger.error(
        `[backstage-rhaap-backend] Error: ${this.statusCode}: ${error.message}`
      );
      this.hasValidSubscription = false;
      this.isAAPCompliant = false;
    }
  }
};
__publicField(_RHAAPService, "_instance");
let RHAAPService = _RHAAPService;

async function createRouter(options) {
  const { logger, config, scheduler } = options;
  const middleware = rootHttpRouter.MiddlewareFactory.create({ config, logger });
  const instance = RHAAPService.getInstance(config, logger, scheduler);
  const router = Router__default["default"]();
  router.use(middleware.helmet());
  router.use(express__default["default"].json());
  router.use(middleware.error());
  router.get("/health", (_, response) => {
    logger.info("PONG!");
    response.json({ status: "ok" });
  });
  router.get("/aap/subscription", async (_, response) => {
    const res = instance.getSubscriptionStatus();
    response.status(res.status).json(res);
  });
  return router;
}

const backstageRHAAPPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "backstage-rhaap",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ config, logger, httpRouter, scheduler }) {
        httpRouter.use(
          await createRouter({
            config,
            logger,
            scheduler
          })
        );
      }
    });
  }
});

exports.createRouter = createRouter;
exports["default"] = backstageRHAAPPlugin;
//# sourceMappingURL=index.cjs.js.map
