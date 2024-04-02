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

import React, { useState } from 'react';
import { Header, Page, HeaderTabs, Content } from '@backstage/core-components';
import { EntityOverviewContent } from '../OverviewContent';
import { EntityCatalogContent } from '../CatalogContent';
import { EntityCreateContent } from '../CreateContent';
import { EntityLearnContent } from '../LearnContent';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router';

const AnisbleHeader = () => <Header title="Ansible" />;

const tabs = [
  { id: 0, label: 'Overview' },
  { id: 1, label: 'Catalog' },
  { id: 2, label: 'Create' },
  { id: 3, label: 'Learn' },
];

export const AnsiblePage = () => {
  const param = useParams();
  const section = param['*'];
  const navigate = useNavigate();
  
  const selectedTabIndex = tabs.findIndex(
    item => item.label.toLocaleLowerCase() === section,
  );
  const [selectedTab, setSelectedTab] = useState<any>(tabs[selectedTabIndex > -1 ? selectedTabIndex : 0]);

  const onTabSelect = (index: number) => {
    setSelectedTab(tabs[index]);
    navigate(tabs[index].label.toLocaleLowerCase());
  };
  return (
    section === '' ? <Navigate to='overview'/> : (
    <Page themeId="app">
      <AnisbleHeader />
      <HeaderTabs
        selectedIndex={selectedTab.id}
        onChange={onTabSelect}
        tabs={tabs.map(({ id, label }) => ({
          id: id.toString(),
          label,
        }))}
      />

      <Content>
        <Routes>
          <Route path="/">
            <Route
              path="overview"
              element={<EntityOverviewContent onTabChange={onTabSelect}/>}
            />
            <Route path="catalog" element={<EntityCatalogContent />} />
            <Route path="create" element={<EntityCreateContent />} />
            <Route path="learn" element={<EntityLearnContent />} />
          </Route>
        </Routes>
      </Content>
    </Page>
  ));
};
