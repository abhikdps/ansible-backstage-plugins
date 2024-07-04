export interface Config {
  ansible?: {
    /**
     * The devspaces baseUrl for Openshift Dev Spaces Dashboard.
     * @deepVisibility backend
     */
    devSpaces?: {
      /**
       * @visibility backend
       */
      baseUrl: string;
    };
    /**
     * Base url for the creator-service
     */
    creatorService: {
      /**
       * Base url for the creator-service
       * @visibility secret
       */
      baseUrl: string;
      /**
       * Port at which the creator-service is exposed
       */
      port: string;
    };
  };
}
