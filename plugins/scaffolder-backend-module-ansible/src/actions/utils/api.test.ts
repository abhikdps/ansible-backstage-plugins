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
import { BackendServiceAPI } from './api';
import { Logger } from 'winston';

jest.mock('node-fetch');
jest.mock('fs');

describe('BackendServiceAPI', () => {
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tests playbook project call', async () => {
    const workspacePath = '/tmp/workspace';
    const collectionOrgName = 'my-org';
    const collectionName = 'my-collection';
    const tarName = 'my-collection-playbook-project.tar.gz';
    const creatorServiceUrl = 'http://localhost:8000/';

    const api = new BackendServiceAPI();

    const privateFuncdownloadFile = jest.spyOn(BackendServiceAPI.prototype as any, 'downloadFile');
    privateFuncdownloadFile.mockImplementation(() => {});

    const privateFuncsendPostRequest = jest.spyOn(BackendServiceAPI.prototype as any, 'sendPostRequest');
    privateFuncsendPostRequest.mockImplementation(() => {});

    await api.downloadPlaybookProject(
        workspacePath,
        mockLogger,
        creatorServiceUrl,
        collectionOrgName,
        collectionName,
        tarName,
      );

    // Assert
    expect(privateFuncdownloadFile).toHaveBeenCalled();
    expect(privateFuncsendPostRequest).toHaveBeenCalledWith('http://localhost:8000/v1/creator/playbook', {'project': 'ansible-project', 'scm_org': 'my-org', 'scm_project': 'my-collection'});
  });

  it('tests collection project call', async () => {
    const workspacePath = '/tmp/workspace';
    const collectionOrgName = 'my-org';
    const collectionName = 'my-collection';
    const tarName = 'my-collection-project.tar.gz';
    const creatorServiceUrl = 'http://localhost:8000/';

    const api = new BackendServiceAPI();

    const privateFuncdownloadFile = jest.spyOn(BackendServiceAPI.prototype as any, 'downloadFile');
    privateFuncdownloadFile.mockImplementation(() => {});

    const privateFuncsendPostRequest = jest.spyOn(BackendServiceAPI.prototype as any, 'sendPostRequest');
    privateFuncsendPostRequest.mockImplementation(() => {});

    await api.downloadCollectionProject(
        workspacePath,
        mockLogger,
        creatorServiceUrl,
        collectionOrgName,
        collectionName,
        tarName,
      );

    // Assert
    expect(privateFuncdownloadFile).toHaveBeenCalled();
    expect(privateFuncsendPostRequest).toHaveBeenCalledWith('http://localhost:8000/v1/creator/collection', {'collection': 'my-org.my-collection', 'project': 'collection'});
  });
});
