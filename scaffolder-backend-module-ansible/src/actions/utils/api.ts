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

import * as fs from 'fs';
import fetch from 'node-fetch';
import { Logger } from 'winston';

export class BackendServiceAPI {
  private async sendPostRequest(url: string, data: any) {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };

    try {
      const response = await fetch(url, requestOptions);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      return response;
    } catch (error) {
      throw new Error(
        `Failed to send POST request to fetch scaffoled data: ${error.message}`,
      );
    }
  }

  private async downloadFile(
    response: Response,
    logger: Logger,
    workspacePath: string,
    tarName: string,
  ) {
    try {
      const fileStream = fs.createWriteStream(`${workspacePath}/${tarName}`);
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', (err: any) => {
          reject(err);
        });
        fileStream.on('finish', function () {
          resolve(true);
        });
      });
      logger.info('File downloaded successfully');
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  public async downloadPlaybookProject(
    workspacePath: string,
    logger: Logger,
    creatorServiceUrl: string,
    collectionOrgName: string,
    collectionName: string,
    tarName: string,
  ) {
    try {
      logger.debug(
        `[ansible-creator] Request for ansible-playbook-project: ${collectionOrgName}`,
      );

      const postData = {
        scm_org: collectionOrgName,
        project: 'ansible-project',
        scm_project: collectionName,
      };

      const response = await this.sendPostRequest(
        creatorServiceUrl + 'v1/creator/playbook',
        postData,
      );
      await this.downloadFile(response, logger, workspacePath, tarName);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  public async downloadCollectionProject(
    workspacePath: string,
    logger: Logger,
    creatorServiceUrl: string,
    collectionOrgName: string,
    collectionName: string,
    tarName: string,
  ) {
    try {
      logger.debug(
        `[ansible-creator] Request for ansible-collection-project: ${collectionOrgName}`,
      );

      const postData = {
        collection: collectionOrgName + '.' + collectionName,
        project: 'collection',
      };

      const response = await this.sendPostRequest(
        creatorServiceUrl + 'v1/creator/collection',
        postData,
      );
      await this.downloadFile(response, logger, workspacePath, tarName);
    } catch (error) {
      console.error('Error:', error);
    }
  }
}
